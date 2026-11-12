// Button et IconButton du design system.
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./cx.ts";
import { Icon, type IconName } from "./icon.tsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary : une seule fois par ecran ; danger : apres une confirmation. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  icon?: IconName;
  block?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  block,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cx(
        "fm-btn",
        `fm-btn-${variant}`,
        size === "sm" && "fm-btn-sm",
        block && "fm-btn-block",
        className
      )}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** Nom accessible (obligatoire : le bouton n'a pas de texte). */
  label: string;
  count?: number;
  outline?: boolean;
}

export function IconButton({
  icon,
  label,
  count,
  outline,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      {...rest}
      className={cx("fm-iconbtn", outline && "fm-iconbtn-outline", className)}
    >
      <Icon name={icon} />
      {count ? (
        <span className="fm-count" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
