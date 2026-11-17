// Contexte des toasts : useToast() depuis n'importe quel ecran sous <ToastProvider>.
import { createContext, useContext } from "react";

export interface ToastOptions {
  tone?: "neutral" | "success" | "warning" | "danger";
  action?: { label: string; onAction: () => void };
}

export type Notify = (message: string, options?: ToastOptions) => void;

export const ToastContext = createContext<Notify | null>(null);

/** Affiche un toast : `toast("Espace cree", { tone: "success" })`. */
export function useToast(): Notify {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast() must be used inside <ToastProvider>");
  return notify;
}
