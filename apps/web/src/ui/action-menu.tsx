// ActionMenu : menu d'actions (bouton "..." ou appui long), Radix DropdownMenu
// pour le role, le clavier et le focus.
import { DropdownMenu } from "radix-ui";
import type { ReactElement } from "react";

import { Icon, type IconName } from "./icon.tsx";

export interface ActionItem<Id extends string = string> {
  id: Id;
  label: string;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
}

export interface ActionMenuProps<Id extends string> {
  label: string;
  /** Declencheur (un Button ou un IconButton). */
  trigger: ReactElement;
  items: readonly (ActionItem<Id> | "-")[];
  onSelect: (id: Id) => void;
  /** Ouverture pilotee (appui long). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Desactive toutes les actions (hors ligne, D106) : elles restent visibles. */
  disabled?: boolean;
}

export function ActionMenu<Id extends string>({
  label,
  trigger,
  items,
  onSelect,
  open,
  onOpenChange,
  disabled,
}: ActionMenuProps<Id>) {
  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="fm-menu fm-root"
          aria-label={label}
          aria-labelledby={undefined}
          align="end"
          sideOffset={4}
        >
          {items.map((item, index) =>
            item === "-" ? (
              <DropdownMenu.Separator key={`sep-${index}`} asChild>
                <hr />
              </DropdownMenu.Separator>
            ) : (
              <DropdownMenu.Item
                key={item.id}
                asChild
                disabled={disabled || item.disabled}
                onSelect={() => {
                  onSelect(item.id);
                }}
              >
                <button type="button" className={item.danger ? "fm-danger" : undefined}>
                  {item.icon ? <Icon name={item.icon} /> : null}
                  {item.label}
                </button>
              </DropdownMenu.Item>
            )
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Memes actions en liste, dans une feuille (appui long sur une carte, F-ACTIONS). */
export function ActionList<Id extends string>({
  label,
  items,
  onSelect,
  disabled,
}: Omit<ActionMenuProps<Id>, "trigger" | "open" | "onOpenChange">) {
  return (
    <div className="fm-menu fm-menu-flat" role="group" aria-label={label}>
      {items.map((item, index) =>
        item === "-" ? (
          <hr key={`sep-${index}`} />
        ) : (
          <button
            key={item.id}
            type="button"
            className={item.danger ? "fm-danger" : undefined}
            disabled={disabled || item.disabled}
            onClick={() => {
              onSelect(item.id);
            }}
          >
            {item.icon ? <Icon name={item.icon} /> : null}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
