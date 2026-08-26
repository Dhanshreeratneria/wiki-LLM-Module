// Rebuilds the Postgres index from the markdown wiki (the source of truth).
// Safe to run repeatedly — it's a full upsert + prune, not append-only.
//
// Usage:
//   npm run sync
//   node sync.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./lib/db.js";
import { parseAllPages, slugify } from "./lib/parseWiki.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIKI_ROOT = path.resolve(
  __dirname,
  process.env.WIKI_ROOT || ".."
);
const PAGES_DIR = path.join(WIKI_ROOT, "wiki", "pages");
const LOG_FILE = path.join(WIKI_ROOT, "wiki", "log.md");

async function syncPages(client, pages) {
  const seenSlugs = new Set();

  for (const page of pages) {
    seenSlugs.add(page.slug);
    const relPath = path.relative(WIKI_ROOT, page.filePath);

    await client.query(
      `INSERT INTO pages (slug, title, type, tags, created, updated, summary, body, file_path, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         type = EXCLUDED.type,
         tags = EXCLUDED.tags,
         created = EXCLUDED.created,
         updated = EXCLUDED.updated,
         summary = EXCLUDED.summary,
         body = EXCLUDED.body,
         file_path = EXCLUDED.file_path,
         synced_at = now()`,
      [
        page.slug,
        page.title,
        page.type,
        page.tags,
        page.created,
        page.updated,
        page.summary,
        page.body,
        relPath,
      ]
    );

    await client.query(`DELETE FROM page_links WHERE from_slug = $1`, [page.slug]);
    for (const link of page.links) {
      await client.query(
        `INSERT INTO page_links (from_slug, to_slug, to_title)
         VALUES ($1, $2, $3)
         ON CONFLICT (from_slug, to_slug) DO UPDATE SET to_title = EXCLUDED.to_title`,
        [page.slug, link.toSlug, link.toTitle]
      );
    }

    await client.query(`DELETE FROM page_sources WHERE slug = $1`, [page.slug]);
    for (const src of page.sources) {
      await client.query(
        `INSERT INTO page_sources (slug, raw_path, note)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug, raw_path) DO UPDATE SET note = EXCLUDED.note`,
        [page.slug, src.rawPath, src.note]
      );
    }
  }

  // Prune pages that no longer exist on disk (keeps the index honest).
  const { rows: existing } = await client.query(`SELECT slug FROM pages`);
  const toDelete = existing
    .map((r) => r.slug)
    .filter((slug) => !seenSlugs.has(slug));
  for (const slug of toDelete) {
    await client.query(`DELETE FROM pages WHERE slug = $1`, [slug]);
  }

  return { upserted: pages.length, pruned: toDelete.length };
}

async function syncLog(client) {
  if (!fs.existsSync(LOG_FILE)) return 0;
  const lines = fs
    .readFileSync(LOG_FILE, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-") || /^\d{4}-\d{2}-\d{2}/.test(l));

  await client.query(`TRUNCATE wiki_log`);
  for (const line of lines) {
    await client.query(`INSERT INTO wiki_log (raw_entry) VALUES ($1)`, [line]);
  }
  return lines.length;
}

async function main() {
  if (!fs.existsSync(PAGES_DIR)) {
    console.error(`[sync] Could not find ${PAGES_DIR}. Check WIKI_ROOT in .env.`);
    process.exit(1);
  }

  const pages = parseAllPages(PAGES_DIR);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pageResult = await syncPages(client, pages);
    const logCount = await syncLog(client);
    await client.query("COMMIT");
    console.log(
      `[sync] OK — ${pageResult.upserted} pages upserted, ${pageResult.pruned} pruned, ` +
        `${logCount} log entries synced.`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[sync] Failed:", err);
  process.exit(1);
});

export { slugify };
