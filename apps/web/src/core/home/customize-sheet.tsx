// Feuille "Personnaliser l'accueil" [D193] : un interrupteur par widget, monter /
// descendre, "Retablir par defaut". Chaque changement est enregistre (D115).
import type { HomeResponse } from "@fm/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { Switch } from "../../ui/controls.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { homeQuery } from "./queries.ts";
import { HOME_WIDGETS } from "./widgets.ts";

export function CustomizeSheet({
  open,
  onClose,
  home,
}: {
  open: boolean;
  onClose: () => void;
  home: HomeResponse;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const save = useMutation({
    mutationFn: (homeWidgets: string[] | null) => api.patch("/me/preferences", { homeWidgets }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: homeQuery.queryKey }),
    onError: (error) => toast(errorMessage(error), { tone: "danger" }),
  });

  const known = home.available.filter((widget) => HOME_WIDGETS[widget.key]);
  const chosen = home.widgets.map((widget) => widget.key).filter((key) => HOME_WIDGETS[key]);
  // Choisis dans leur ordre, puis les autres dans l'ordre du registre.
  const rows = [...chosen, ...known.map((w) => w.key).filter((key) => !chosen.includes(key))];

  const toggle = (key: string, on: boolean) => {
    save.mutate(on ? [...chosen, key] : chosen.filter((k) => k !== key));
  };
  const move = (key: string, step: -1 | 1) => {
    const at = chosen.indexOf(key);
    const next = [...chosen];
    const other = next[at + step];
    if (at < 0 || other === undefined) return;
    next[at + step] = key;
    next[at] = other;
    save.mutate(next);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Personnaliser l'accueil">
      <ul className="fm-stack" aria-label="Widgets">
        {rows.map((key) => {
          const title = HOME_WIDGETS[key]?.title ?? key;
          const at = chosen.indexOf(key);
          return (
            <li key={key} className="flex items-center gap-2">
              <div className="grow">
                <Switch
                  label={title}
                  checked={at >= 0}
                  disabled={save.isPending}
                  onChange={(on) => toggle(key, on)}
                />
              </div>
              <IconButton
                icon="arrow-up"
                label={`Monter ${title}`}
                disabled={at <= 0 || save.isPending}
                onClick={() => move(key, -1)}
              />
              <IconButton
                icon="arrow-down"
                label={`Descendre ${title}`}
                disabled={at < 0 || at >= chosen.length - 1 || save.isPending}
                onClick={() => move(key, 1)}
              />
            </li>
          );
        })}
      </ul>
      <SheetFooter>
        <Button block disabled={!home.custom || save.isPending} onClick={() => save.mutate(null)}>
          Rétablir par défaut
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
