// A13 : reglages de la plateforme, en lecture seule [D135]. Les services se
// configurent par variables d'environnement dans la stack (Portainer) ; ici on
// verifie leur etat et on les teste. Aucun secret n'est affiche.
import {
  platformSettingsSchema,
  serviceTestResultSchema,
  type ServiceTest,
  type ServiceTestResult,
} from "@fm/shared";
import { useMutation, useQuery } from "@tanstack/react-query";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { Badge, Skeleton } from "../../ui/display.tsx";
import { Icon, type IconName } from "../../ui/icon.tsx";
import { FormAlert } from "../access/auth-layout.tsx";

interface ServiceCard {
  id: string;
  name: string;
  icon: IconName;
  role: string;
  status: { label: string; tone: "success" | "warning" | "neutral" };
  rows: [string, string][];
  effect: string;
  test?: { service: ServiceTest; label: string; disabledHint?: string };
}

function ServiceSection({ card }: { card: ServiceCard }) {
  const test = useMutation({
    mutationFn: (service: ServiceTest) =>
      api.post(`/admin/settings/test/${service}`, undefined, serviceTestResultSchema),
  });
  const result: ServiceTestResult | undefined = test.data;
  const titleId = `service-${card.id}`;
  return (
    <section
      aria-labelledby={titleId}
      className="flex max-w-3xl flex-col gap-3 rounded-lg border border-line bg-surface-raised p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-accent-soft text-accent-text">
          <Icon name={card.icon} />
        </span>
        <div className="flex flex-1 flex-col">
          <h2 id={titleId} className="m-0 font-display text-lg font-bold">
            {card.name}
          </h2>
          <span className="text-sm text-ink-muted">{card.role}</span>
        </div>
        <Badge tone={card.status.tone}>{card.status.label}</Badge>
      </div>
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        {card.rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-ink-muted">{key}</dt>
            <dd className="m-0 font-mono break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-sm">{card.effect}</p>
      {card.test ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            icon="refresh"
            disabled={card.test.disabledHint !== undefined || test.isPending}
            onClick={() => {
              if (card.test) test.mutate(card.test.service);
            }}
          >
            {card.test.label}
          </Button>
          <span
            role="status"
            className={`text-sm ${result && !result.ok ? "text-danger-text" : "text-ink-muted"}`}
          >
            {test.error
              ? errorMessage(test.error)
              : (result?.message ?? card.test.disabledHint ?? "")}
          </span>
        </div>
      ) : null}
    </section>
  );
}

export function SettingsPage() {
  const settings = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get("/admin/settings", platformSettingsSchema),
  });
  const intro = (
    <div className="flex flex-col gap-1">
      <h1 className="m-0 font-display text-2xl font-bold">Réglages de la plateforme</h1>
      <p className="m-0 text-ink-muted">
        Ces services se configurent par variables d&apos;environnement dans la stack (Portainer),
        puis un redémarrage. Ici, tu vérifies leur état et tu les testes ; aucun secret n&apos;est
        affiché.
      </p>
    </div>
  );
  if (settings.isPending)
    return (
      <>
        {intro}
        <Skeleton label="Chargement des réglages" />
      </>
    );
  if (settings.isError)
    return (
      <>
        {intro}
        <FormAlert message={errorMessage(settings.error)} />
      </>
    );
  const { email, storage, errorTracking } = settings.data;
  const cards: ServiceCard[] = [
    {
      id: "email",
      name: "Envoi d'e-mails (SMTP)",
      icon: "mail",
      role: "Vérification des adresses, mot de passe oublié, invitations par e-mail.",
      status: email.configured
        ? { label: "Configuré", tone: "success" }
        : { label: "Non configuré", tone: "warning" },
      rows: [
        ["Serveur", email.server ? `SMTP_URL = ${email.server}` : "SMTP_URL (absente)"],
        ["Expéditeur", `SMTP_FROM = ${email.from}`],
      ],
      effect: email.configured
        ? "Les e-mails partent de cette adresse. Le test t'envoie un e-mail à ton adresse d'administrateur."
        : "Sans SMTP, tout fonctionne : l'inscription ne demande pas de vérification, « mot de passe oublié » est masqué et tu réinitialises les mots de passe depuis Utilisateurs.",
      test: {
        service: "email",
        label: "Envoyer un e-mail de test",
        ...(email.configured ? {} : { disabledHint: "Disponible une fois SMTP_URL renseignée." }),
      },
    },
    {
      id: "errors",
      name: "Suivi des erreurs (Bugsink)",
      icon: "shield",
      role: "Recevra les erreurs de l'application et du navigateur.",
      status: errorTracking.configured
        ? { label: "Connecté", tone: "success" }
        : { label: "Pas encore branché", tone: "neutral" },
      rows: [["Variable", "SENTRY_DSN (prévue)"]],
      effect:
        "Le SDK Sentry n'est pas encore intégré : il arrivera avec la mise en préproduction. Changer d'outil de suivi ne demandera que de changer le DSN.",
    },
    {
      id: "storage",
      name: "Stockage des photos (S3)",
      icon: "camera",
      role: "Photos des recettes et avatars, servies par liens signés de courte durée.",
      status: storage.configured
        ? { label: "Configuré", tone: "success" }
        : { label: "Non configuré", tone: "warning" },
      rows: [
        [
          "Point d'accès",
          storage.endpoint ? `MINIO_ENDPOINT = ${storage.endpoint}` : "MINIO_ENDPOINT (absente)",
        ],
        ["Compartiment", storage.bucket ? `MINIO_BUCKET = ${storage.bucket}` : "-"],
        ["Adresse publique", storage.publicUrl ?? "-"],
        ["Clés d'accès", "MINIO_ACCESS_KEY, MINIO_SECRET_KEY (masquées)"],
      ],
      effect: storage.configured
        ? "Les photos sont converties en WebP et redimensionnées dans le navigateur avant l'envoi."
        : "Sans stockage, l'application fonctionne sans photos.",
      test: {
        service: "storage",
        label: "Tester la connexion",
        ...(storage.configured
          ? {}
          : { disabledHint: "Disponible une fois MINIO_ENDPOINT renseignée." }),
      },
    },
  ];
  return (
    <>
      {intro}
      {cards.map((card) => (
        <ServiceSection key={card.id} card={card} />
      ))}
    </>
  );
}
