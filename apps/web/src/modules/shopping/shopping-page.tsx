// E-COURSES [D228, D231] : une liste par espace, rangee par sections dans l'ordre du
// magasin, "Autres" en fin. Un seul compteur en tete. La case coche (cible du pouce),
// toucher le produit ouvre F-ARTICLE ; un article coche se barre et glisse en fin de
// section ; une section toute cochee se replie seule. Champ d'ajout en bas.
import type { ShoppingItem, ShoppingSection, SpaceRole, Unit } from "@fm/shared";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useParams } from "react-router";

import { spaceQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { cx } from "../../ui/cx.ts";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { Icon } from "../../ui/icon.tsx";
import { PullToRefresh } from "../../ui/pull-to-refresh.tsx";
import { addDays, todayIso, weekStart } from "../meal-plan/dates.ts";
import { settingsQuery as planSettingsQuery } from "../meal-plan/queries.ts";
import { unitsQuery } from "../recipes/queries.ts";
import { AddBar } from "./add-bar.tsx";
import { formatParts, itemName } from "./entry.ts";
import { FromPlanSheet } from "./from-plan-sheet.tsx";
import { planPeriod } from "./period.ts";
import { ItemSheet } from "./item-sheet.tsx";
import { listQuery, settingsQuery } from "./queries.ts";
import { sectionItems, useShopping } from "./use-shopping.ts";

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
  onCheck,
  onOpen,
}: {
  item: ShoppingItem;
  units: readonly Unit[];
  disabled: boolean;
  onCheck: (checked: boolean) => void;
  onOpen: () => void;
}) {
  const name = itemName(item);
  const checked = item.checkedAt !== null;
  const from = sourcesLabel(item);
  const amount = formatParts(item.parts, units);
  return (
    <li className={cx("fm-shop-item", checked && "fm-shop-item-done")}>
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
  onToggle,
  children,
}: {
  name: string;
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
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={18} />
        <span className="flex-1">{name}</span>
        <span className="fm-shop-count">{left > 0 ? left : "tout est pris"}</span>
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
  const { create, update } = useShopping(spaceId);
  // Replie ou deplie a la main ; sinon, repliee quand tout est coche.
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [fromPlan, setFromPlan] = useState(false);
  // "Depuis le planning" : module planning actif et droit de modifier la liste.
  const space = useQuery(spaceQuery(spaceId));
  const withPlan = canEdit && !!space.data?.modules.some((m) => m.code === "meal-plan");
  const planSettings = useQuery({ ...planSettingsQuery(spaceId), enabled: withPlan });

  let content;
  if (list.isError && !list.data) {
    content = <EmptyState title="Liste indisponible">{errorMessage(list.error)}</EmptyState>;
  } else if (!list.data || !units.data) {
    content = <Skeleton kind="card" count={2} label="Chargement de la liste…" />;
  } else if (list.data.items.length === 0) {
    content = (
      <EmptyState icon="shopping-basket" title="La liste est vide">
        {canEdit ? "Tape un article en bas de l'écran : « lait », « 2 citrons »." : null}
      </EmptyState>
    );
  } else {
    const { items, sections } = list.data;
    const groups: { key: string; section: ShoppingSection | null; name: string }[] = [
      ...sections.map((section) => ({ key: section.id, section, name: section.name })),
      { key: "others", section: null, name: "Autres" },
    ];
    content = (
      <PullToRefresh onRefresh={() => list.refetch()}>
        <div role="group" aria-label="Sections" className="fm-shop-sections">
          {groups.map(({ key, section, name }) => {
            const inSection = sectionItems(items, section?.id ?? null);
            if (inSection.length === 0) return null;
            const done = inSection.every((item) => item.checkedAt !== null);
            const collapsed = folded[key] ?? done;
            return (
              <SectionBlock
                key={key}
                name={name}
                items={inSection}
                collapsed={collapsed}
                onToggle={() => {
                  setFolded((current) => ({ ...current, [key]: !collapsed }));
                }}
              >
                {inSection.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    units={units.data}
                    disabled={!canEdit || guard.disabled === true}
                    onCheck={(checked) => {
                      update.mutate({
                        itemId: item.id,
                        body: { checked, checkedChangedAt: new Date().toISOString() },
                      });
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

  const left = list.data?.items.filter((item) => item.checkedAt === null).length ?? 0;
  const opened = list.data?.items.find((item) => item.id === openId);
  const tomorrow = addDays(todayIso(), 1);

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
                setFromPlan(true);
              }}
            >
              <Icon name="calendar" />
              <span>Planning</span>
            </button>
          ) : null}
        </header>
        {list.data && !canEdit && settings.data ? (
          <p className="m-0 text-sm text-ink-muted">{READ_ONLY_NOTE[settings.data.editRole]}</p>
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
      {fromPlan && planSettings.data ? (
        <FromPlanSheet
          spaceId={spaceId}
          period={planPeriod(tomorrow, weekStart(tomorrow, planSettings.data.weekStartsOn))}
          onClose={() => {
            setFromPlan(false);
          }}
        />
      ) : null}
      {opened && list.data && units.data ? (
        <ItemSheet
          spaceId={spaceId}
          item={opened}
          items={list.data.items}
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
