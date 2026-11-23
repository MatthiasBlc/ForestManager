// E-COURSES [D228, D231] : une liste par espace, rangee par sections dans l'ordre du
// magasin, "Autres" en fin. Un seul compteur en tete. La case coche (cible du pouce),
// toucher le produit ouvre F-ARTICLE ; un article coche se barre et glisse en fin de
// section ; une section toute cochee se replie seule. Champ d'ajout en bas. Appui long
// (ou souris) puis glisser range un article, dans sa section ou dans une autre. Hors
// ligne, la liste se lit et se coche ; les coches partent au retour du reseau. Pendant
// un glisser, les sections vides se montrent comme cibles.
import type { ShoppingItem, ShoppingSection, SpaceRole, Unit } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router";

import { spaceQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { useOnline } from "../../pwa/use-online.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { ActionMenu } from "../../ui/action-menu.tsx";
import { IconButton } from "../../ui/button.tsx";
import { cx } from "../../ui/cx.ts";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { Icon } from "../../ui/icon.tsx";
import { PullToRefresh } from "../../ui/pull-to-refresh.tsx";
import { usePointerDrag } from "../../ui/use-pointer-drag.ts";
import { addDays, todayIso, weekStart } from "../meal-plan/dates.ts";
import { settingsQuery as planSettingsQuery } from "../meal-plan/queries.ts";
import { unitsQuery } from "../recipes/queries.ts";
import { AddBar } from "./add-bar.tsx";
import { formatParts, itemName } from "./entry.ts";
import { FromPlanSheet } from "./from-plan-sheet.tsx";
import { flushChecks, queueCheck, usePendingChecks, withPending } from "./pending-checks.ts";
import { planPeriod } from "./period.ts";
import { ItemSheet } from "./item-sheet.tsx";
import { SectionsSheet } from "./sections-sheet.tsx";
import { ShoppingSettingsSheet } from "./settings-sheet.tsx";
import { listQuery, settingsQuery } from "./queries.ts";
import { dropMove, sectionDropId, sectionItems, useShopping } from "./use-shopping.ts";

type Drag = ReturnType<typeof usePointerDrag>;

const READ_ONLY_NOTE: Record<SpaceRole, string> = {
  MEMBER: "",
  MODERATOR: "Seuls les modérateurs et le propriétaire modifient la liste.",
  OWNER: "Seul le propriétaire modifie la liste.",
};

/** "pour : Gratin, Curry" : recettes distinctes, dans l'ordre. */
function sourcesLabel(item: ShoppingItem): string | null {
  const titles = [...new Set(item.sources.map((source) => source.recipeTitle))];
  return titles.length > 0 ? `pour : ${titles.join(", ")}` : null;
}

function ItemRow({
  item,
  units,
  disabled,
  drag,
  onCheck,
  onOpen,
}: {
  item: ShoppingItem;
  units: readonly Unit[];
  disabled: boolean;
  /** Glisser possible (droit de modifier, en ligne) ; un article achete ne se prend pas. */
  drag: Drag | null;
  onCheck: (checked: boolean) => void;
  onOpen: () => void;
}) {
  const name = itemName(item);
  const checked = item.checkedAt !== null;
  const from = sourcesLabel(item);
  const amount = formatParts(item.parts, units);
  return (
    <li
      className={cx("fm-shop-item", checked && "fm-shop-item-done")}
      {...(drag && !checked ? drag.source(item.id, { onMenu: onOpen }) : {})}
      {...drag?.target(item.id)}
    >
      <label className="fm-shop-check">
        <input
          type="checkbox"
          aria-label={name}
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            onCheck(event.target.checked);
          }}
        />
      </label>
      <button
        type="button"
        className="fm-shop-item-body"
        aria-label={`Détail de ${name}`}
        onClick={onOpen}
      >
        <span className="fm-shop-item-text">
          <b>{name}</b>
          {from ? <small>{from}</small> : null}
        </span>
        {amount ? <span className="fm-shop-qty">{amount}</span> : null}
      </button>
    </li>
  );
}

function SectionBlock({
  name,
  items,
  collapsed,
  dropId,
  onToggle,
  children,
}: {
  name: string;
  /** Cible du glisser sur le titre (en fin des articles a acheter). */
  dropId: Record<string, string> | undefined;
  items: readonly ShoppingItem[];
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const left = items.filter((item) => item.checkedAt === null).length;
  return (
    <section aria-label={name} className="fm-shop-section">
      <button
        type="button"
        className="fm-shop-section-head"
        aria-expanded={!collapsed}
        onClick={onToggle}
        {...dropId}
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={18} />
        <span className="flex-1">{name}</span>
        <span className="fm-shop-count">
          {left > 0 ? left : items.length > 0 ? "tout est pris" : null}
        </span>
      </button>
      {collapsed ? null : <ul className="fm-shop-items">{children}</ul>}
    </section>
  );
}

export function ShoppingPage() {
  const { spaceId = "" } = useParams();
  const list = useQuery(listQuery(spaceId));
  const units = useQuery(unitsQuery);
  const canEdit = list.data?.can.edit ?? false;
  const settings = useQuery({
    ...settingsQuery(spaceId),
    enabled: list.data !== undefined && !canEdit,
  });
  const guard = useWriteGuard();
  const online = useOnline();
  const queryClient = useQueryClient();
  const { create, update, clear, move } = useShopping(spaceId);
  // Coches faites sans reseau, montrees par-dessus la liste jusqu'a leur envoi.
  const pending = usePendingChecks(spaceId);
  const waiting = Object.keys(pending).length;
  const items = list.data ? withPending(list.data.items, pending) : [];
  useEffect(() => {
    if (!online || waiting === 0) return;
    // Le cache prend les coches avant l'envoi : pas de retour en arriere a l'affichage.
    queryClient.setQueryData(listQuery(spaceId).queryKey, (data) =>
      data ? { ...data, items: withPending(data.items, pending) } : data
    );
    void flushChecks(spaceId).then((sent) => {
      if (sent) void queryClient.invalidateQueries({ queryKey: listQuery(spaceId).queryKey });
    });
  }, [online, waiting, pending, spaceId, queryClient]);
  // Pendant un glisser, les sections vides se montrent comme cibles.
  const [dragging, setDragging] = useState(false);
  const drag = usePointerDrag({
    onDragChange: setDragging,
    onDrop: (source, target) => {
      const next = dropMove(items, source, target);
      if (next) move.mutate(next);
    },
  });
  const dragSource = canEdit && online ? drag : null;
  // Replie ou deplie a la main ; sinon, repliee quand tout est coche.
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  // Feuille ouverte depuis l'en-tete ou le menu du module.
  const [sheet, setSheet] = useState<"from-plan" | "sections" | "settings" | null>(null);
  // "Depuis le planning" : module planning actif et droit de modifier la liste.
  const space = useQuery(spaceQuery(spaceId));
  const withPlan = canEdit && !!space.data?.modules.some((m) => m.code === "meal-plan");
  const planSettings = useQuery({ ...planSettingsQuery(spaceId), enabled: withPlan });

  let content;
  if (list.isError && !list.data) {
    content = <EmptyState title="Liste indisponible">{errorMessage(list.error)}</EmptyState>;
  } else if (!list.data || !units.data) {
    content = <Skeleton kind="card" count={2} label="Chargement de la liste…" />;
  } else if (items.length === 0) {
    content = (
      <EmptyState icon="shopping-basket" title="La liste est vide">
        {canEdit ? "Tape un article en bas de l'écran : « lait », « 2 citrons »." : null}
      </EmptyState>
    );
  } else {
    const { sections } = list.data;
    const groups: { key: string; section: ShoppingSection | null; name: string }[] = [
      ...sections.map((section) => ({ key: section.id, section, name: section.name })),
      { key: "others", section: null, name: "Autres" },
    ];
    content = (
      <PullToRefresh onRefresh={() => list.refetch()}>
        <div role="group" aria-label="Sections" className="fm-shop-sections">
          {groups.map(({ key, section, name }) => {
            const inSection = sectionItems(items, section?.id ?? null);
            if (inSection.length === 0 && !dragging) return null;
            const done = inSection.every((item) => item.checkedAt !== null);
            const collapsed = folded[key] ?? done;
            return (
              <SectionBlock
                key={key}
                name={name}
                items={inSection}
                collapsed={collapsed}
                dropId={dragSource?.target(sectionDropId(section?.id ?? null))}
                onToggle={() => {
                  setFolded((current) => ({ ...current, [key]: !collapsed }));
                }}
              >
                {inSection.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    units={units.data}
                    disabled={!canEdit}
                    drag={dragSource}
                    onCheck={(checked) => {
                      const at = new Date().toISOString();
                      if (online) {
                        update.mutate({ itemId: item.id, body: { checked, checkedChangedAt: at } });
                      } else queueCheck(spaceId, item.id, checked, at);
                    }}
                    onOpen={() => {
                      setOpenId(item.id);
                    }}
                  />
                ))}
              </SectionBlock>
            );
          })}
        </div>
      </PullToRefresh>
    );
  }

  const left = items.filter((item) => item.checkedAt === null).length;
  const opened = items.find((item) => item.id === openId);
  const tomorrow = addDays(todayIso(), 1);
  const bought = items.filter((item) => item.checkedAt !== null).length;
  let checksNote: string | null = null;
  if (waiting > 0)
    checksNote =
      waiting > 1 ? `${String(waiting)} coches en attente d'envoi.` : "1 coche en attente d'envoi.";

  return (
    <div className="fm-shop">
      <div className="fm-stack mx-auto w-full max-w-3xl flex-1 p-4">
        <header className="flex items-baseline gap-3">
          <h1 className="m-0 font-display text-xl font-bold">Courses</h1>
          {list.data ? (
            <span className="text-sm text-ink-muted tabular-nums">
              {`${String(left)} à acheter`}
            </span>
          ) : null}
          <span className="flex-1" />
          {withPlan && planSettings.data ? (
            <button
              type="button"
              className="fm-toolbtn"
              aria-label="Depuis le planning"
              onClick={() => {
                setSheet("from-plan");
              }}
            >
              <Icon name="calendar" />
              <span>Planning</span>
            </button>
          ) : null}
          {canEdit && list.data ? (
            <ActionMenu
              label="Menu de la liste"
              disabled={guard.disabled === true}
              trigger={<IconButton icon="more" label="Menu de la liste" />}
              items={[
                {
                  id: "clear",
                  label:
                    bought > 0 ? `Retirer les achetés (${String(bought)})` : "Retirer les achetés",
                  icon: "check",
                  disabled: bought === 0,
                },
                ...(withPlan && planSettings.data
                  ? [
                      {
                        id: "from-plan" as const,
                        label: "Depuis le planning",
                        icon: "calendar" as const,
                      },
                    ]
                  : []),
                { id: "sections", label: "Gérer les sections", icon: "list" },
                ...(list.data.can.setEditRole && space.data?.kind !== "PERSONAL"
                  ? [{ id: "settings" as const, label: "Réglages", icon: "settings" as const }]
                  : []),
              ]}
              onSelect={(id) => {
                if (id === "clear") clear.mutate();
                else setSheet(id);
              }}
            />
          ) : null}
        </header>
        {list.data && !canEdit && settings.data ? (
          <p className="m-0 text-sm text-ink-muted">{READ_ONLY_NOTE[settings.data.editRole]}</p>
        ) : null}
        {checksNote ? (
          <p role="status" className="m-0 text-sm text-ink-muted">
            {checksNote}
          </p>
        ) : null}
        {content}
      </div>
      {canEdit && units.data ? (
        <AddBar
          units={units.data}
          onAdd={(body) => {
            create.mutate(body);
          }}
        />
      ) : null}
      {sheet === "from-plan" && planSettings.data ? (
        <FromPlanSheet
          spaceId={spaceId}
          period={planPeriod(tomorrow, weekStart(tomorrow, planSettings.data.weekStartsOn))}
          onClose={() => {
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === "sections" && list.data ? (
        <SectionsSheet
          spaceId={spaceId}
          sections={list.data.sections}
          items={list.data.items}
          onClose={() => {
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === "settings" ? (
        <ShoppingSettingsSheet
          spaceId={spaceId}
          onClose={() => {
            setSheet(null);
          }}
        />
      ) : null}
      {opened && list.data && units.data ? (
        <ItemSheet
          spaceId={spaceId}
          item={opened}
          items={items}
          sections={list.data.sections}
          units={units.data}
          canEdit={canEdit}
          onClose={() => {
            setOpenId(null);
          }}
        />
      ) : null}
    </div>
  );
}
