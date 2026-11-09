// E-NOTIF-PREFERENCES (F-NOT-2, D118) : categories globales, puis un reglage par
// espace groupe ("Comme ci-dessus" ou "Personnalise").
import {
  notificationPreferencesSchema,
  type CategoryPreference,
  type NotificationPreferences,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { RadioGroup, Switch } from "../../ui/controls.tsx";
import { Avatar, Skeleton } from "../../ui/display.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { ProfileLayout } from "../profile/profile-layout.tsx";
import { spacesQuery } from "../session/queries.ts";
import { categoryLabel } from "./messages.ts";
import { preferencesQuery } from "./queries.ts";

type SpacePreference = NotificationPreferences["spaces"][number];

function modeLabel(space: SpacePreference): string {
  if (!space.custom) return "Comme ci-dessus";
  const on = space.categories.filter((c) => c.enabled).map((c) => categoryLabel(c.key).label);
  return `Personnalisé : ${on.length > 0 ? on.join(", ").toLowerCase() : "rien"}`;
}

function SpaceSheet({
  name,
  space,
  onClose,
}: {
  name: string;
  space: SpacePreference;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [custom, setCustom] = useState(space.custom);
  const [choices, setChoices] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(space.categories.map((c) => [c.key, c.enabled]))
  );
  const save = useMutation({
    mutationFn: () =>
      custom
        ? api.put(
            `/me/notification-preferences/spaces/${space.spaceId}`,
            { categories: choices },
            notificationPreferencesSchema
          )
        : api.delete(
            `/me/notification-preferences/spaces/${space.spaceId}`,
            undefined,
            notificationPreferencesSchema
          ),
    onSuccess: (data) => {
      queryClient.setQueryData(preferencesQuery.queryKey, data);
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={name}>
      <div className="fm-stack">
        <RadioGroup
          label={`Notifications de ${name}`}
          options={[
            { value: "same", label: "Comme ci-dessus" },
            { value: "custom", label: "Personnalisé" },
          ]}
          value={custom ? "custom" : "same"}
          onChange={(value) => {
            setCustom(value === "custom");
          }}
        />
        {custom
          ? space.categories.map((category) => (
              <Switch
                key={category.key}
                label={categoryLabel(category.key).label}
                checked={choices[category.key] ?? false}
                onChange={(on) => {
                  setChoices((current) => ({ ...current, [category.key]: on }));
                }}
              />
            ))
          : null}
      </div>
      <SheetFooter>
        <Button
          variant="primary"
          disabled={save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          Enregistrer
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

function CategorySwitch({ category }: { category: CategoryPreference }) {
  const queryClient = useQueryClient();
  const label = categoryLabel(category.key);
  const change = useMutation({
    mutationFn: (enabled: boolean) =>
      api.put(
        "/me/notification-preferences",
        { category: category.key, enabled },
        notificationPreferencesSchema
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(preferencesQuery.queryKey, data);
    },
  });
  return (
    <div className="flex flex-col gap-1">
      <Switch
        label={label.label}
        checked={category.enabled}
        disabled={change.isPending}
        onChange={(on) => {
          change.mutate(on);
        }}
      />
      {label.hint ? <span className="text-sm text-ink-muted">{label.hint}</span> : null}
    </div>
  );
}

export function NotificationPreferencesPage() {
  const preferences = useQuery(preferencesQuery);
  const spaces = useQuery(spacesQuery);
  const [open, setOpen] = useState<string | null>(null);
  const space = (id: string) => spaces.data?.find((s) => s.id === id);
  const opened = preferences.data?.spaces.find((s) => s.spaceId === open);

  return (
    <ProfileLayout title="Notifications" back="/profile">
      {preferences.data ? (
        <>
          <section className="fm-stack">
            <h2 className="font-display text-lg font-semibold">Me prévenir pour</h2>
            {preferences.data.categories.map((category) => (
              <CategorySwitch key={category.key} category={category} />
            ))}
          </section>
          {preferences.data.spaces.length > 0 ? (
            <section className="fm-stack">
              <h2 className="font-display text-lg font-semibold">Par espace</h2>
              <span className="text-sm text-ink-muted">
                Pour un grand espace bavard, garde l'essentiel.
              </span>
              <nav aria-label="Préférences par espace" className="flex flex-col">
                {preferences.data.spaces.map((item) => {
                  const info = space(item.spaceId);
                  const name = info?.name ?? "Espace";
                  return (
                    <button
                      key={item.spaceId}
                      type="button"
                      className="fm-option"
                      onClick={() => {
                        setOpen(item.spaceId);
                      }}
                    >
                      <Avatar name={name} src={info?.avatarUrl} tint={info?.tintIndex} size={32} />
                      <span className="fm-option-text">
                        <b>{name}</b>
                        <small>{modeLabel(item)}</small>
                      </span>
                      <Icon name="chevron-right" className="fm-option-go" />
                    </button>
                  );
                })}
              </nav>
            </section>
          ) : null}
        </>
      ) : (
        <Skeleton count={4} />
      )}
      {opened ? (
        <SpaceSheet
          key={opened.spaceId}
          name={space(opened.spaceId)?.name ?? "Espace"}
          space={opened}
          onClose={() => {
            setOpen(null);
          }}
        />
      ) : null}
    </ProfileLayout>
  );
}
