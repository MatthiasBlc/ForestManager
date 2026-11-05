#!/usr/bin/env node

/**
 * Script de generation de changelog a partir des conventional commits.
 *
 * Usage: node scripts/generate-changelog.js <last_version>
 *   Reads commit list from stdin (one commit per line, format: "<hash> <message>")
 *   Outputs JSON on stdout: { version, title, content }
 *
 * Example:
 *   git log --oneline v1.0.0..HEAD | node scripts/generate-changelog.js 1.0.0
 */

const COMMIT_REGEX =
  /^[a-f0-9]+\s+(feat|fix|refactor|perf|style|chore|test|docs|ci|build)(\([^)]+\))?(!)?\s*:\s*(.+)$/i;
const MERGE_REGEX = /^[a-f0-9]+\s+Merge /i;

// Types qui apparaissent dans le changelog
const TYPE_MAP = {
  feat: "features",
  fix: "fixes",
  refactor: "improvements",
  perf: "improvements",
  style: "improvements",
};

// chore(deps) -> improvements, autres chore -> ignore
function categorizeCommit(type, scope, description) {
  const typeLower = type.toLowerCase();

  if (typeLower === "chore") {
    if (scope && scope.replace(/[()]/g, "").toLowerCase() === "deps") {
      return { category: "improvements", text: description };
    }
    return null; // Ignore other chore
  }

  const category = TYPE_MAP[typeLower];
  if (!category) return null; // test, docs, ci, build -> ignore

  return { category, text: description };
}

function computeNextVersion(lastVersion, hasBreaking, hasFeatures) {
  const parts = lastVersion.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    // Fallback
    return "1.0.0";
  }

  let [major, minor, patch] = parts;

  if (hasBreaking) {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (hasFeatures) {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

function generateTitle(content) {
  const parts = [];
  const { features, improvements, fixes } = content;

  if (features.length > 0) {
    parts.push(`${features.length} nouveaute${features.length > 1 ? "s" : ""}`);
  }
  if (improvements.length > 0) {
    parts.push(`${improvements.length} amelioration${improvements.length > 1 ? "s" : ""}`);
  }
  if (fixes.length > 0) {
    parts.push(`${fixes.length} correction${fixes.length > 1 ? "s" : ""}`);
  }

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const last = parts.pop();
  return (parts.join(", ") + " et " + last).replace(/^./, (c) => c.toUpperCase());
}

async function main() {
  const lastVersion = process.argv[2];
  if (!lastVersion) {
    process.stderr.write(
      "Usage: git log --oneline <tag>..HEAD | node scripts/generate-changelog.js <last_version>\n"
    );
    process.exit(1);
  }

  // Read stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString("utf8").trim();

  if (!input) {
    process.stderr.write("No commits provided on stdin\n");
    process.exit(2);
  }

  const lines = input.split("\n").filter(Boolean);

  const content = {
    features: [],
    improvements: [],
    fixes: [],
  };

  let hasBreaking = false;
  let hasFeatures = false;

  for (const line of lines) {
    // Skip merge commits
    if (MERGE_REGEX.test(line)) continue;

    const match = line.match(COMMIT_REGEX);
    if (!match) continue; // Skip non-conventional commits

    const [, type, scope, breaking, description] = match;

    if (breaking) hasBreaking = true;
    if (type.toLowerCase() === "feat") hasFeatures = true;

    const result = categorizeCommit(type, scope || "", description.trim());
    if (result) {
      content[result.category].push({ text: result.text });
    }
  }

  // Check if there are any user-facing changes
  const totalItems = content.features.length + content.improvements.length + content.fixes.length;
  if (totalItems === 0) {
    process.stderr.write("No user-facing changes found\n");
    process.exit(2); // Exit code 2 = skip (no error, just nothing to do)
  }

  const version = computeNextVersion(lastVersion, hasBreaking, hasFeatures);
  const title = generateTitle(content);

  const output = {
    version,
    title,
    content,
  };

  process.stdout.write(JSON.stringify(output) + "\n");
}

main().catch((e) => {
  process.stderr.write(`Error: ${e.message}\n`);
  process.exit(1);
});
