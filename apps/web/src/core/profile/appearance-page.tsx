// E-APPARENCE : ambiance avec apercu, mode, densite, taille du texte ; chaque choix
// s'applique et s'enregistre tout de suite [D32, D115, D158].
import { meSchema, type Me, type Preferences } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { THEME_SWATCHES } from "../../theme/themes.ts";
import { RadioGroup, SegmentedControl } from "../../ui/controls.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { meQuery } from "../session/queries.ts";
import { ProfileLayout } from "./profile-layout.tsx";

const AMBIANCE_OPTIONS = [
  {
    value: "BRAISE",
    label: "Braise",
    hint: "Charbon et ambre, l'ambiance de Forest Manager",
    swatches: THEME_SWATCHES["braise-dark"].slice(1),
  },
  {
    value: "SOUSBOIS",
    label: "Sous-bois",
    hint: "Verts de forêt, mousse et bois clair",
    swatches: THEME_SWATCHES["sousbois-dark"].slice(1),
  },
  {
    value: "POTAGER",
    label: "Potager",
    hint: "Les couleurs des légumes, vives et gaies",
    swatches: THEME_SWATCHES["potager-dark"].slice(1),
  },
] as const;
const MODES = [
  { value: "SYSTEM", label: "Système" },
  { value: "LIGHT", label: "Clair" },
  { value: "DARK", label: "Sombre" },
] as const;
const DENSITIES = [
  { value: "COMFORTABLE", label: "Confortable" },
  { value: "COMPACT", label: "Compacte" },
] as const;
const SIZES = [
  { value: "90", label: "Petite" },
  { value: "100", label: "Normale" },
  { value: "115", label: "Grande" },
  { value: "130", label: "Très grande" },
] as const;

export function AppearancePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const me = useQuery(meQuery);
  const save = useMutation({
    mutationFn: (change: Partial<Preferences>) => api.patch("/me/preferences", change, meSchema),
    onMutate: (change) => {
      const previous = queryClient.getQueryData<Me | null>(["me"]);
      if (previous) {
        queryClient.setQueryData(["me"], {
          ...previous,
          preferences: { ...previous.preferences, ...change },
        });
      }
      return { previous };
    },
    onError: (error, _change, context) => {
      if (context?.previous) queryClient.setQueryData(["me"], context.previous);
      toast(errorMessage(error), { tone: "danger" });
    },
    onSuccess: (updated) => queryClient.setQueryData(["me"], updated),
  });
  if (!me.data) return null;
  const prefs = me.data.preferences;
  return (
    <ProfileLayout title="Apparence" back="/profile">
      <h1 className="font-display text-2xl font-bold">Apparence</h1>
      <section className="fm-stack">
        <h2 className="font-display text-lg font-bold">Ambiance</h2>
        <RadioGroup
          label="Ambiance"
          options={AMBIANCE_OPTIONS}
          value={prefs.ambiance}
          onChange={(ambiance) => save.mutate({ ambiance })}
        />
      </section>
      <section className="fm-stack">
        <h2 className="font-display text-lg font-bold">Clair ou sombre</h2>
        <SegmentedControl
          label="Mode d'affichage"
          options={MODES}
          value={prefs.colorMode}
          onChange={(colorMode) => save.mutate({ colorMode })}
        />
        <p className="text-ink-muted">« Système » suit le réglage de ton appareil.</p>
      </section>
      <section className="fm-stack">
        <h2 className="font-display text-lg font-bold">Densité</h2>
        <RadioGroup
          label="Densité"
          options={DENSITIES}
          value={prefs.density}
          onChange={(density) => save.mutate({ density })}
        />
      </section>
      <section className="fm-stack">
        <h2 className="font-display text-lg font-bold">Taille du texte</h2>
        <RadioGroup
          label="Taille du texte"
          options={SIZES}
          value={String(prefs.textScale) as (typeof SIZES)[number]["value"]}
          onChange={(size) => save.mutate({ textScale: Number(size) as Preferences["textScale"] })}
        />
      </section>
    </ProfileLayout>
  );
}
