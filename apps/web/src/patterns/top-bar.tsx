// TopBar : bouton d'espace (mobile) ou titre, recherche et notifications (C6),
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
  /** Recherche et notifications arrivent en C6 : sans rappel, rien n'est affiche. */
  onSearch?: () => void;
  onNotifications?: () => void;
  unread?: number;
  user?: { name: string; to: string; avatarUrl?: string | null };
  onCancel?: undefined;
  action?: undefined;
}

interface EditProps {
  title: string;
  onCancel: () => void;
  cancelLabel?: string;
  action?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}

export function TopBar(props: ViewProps | EditProps) {
  if (props.onCancel) {
    return (
      <header className="fm-top fm-top-edit">
        <Button variant="ghost" size="sm" onClick={props.onCancel}>
          {props.cancelLabel ?? "Annuler"}
        </Button>
        <span className="fm-top-title fm-top-edit-title">{props.title}</span>
        {props.action ? (
          <Button
            variant="primary"
            size="sm"
            disabled={props.actionDisabled}
            onClick={props.onAction}
          >
            {props.action}
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
        <IconButton icon="bell" label="Notifications" count={unread} onClick={onNotifications} />
      ) : null}
      {user ? (
        <Link to={user.to} aria-label={`Profil de ${user.name}`} className="rounded-full">
          <Avatar name={user.name} src={user.avatarUrl} size={32} />
        </Link>
      ) : null}
    </header>
  );
}
