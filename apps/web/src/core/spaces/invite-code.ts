// Liens d'invitation : adresse a partager et lecture d'un lien colle.

/** Code d'un lien colle (adresse complete ou code seul). */
export function inviteCodeFrom(text: string): string | null {
  const match = /([A-Za-z0-9_-]{22})\/?\s*$/.exec(text.trim());
  return match?.[1] ?? null;
}

/** Adresse du lien d'invitation a partager. */
export function inviteUrl(code: string): string {
  return new URL(`/join/${code}`, window.location.origin).toString();
}
