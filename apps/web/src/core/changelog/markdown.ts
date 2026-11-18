// Markdown en ligne des notes de version [D226] : **gras**, *italique*, `code` et
// [lien](https://...). Sous-ensemble ferme, sans imbrication ; tout le reste, HTML
// compris, reste du texte. Le rendu passe par React (jamais de HTML injecte).

export type InlinePart =
  | { type: "text" | "strong" | "em" | "code"; text: string }
  | { type: "link"; text: string; href: string };

// Une alternative par marque ; le contenu ne commence ni ne finit par un espace.
const TOKEN =
  /\*\*([^*\s](?:[^*]*[^*\s])?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s()]+)\)|\*([^*\s](?:[^*]*[^*\s])?)\*/g;

export function parseInline(source: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    const [whole, strong, code, label, href, em] = match;
    if (match.index > last) parts.push({ type: "text", text: source.slice(last, match.index) });
    if (strong !== undefined) parts.push({ type: "strong", text: strong });
    else if (code !== undefined) parts.push({ type: "code", text: code });
    else if (label !== undefined && href !== undefined)
      parts.push({ type: "link", text: label, href });
    else if (em !== undefined) parts.push({ type: "em", text: em });
    last = match.index + whole.length;
  }
  if (last < source.length) parts.push({ type: "text", text: source.slice(last) });
  return parts;
}
