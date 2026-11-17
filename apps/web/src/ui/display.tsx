// Affichage : Badge, Avatar, EmptyState, Skeleton.
import type { ReactNode } from "react";

import { cx } from "./cx.ts";
import { Icon, type IconName } from "./icon.tsx";
import { initials } from "./initials.ts";

export type Tone = "neutral" | "accent" | "second" | "success" | "warning" | "danger";

export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx("fm-badge", tone !== "neutral" && `fm-badge-${tone}`, className)}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = 32,
  tint,
}: {
  name: string;
  src?: string | null;
  size?: number;
  tint?: number;
}) {
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.4),
    ...(tint
      ? {
          background: `var(--tint-${tint})`,
          color: `var(--on-tint-${tint})`,
          borderColor: "transparent",
        }
      : {}),
  };
  return (
    <span className="fm-avatar" style={style} title={name} aria-label={name} role="img">
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

export function EmptyState({
  icon = "book-open",
  title,
  action,
  children,
}: {
  icon?: IconName;
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="fm-empty">
      <div className="fm-empty-icon">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ?? null}
    </div>
  );
}

/** Etat de chargement : les formes reprennent celles du contenu attendu. */
export function Skeleton({
  kind = "lines",
  count,
  label = "Chargement…",
}: {
  kind?: "lines" | "card" | "row";
  count?: number;
  label?: string;
}) {
  const n = count ?? (kind === "lines" ? 3 : 4);
  const items = Array.from({ length: n }, (_, i) => {
    if (kind === "card") {
      return (
        <div key={i} className="fm-skel-card">
          <i className="fm-skel fm-skel-img" />
          <i className="fm-skel fm-skel-line" style={{ width: "70%" }} />
          <i className="fm-skel fm-skel-line fm-skel-sm" style={{ width: "40%" }} />
        </div>
      );
    }
    if (kind === "row") {
      return (
        <div key={i} className="fm-skel-row">
          <i className="fm-skel fm-skel-dot" />
          <i className="fm-skel fm-skel-line" style={{ width: `${40 + ((i * 17) % 40)}%` }} />
        </div>
      );
    }
    return (
      <i key={i} className="fm-skel fm-skel-line" style={{ width: i === n - 1 ? "60%" : "100%" }} />
    );
  });
  return (
    <div
      className={cx("fm-skeleton", kind === "card" ? "fm-grid" : "fm-stack")}
      role="status"
      aria-label={label}
    >
      {items}
    </div>
  );
}
