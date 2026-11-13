// E-BIENVENUE (D61) : trois choix, tous passables.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "../../ui/button.tsx";
import { Field } from "../../ui/field.tsx";
import { Icon, type IconName } from "../../ui/icon.tsx";
import { meQuery } from "../session/queries.ts";
import { inviteCodeFrom } from "../spaces/invite-code.ts";
import { AuthLayout } from "./auth-layout.tsx";

function Choice({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: IconName;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="fm-option" onClick={onClick}>
      <span className="fm-option-icon">
        <Icon name={icon} />
      </span>
      <span className="fm-option-text">
        <b>{title}</b>
        <small>{hint}</small>
      </span>
      <Icon name="chevron-right" className="fm-option-go" />
    </button>
  );
}

export function WelcomePage() {
  const navigate = useNavigate();
  const me = useQuery(meQuery);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const code = inviteCodeFrom(link);
  const personal = me.data ? `/s/${me.data.personalSpaceId}` : "/";

  return (
    <AuthLayout title={`Bienvenue, ${me.data?.username ?? ""}`}>
      <p className="text-ink-muted">Par quoi veux-tu commencer ?</p>
      <div className="fm-options">
        <Choice
          icon="users"
          title="Créer un espace"
          hint="Pour ta famille, tes amis, ta colloc."
          onClick={() => void navigate(`${personal}?create=1`)}
        />
        <Choice
          icon="link"
          title="J'ai un lien d'invitation"
          hint="Colle-le pour rejoindre l'espace."
          onClick={() => setLinkOpen(true)}
        />
        <Choice
          icon="book-open"
          title="Ajouter ma première recette"
          hint="À la main, depuis un lien ou un texte collé."
          onClick={() => void navigate(`${personal}/recipes`)}
        />
      </div>
      {linkOpen ? (
        <form
          className="fm-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (code) void navigate(`/join/${code}`);
          }}
        >
          <Field
            label="Lien d'invitation"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            error={link && !code ? "Colle le lien complet reçu." : undefined}
          />
          <Button type="submit" variant="primary" block disabled={!code}>
            Rejoindre
          </Button>
        </form>
      ) : null}
      <Link to={personal}>Plus tard</Link>
    </AuthLayout>
  );
}
