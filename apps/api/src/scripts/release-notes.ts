// Notes de version preparees par la CI (C6.6) [D187] : version suivante et items
// tires des commits conventionnels depuis le dernier tag semver. Le resultat
// (release.json) part dans l'image API ; le seed en cree le brouillon, que
// l'admin reformule et publie dans A10.
//
// Sans dependance (la CI le lance avec Node seul, sans `npm ci`) :
//   node apps/api/src/scripts/release-notes.ts                 -> JSON sur stdout
//   node apps/api/src/scripts/release-notes.ts --out <fichier> -> ecrit le fichier
//   node apps/api/src/scripts/release-notes.ts --version       -> version seule
// Le depot doit avoir son historique et ses tags (checkout fetch-depth: 0).

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

/** Champs separes par \x1f, commits par \x1e. */
export const LOG_FORMAT = "%H%x1f%s%x1f%b%x1e";

/** Premiere version de la V2, ecrite a la main [D187]. */
const FIRST_VERSION = "2.0.0";

export interface Commit {
  subject: string;
  body: string;
}

type Section = "features" | "improvements" | "fixes";

export interface ReleaseNotes {
  version: string;
  content: Record<Section, { text: string }[]>;
}

const SECTION_OF: Readonly<Record<string, Section>> = {
  feat: "features",
  perf: "improvements",
  fix: "fixes",
};

/** "type(scope)!: description" */
const CONVENTIONAL = /^(?<type>[a-z]+)(?:\([^)]*\))?(?<breaking>!)?:\s*(?<description>.+)$/;
/** Marqueur final "(C6.5)", "(C3.9, D169)", "(D186)", "(F-ACTIONS)". */
const MARKER = /\s*\((?<marker>[^()]*\b(?:C\d|D\d|F-)[^()]*)\)\s*$/;
const STEP = /\bC\d+(?:\.\d+)?[a-z]?\b/;
const SEMVER_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

export function parseLog(raw: string): Commit[] {
  return raw
    .split("\x1e")
    .map((chunk) => chunk.replace(/^\n/, ""))
    .filter((chunk) => chunk.trim() !== "")
    .map((chunk) => {
      const [, subject = "", body = ""] = chunk.split("\x1f");
      return { subject: subject.trim(), body: body.trim() };
    });
}

function parts(tag: string): [number, number, number] | null {
  const match = SEMVER_TAG.exec(tag);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Plus haut tag `vX.Y.Z` (v1-final et les autres tags sont ignores). */
export function latestTag(tags: readonly string[]): string | null {
  let best: { tag: string; value: [number, number, number] } | null = null;
  for (const tag of tags) {
    const value = parts(tag);
    if (value && isNewer(value, best?.value)) best = { tag, value };
  }
  return best?.tag ?? null;
}

function isNewer(value: [number, number, number], than?: [number, number, number]): boolean {
  if (!than) return true;
  for (let i = 0; i < 3; i++) {
    if (value[i] !== than[i]) return (value[i] ?? 0) > (than[i] ?? 0);
  }
  return false;
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildRelease(tag: string | null, commits: readonly Commit[]): ReleaseNotes {
  const content: ReleaseNotes["content"] = { features: [], improvements: [], fixes: [] };
  const current = tag ? parts(tag) : null;
  if (!current) return { version: FIRST_VERSION, content };

  /** 0 majeure, 1 mineure, 2 corrective, 3 aucun commit conventionnel. */
  let bump = 3;
  /** Une etape (Cx.y) d'une section = un item ; textes joints par " ; ". */
  const groups = new Map<string, { section: Section; texts: string[] }>();

  for (const commit of commits) {
    const match = CONVENTIONAL.exec(commit.subject);
    if (!match?.groups) continue;
    const { type = "", breaking, description = "" } = match.groups;
    const level =
      breaking || /^BREAKING[ -]CHANGE:/m.test(commit.body) ? 0 : type === "feat" ? 1 : 2;
    bump = Math.min(bump, level);
    const section = SECTION_OF[type];
    if (!section) continue;
    const marker = MARKER.exec(description);
    const text = description.replace(MARKER, "").trim();
    const step = marker?.groups?.marker ? STEP.exec(marker.groups.marker)?.[0] : undefined;
    const key = step ? `${section}:${step}` : `${section}:#${String(groups.size)}`;
    const group = groups.get(key) ?? { section, texts: [] };
    if (!group.texts.includes(text)) group.texts.push(text);
    groups.set(key, group);
  }
  for (const { section, texts } of groups.values()) {
    content[section].push({ text: sentence(texts.join(" ; ")) });
  }

  const [major, minor, patch] = current;
  const next: [number, number, number] =
    bump === 0
      ? [major + 1, 0, 0]
      : bump === 1
        ? [major, minor + 1, 0]
        : bump === 2
          ? [major, minor, patch + 1]
          : current;
  return { version: next.join("."), content };
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function main(argv: readonly string[]): void {
  const tag = latestTag(git("tag", "--list", "v[0-9]*", "--merged", "HEAD").split("\n"));
  const range = tag ? [`${tag}..HEAD`] : [];
  const commits = parseLog(git("log", "--no-merges", `--format=${LOG_FORMAT}`, ...range));
  const release = buildRelease(tag, commits);
  if (argv.includes("--version")) {
    process.stdout.write(`${release.version}\n`);
    return;
  }
  const json = `${JSON.stringify(release, null, 2)}\n`;
  const out = argv.indexOf("--out");
  const file = out >= 0 ? argv[out + 1] : undefined;
  if (file) writeFileSync(file, json);
  else process.stdout.write(json);
}

if (import.meta.url === `file://${process.argv[1] ?? ""}`) main(process.argv.slice(2));
