// TopBar : bouton d'espace (mobile) ou titre, recherche (C6b) et notifications,
// profil. Mode edition (D136) : Annuler, titre, action principale.
import { Link } from "react-router";

import { Button, IconButton } from "../ui/button.tsx";
import { Avatar } from "../ui/display.tsx";
import { Icon } from "../ui/icon.tsx";
import { SpaceIcon } from "./space-icon.tsx";
import { spaceLabel, type SpaceVisual } from "./space-label.ts";

interface ViewProps {
  title?: string;
  space?: SpaceVisual;
  onSpace?: () => void;
  onBack?: () => void;
  /** Recherche (C6b) et notifications (C6.1) : sans rappel, rien n'est affiche. */
  onSearch?: () => void;
  onNotifications?: () => void;
  unread?: number;
  user?: { name: string; to: string; avatarUrl?: string | null };
  onCancel?: undefined;
  action?: undefined;
}

interface EditProps {
  title: string;
  /** Titre affiche en mobile a la place de `title` (maquettes mobiles). */
  titleShort?: string;
  onCancel: () => void;
  cancelLabel?: string;
  action?: string;
  /** Libelle affiche en mobile ; `action` reste le nom accessible. */
  actionShort?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}

/** Libelle court en mobile, complet en bureau (deux elements, un seul visible). */
function Responsive({ label, short }: { label: string; short: string | undefined }) {
  if (!short) return <>{label}</>;
  return (
    <>
      <span className="fm-mobile-only">{short}</span>
      <span className="fm-wide-only">{label}</span>
    </>
  );
}

export function TopBar(props: ViewProps | EditProps) {
  if (props.onCancel) {
    return (
      <header className="fm-top fm-top-edit">
        <Button variant="ghost" size="sm" onClick={props.onCancel}>
          {props.cancelLabel ?? "Annuler"}
        </Button>
        <span className="fm-top-title fm-top-edit-title">
          <Responsive label={props.title} short={props.titleShort} />
        </span>
        {props.action ? (
          <Button
            variant="primary"
            size="sm"
            disabled={props.actionDisabled}
            onClick={props.onAction}
            aria-label={props.actionShort ? props.action : undefined}
          >
            <Responsive label={props.action} short={props.actionShort} />
          </Button>
        ) : null}
      </header>
    );
  }
  const { title, space, onSpace, onBack, onSearch, onNotifications, unread, user } = props;
  return (
    <header className={space ? "fm-top fm-top-has-space" : "fm-top"}>
      {onBack ? <IconButton icon="arrow-left" label="Retour" onClick={onBack} /> : null}
      {space ? (
        <button
          type="button"
          className="fm-top-space"
          aria-label={`Changer d'espace, espace courant : ${spaceLabel(space)}`}
          aria-haspopup="dialog"
          onClick={onSpace}
        >
          <SpaceIcon space={space} />
          <span className="fm-top-space-text">
            <b>{space.name}</b>
            {title ? <small>{title}</small> : null}
          </span>
          <Icon name="chevron-down" size={16} />
        </button>
      ) : (
        <span className="fm-top-title">{title}</span>
      )}
      <span className="flex-1" />
      {onSearch ? (
        <>
          <button type="button" className="fm-search" onClick={onSearch}>
            <Icon name="search" />
            <span>Rechercher une recette, un ingrédient, un membre</span>
            <span className="fm-kbd">Ctrl K</span>
          </button>
          <IconButton
            icon="search"
            label="Rechercher"
            className="fm-top-search-mobile"
            onClick={onSearch}
          />
        </>
      ) : null}
      {onNotifications ? (
        <IconButton
          icon="bell"
          label={unread ? `Notifications, ${String(unread)} non lues` : "Notifications"}
          count={unread}
          onClick={onNotifications}
        />
      ) : null}
      {user ? (
        <Link to={user.to} aria-label={`Profil de ${user.name}`} className="rounded-full">
          <Avatar name={user.name} src={user.avatarUrl} size={32} />
        </Link>
      ) : null}
    </header>
  );
}
