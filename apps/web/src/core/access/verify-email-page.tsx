// Lien de confirmation d'email (envoye par l'API vers /verify-email?token=...).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Skeleton } from "../../ui/display.tsx";
import { AuthLayout } from "./auth-layout.tsx";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const token = params.get("token") ?? "";
  const verify = useMutation({
    mutationFn: () => api.post("/auth/verify-email", { token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
  const { mutate } = verify;
  useEffect(() => {
    mutate();
  }, [mutate]);

  if (verify.isSuccess) {
    return (
      <AuthLayout title="Adresse confirmée">
        <p className="text-ink-muted">Merci, ton adresse e-mail est confirmée.</p>
        <Link to="/" className="fm-btn fm-btn-primary fm-btn-block">
          Continuer
        </Link>
      </AuthLayout>
    );
  }
  if (verify.isError) {
    return (
      <AuthLayout title="Confirmation impossible">
        <p>{errorMessage(verify.error)}</p>
        <Link to="/">Revenir à l'accueil</Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Confirmation en cours">
      <Skeleton />
    </AuthLayout>
  );
}
