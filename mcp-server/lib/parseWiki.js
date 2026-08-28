import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const WIKILINK_RE = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
// Matches "- raw/some/path.md — some note" or "- raw/some/path.md - note"
const SOURCE_LINE_RE = /^-\s+(raw\/\S+)\s*(?:[—-]\s*(.*))?$/;
const DEFAULT_TIER_BY_TYPE = {
  person: 1,
  organization: 1,
  concept: 2,
  tool: 2,
  source: 3,
};

export function getDefaultTier(type) {
  return DEFAULT_TIER_BY_TYPE[type] || 1;
}

export function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extract the first non-empty paragraph after the H1 heading as the summary. */
function extractSummary(body) {
  const lines = body.split("\n");
  let seenH1 = false;
  const paragraph = [];
  for (const line of lines) {
    if (!seenH1) {
      if (/^#\s+/.test(line)) seenH1 = true;
      continue;
    }
    if (/^##\s+/.test(line)) break; // hit next section before finding text
    if (line.trim() === "") {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line.trim());
  }
  return paragraph.join(" ").trim() || null;
}

function extractSection(body, heading) {
  const lines = body.split("\n");
  const startIdx = lines.findIndex((l) =>
    new RegExp(`^##\\s+${heading}\\s*$`, "i").test(l.trim())
  );
  if (startIdx === -1) return [];
  const section = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    section.push(lines[i]);
  }
  return section;
}

function extractLinks(body) {
  const links = [];
  const seen = new Set();
  let match;
  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(body)) !== null) {
    const title = match[1].trim();
    const slug = slugify(title);
    if (seen.has(slug)) continue;
    seen.add(slug);
    links.push({ toSlug: slug, toTitle: title });
  }
  return links;
}

function extractSources(body) {
  const sourceLines = extractSection(body, "Sources");
  const sources = [];
  for (const line of sourceLines) {
    const m = SOURCE_LINE_RE.exec(line.trim());
    if (m) {
      sources.push({ rawPath: m[1], note: m[2] || null });
    }
  }
  return sources;
}

/** Parse a single wiki/pages/<slug>.md file into a structured record. */
export function parsePageFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const slug = path.basename(filePath, ".md");
  const type = data.type || "concept";
  const tier = data.tier === undefined ? getDefaultTier(type) : Number(data.tier);
  if (![1, 2, 3].includes(tier)) {
    throw new Error(`${filePath}: tier must be 1, 2, or 3`);
  }

  return {
    slug,
    title: data.title || slug,
    type,
    tier,
    tags: Array.isArray(data.tags) ? data.tags : [],
    created: data.created || null,
    updated: data.updated || null,
    summary: extractSummary(content),
    body: content.trim(),
    filePath,
    links: extractLinks(content),
    sources: extractSources(content),
  };
}

/** Parse every *.md file under wiki/pages/. */
export function parseAllPages(wikiPagesDir) {
  const files = fs
    .readdirSync(wikiPagesDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(wikiPagesDir, f));
  return files.map(parsePageFile);
}
