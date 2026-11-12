// F-GENERER et son rapport [D110, D113, D184] : choisir le profil, la periode et
// s'il faut remplacer les repas non verrouilles ; l'apercu ne change rien tant
// qu'on ne garde pas ce planning ; les cases vides sont expliquees, et un repas
// modifie entre-temps par un membre n'est pas ecrase.
import {
  applyGenerationResultSchema,
  generationPreviewSchema,
  type ApplyGenerationBody,
  type GenerationPreview,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button } from "../../ui/button.tsx";
import { RadioGroup, SegmentedControl, Switch } from "../../ui/controls.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { addDays, periodLabel, whenLabel } from "./dates.ts";
import { reasonText, skippedText, warningText } from "./format.ts";
import { mealsKey, profilesQuery } from "./queries.ts";

type Span = "this" | "next" | "both";

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count > 1 ? many : one}`;
}

/** Message apres "Garder ce planning". */
function appliedMessage(written: number, conflicts: number): string {
  if (conflicts === 0) return `${plural(written, "repas ajouté", "repas ajoutés")} au planning`;
  const kept =
    conflicts > 1
      ? `${String(conflicts)} repas modifiés entre-temps par un membre n'ont pas été remplacés.`
      : "1 repas modifié entre-temps par un membre n'a pas été remplacé.";
  return `${plural(written, "repas ajouté", "repas ajoutés")}. ${kept}`;
}

function Options({
  spaceId,
  weekStart,
  onPreview,
}: {
  spaceId: string;
  weekStart: string;
  onPreview: (preview: GenerationPreview) => void;
}) {
  const guard = useWriteGuard();
  const profiles = useQuery(profilesQuery(spaceId));
  const [profileId, setProfileId] = useState<string>();
  const [span, setSpan] = useState<Span>("this");
  const [replace, setReplace] = useState(false);
  const chosen = profileId ?? profiles.data?.find((p) => p.isDefault)?.id;
  const from = span === "next" ? addDays(weekStart, 7) : weekStart;
  const to = span === "this" ? addDays(weekStart, 6) : addDays(weekStart, 13);
  const run = useMutation({
    mutationFn: () =>
      api.post(
        `/spaces/${spaceId}/meal-plan/generate`,
        { profileId: chosen, from, to, replace },
        generationPreviewSchema
      ),
    onSuccess: onPreview,
  });

  return (
    <div className="fm-stack">
      <FormAlert
        message={
          run.isError
            ? errorMessage(run.error)
            : profiles.isError
              ? errorMessage(profiles.error)
              : undefined
        }
      />
      <div className="flex flex-col gap-1">
        <span className="fm-label">Profil de génération</span>
        {profiles.data ? (
          <RadioGroup
            label="Profil de génération"
            options={profiles.data.map((p) => ({
              value: p.id,
              label: p.name,
              hint: [p.isDefault ? "Par défaut" : null, plural(p.ruleCount, "règle", "règles")]
                .filter(Boolean)
                .join(" · "),
            }))}
            value={chosen}
            onChange={setProfileId}
          />
        ) : (
          <p className="m-0 text-sm text-ink-muted">Chargement…</p>
        )}
        <Link to="profiles" className="self-start text-sm text-accent-text underline">
          Gérer les profils
        </Link>
      </div>
      <div className="flex flex-col gap-1">
        <span className="fm-label">Période</span>
        <SegmentedControl
          label="Période"
          options={[
            { value: "this", label: "Cette semaine" },
            { value: "next", label: "La suivante" },
            { value: "both", label: "Les deux" },
          ]}
          value={span}
          onChange={setSpan}
        />
        <span className="text-sm text-ink-muted">{periodLabel(from, to)}</span>
      </div>
      <Switch
        label="Remplacer les repas non verrouillés (sinon : seulement les repas vides)"
        checked={replace}
        onChange={setReplace}
      />
      <SheetFooter>
        <Button
          variant="primary"
          block
          icon="sparkles"
          disabled={!chosen || run.isPending || guard.disabled}
          aria-describedby={guard["aria-describedby"]}
          onClick={() => {
            run.mutate();
          }}
        >
          Générer
        </Button>
      </SheetFooter>
    </div>
  );
}

function Report({
  spaceId,
  preview,
  onBack,
  onDone,
}: {
  spaceId: string;
  preview: GenerationPreview;
  onBack: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const guard = useWriteGuard();
  const picked = preview.proposals.filter((p) => p.pick !== null);
  const empty = preview.proposals.filter((p) => p.pick === null);
  const keep = useMutation({
    mutationFn: () => {
      const body: ApplyGenerationBody = {
        cells: picked.flatMap((p) =>
          p.pick
            ? [
                {
                  date: p.date,
                  mealTime: p.mealTime,
                  pick:
                    p.pick.kind === "RECIPE"
                      ? { kind: "RECIPE" as const, recipeId: p.pick.recipe.id }
                      : { kind: "IDEA" as const, ideaId: p.pick.idea.id },
                  seenUpdatedAt: p.seenUpdatedAt,
                },
              ]
            : []
        ),
      };
      return api.post(
        `/spaces/${spaceId}/meal-plan/generate/apply`,
        body,
        applyGenerationResultSchema
      );
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: mealsKey(spaceId) });
      toast(appliedMessage(result.data.length, result.conflicts.length), {
        tone: result.conflicts.length > 0 ? "warning" : "success",
      });
      onDone();
    },
  });

  return (
    <div className="fm-stack">
      <FormAlert message={keep.isError ? errorMessage(keep.error) : undefined} />
      <div className="flex flex-col gap-1">
        <b className="text-[17px]">
          {plural(picked.length, "repas proposé", "repas proposés")} sur{" "}
          {String(preview.proposals.length)}
        </b>
        {skippedText(preview.skipped) ? (
          <span className="text-sm">{skippedText(preview.skipped)}</span>
        ) : null}
        <span className="text-sm text-ink-muted">
          Avec le profil {preview.profile.name}. Rien n'est enregistré tant que tu ne gardes pas ce
          planning.
        </span>
      </div>
      {preview.proposals.length === 0 ? (
        <p className="m-0 text-sm text-ink-muted">
          Aucun repas à proposer : la période est déjà remplie, verrouillée ou exclue.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {preview.proposals.map((p) => (
            <li
              key={`${p.date}/${p.mealTime}`}
              className="flex items-baseline gap-3 rounded-md border border-line px-3 py-2"
            >
              <span className="w-36 shrink-0 text-sm whitespace-nowrap text-ink-muted">
                {whenLabel(p.date, p.mealTime)}
              </span>
              <span className={p.pick ? "font-semibold" : "text-ink-muted italic"}>
                {p.pick
                  ? p.pick.kind === "RECIPE"
                    ? p.pick.recipe.title
                    : p.pick.idea.name
                  : "Aucune recette"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {empty.length > 0 || preview.warnings.length > 0 ? (
        <div role="note" className="fm-stack rounded-md bg-warning-soft px-3 py-2 text-sm">
          {empty.map((p) => (
            <p key={`${p.date}/${p.mealTime}`} className="m-0">
              <b>{whenLabel(p.date, p.mealTime)} : laissé vide.</b>{" "}
              <span>{p.reason ? reasonText(p.reason) : null}</span>
            </p>
          ))}
          {preview.warnings.map((w, index) => (
            <p key={index} className="m-0">
              {warningText(w)}
            </p>
          ))}
        </div>
      ) : null}
      <SheetFooter>
        <Button variant="secondary" onClick={onBack}>
          Retour
        </Button>
        <Button
          variant="primary"
          disabled={picked.length === 0 || keep.isPending || guard.disabled}
          aria-describedby={guard["aria-describedby"]}
          onClick={() => {
            keep.mutate();
          }}
        >
          Garder ce planning
        </Button>
      </SheetFooter>
    </div>
  );
}

export function GenerateSheet({
  open,
  onClose,
  spaceId,
  weekStart,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  /** Premier jour de la semaine affichee. */
  weekStart: string;
}) {
  const [preview, setPreview] = useState<GenerationPreview | null>(null);
  const close = () => {
    setPreview(null);
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title={preview ? "Planning proposé" : "Générer le planning"}>
      {open ? (
        preview ? (
          <Report
            spaceId={spaceId}
            preview={preview}
            onBack={() => {
              setPreview(null);
            }}
            onDone={close}
          />
        ) : (
          <Options spaceId={spaceId} weekStart={weekStart} onPreview={setPreview} />
        )
      ) : null}
    </Sheet>
  );
}
