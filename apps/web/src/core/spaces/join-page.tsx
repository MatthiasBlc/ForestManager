// E-REJOINDRE (D62) : apercu de l'espace par le lien, puis un clic pour rejoindre.
// Sans session, l'apercu reste visible et le lien survit a l'inscription ou la connexion.
import { inviteLinkPreviewSchema, spaceDetailSchema } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { SpaceIcon } from "../../patterns/space-icon.tsx";
import { Button } from "../../ui/button.tsx";
import { Skeleton } from "../../ui/display.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { AuthLayout, FormAlert } from "../access/auth-layout.tsx";
import { meQuery } from "../session/queries.ts";

export function JoinPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const me = useQuery(meQuery);
  const preview = useQuery({
    queryKey: ["invite-link", code],
    queryFn: () => api.get(`/invite-links/${code}`, inviteLinkPreviewSchema),
    retry: false,
  });
  const join = useMutation({
    mutationFn: () => api.post(`/invite-links/${code}/join`, undefined, spaceDetailSchema),
    onSuccess: async (space) => {
      await queryClient.invalidateQueries({ queryKey: ["spaces"] });
      toast(`Bienvenue dans ${space.name}`, { tone: "success" });
      void navigate(`/s/${space.id}`, { replace: true });
    },
  });

  if (preview.isPending || me.isPending) {
    return (
      <AuthLayout title="Invitation">
        <Skeleton />
      </AuthLayout>
    );
  }
  if (preview.isError) {
    return (
      <AuthLayout title="Lien invalide">
        <p>{errorMessage(preview.error)}</p>
        <p className="text-ink-muted">Demande un nouveau lien à un modérateur de l'espace.</p>
        <Link to="/">Revenir à l'accueil</Link>
      </AuthLayout>
    );
  }

  const { space, expiresAt } = preview.data;
  const next = encodeURIComponent(`/join/${code}`);
  return (
    <AuthLayout title={`Rejoindre ${space.name}`}>
      <div className="fm-option">
        <SpaceIcon
          space={{ id: code, name: space.name, tint: space.tintIndex, image: space.avatarUrl }}
        />
        <span className="fm-option-text">
          <b>{space.name}</b>
          <small>
            {space.memberCount} membre{space.memberCount > 1 ? "s" : ""} · lien valable jusqu'au{" "}
            {new Date(expiresAt).toLocaleDateString("fr-FR")}
          </small>
        </span>
      </div>
      {me.data ? (
        <>
          <FormAlert message={join.isError ? errorMessage(join.error) : undefined} />
          <Button variant="primary" block disabled={join.isPending} onClick={() => join.mutate()}>
            Rejoindre l'espace
          </Button>
          <Link to="/">Plus tard</Link>
        </>
      ) : (
        <>
          <Link to={`/register?next=${next}`} className="fm-btn fm-btn-primary fm-btn-block">
            Créer un compte
          </Link>
          <Link to={`/login?next=${next}`} className="fm-btn fm-btn-secondary fm-btn-block">
            Se connecter
          </Link>
        </>
      )}
    </AuthLayout>
  );
}
