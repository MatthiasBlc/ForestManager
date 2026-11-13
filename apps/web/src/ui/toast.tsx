// Toast : confirmation d'une action ("Espace cree"). Radix Toast porte
// l'annonce aux lecteurs d'ecran, la duree et le glisser pour fermer.
import { Toast as RadixToast } from "radix-ui";
import { useCallback, useState, type ReactNode } from "react";

import { Button } from "./button.tsx";
import { cx } from "./cx.ts";
import { ToastContext, type Notify, type ToastOptions } from "./use-toast.ts";

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
  tone: NonNullable<ToastOptions["tone"]>;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const notify = useCallback<Notify>((message, options = {}) => {
    setItems((current) => [...current, { id: nextId++, message, tone: "neutral", ...options }]);
  }, []);
  const remove = (id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };
  return (
    <ToastContext.Provider value={notify}>
      <RadixToast.Provider swipeDirection="down" duration={4000} label="Notification">
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            className={cx("fm-toast", item.tone !== "neutral" && `fm-toast-${item.tone}`)}
            type={item.tone === "danger" ? "foreground" : "background"}
            onOpenChange={(open) => {
              if (!open) remove(item.id);
            }}
          >
            <i className="fm-toast-dot" aria-hidden="true" />
            <RadixToast.Description asChild>
              <span>{item.message}</span>
            </RadixToast.Description>
            {item.action ? (
              <RadixToast.Action asChild altText={item.action.label}>
                <Button variant="ghost" size="sm" onClick={item.action.onAction}>
                  {item.action.label}
                </Button>
              </RadixToast.Action>
            ) : null}
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fm-toasts fm-root" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
