/**
 * CLI Script: Insert Changelog Entry
 * Usage: node dist/scripts/insertChangelog.js '<json>'
 *
 * Executed inside the backend container via Portainer exec from CI.
 * Receives a JSON string with { version, title, content } and inserts
 * the changelog entry into the database via Prisma.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ChangelogItem {
  text: string;
}

interface ChangelogContent {
  features: ChangelogItem[];
  improvements: ChangelogItem[];
  fixes: ChangelogItem[];
}

interface ChangelogInput {
  version: string;
  title: string;
  content: ChangelogContent;
}

function validateInput(input: unknown): input is ChangelogInput {
  if (!input || typeof input !== "object") return false;

  const obj = input as Record<string, unknown>;

  // Version semver
  if (typeof obj.version !== "string" || !/^\d+\.\d+\.\d+$/.test(obj.version)) {
    console.error("Invalid version format (expected x.y.z)");
    return false;
  }

  // Title
  if (typeof obj.title !== "string" || obj.title.length === 0 || obj.title.length > 200) {
    console.error("Invalid title (1-200 characters)");
    return false;
  }

  // Content
  if (!obj.content || typeof obj.content !== "object") {
    console.error("Missing or invalid content");
    return false;
  }

  const content = obj.content as Record<string, unknown>;
  const categories = ["features", "improvements", "fixes"];

  for (const cat of categories) {
    if (!Array.isArray(content[cat])) {
      console.error(`content.${cat} must be an array`);
      return false;
    }
    for (const item of content[cat] as unknown[]) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof (item as Record<string, unknown>).text !== "string"
      ) {
        console.error(`Each item in content.${cat} must have a text string`);
        return false;
      }
    }
  }

  const c = content as unknown as ChangelogContent;
  if (c.features.length === 0 && c.improvements.length === 0 && c.fixes.length === 0) {
    console.error("Content must have at least one item");
    return false;
  }

  return true;
}

async function main() {
  const jsonArg = process.argv[2];

  if (!jsonArg) {
    console.error("Usage: node dist/scripts/insertChangelog.js '<json>'");
    process.exit(1);
  }

  let input: unknown;
  try {
    input = JSON.parse(jsonArg);
  } catch {
    console.error("Invalid JSON argument");
    process.exit(1);
  }

  if (!validateInput(input)) {
    process.exit(1);
  }

  // Check for duplicate version
  const existing = await prisma.changelogEntry.findUnique({
    where: { version: input.version },
  });

  if (existing) {
    console.error(`Version ${input.version} already exists (id: ${existing.id})`);
    process.exit(1);
  }

  const entry = await prisma.changelogEntry.create({
    data: {
      version: input.version,
      title: input.title,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: input.content as any,
    },
  });

  console.log(JSON.stringify({ success: true, id: entry.id, version: entry.version }));
}

main()
  .catch((e) => {
    console.error("Insert changelog error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
