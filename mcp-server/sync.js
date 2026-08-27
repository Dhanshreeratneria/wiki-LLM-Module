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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WIKI_ROOT = path.resolve(
  __dirname,
  process.env.WIKI_ROOT || ".."
);
const PAGES_DIR = path.join(WIKI_ROOT, "wiki", "pages");
const LOG_FILE = path.join(WIKI_ROOT, "wiki", "log.md");

async function ensureSchema() {
  const schemaPath = path.join(WIKI_ROOT, "db", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Could not find ${schemaPath}. Check WIKI_ROOT.`);
  }
  await pool.query(fs.readFileSync(schemaPath, "utf-8"));
}

async function syncPages(client, pages) {
  const seenSlugs = new Set();

  for (const page of pages) {
    seenSlugs.add(page.slug);
    const relPath = path.relative(WIKI_ROOT, page.filePath);

    await client.query(
      `INSERT INTO pages (slug, title, type, tier, tags, created, updated, summary, body, file_path, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         type = EXCLUDED.type,
         tier = EXCLUDED.tier,
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
        page.tier,
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

// Runs the sync. Does NOT close the shared pool — callers that own the
// pool's lifecycle (e.g. index.js keeping it open to serve requests) are
// expected to do that themselves, if at all.
async function runSync() {
  if (!fs.existsSync(PAGES_DIR)) {
    throw new Error(`Could not find ${PAGES_DIR}. Check WIKI_ROOT.`);
  }

  const pages = parseAllPages(PAGES_DIR);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pageResult = await syncPages(client, pages);
    const logCount = await syncLog(client);
    await client.query("COMMIT");
    return { ...pageResult, logCount };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Only run + exit + close the pool when this file is executed directly
// (`node sync.js` / `npm run sync`), not when imported by index.js.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  ensureSchema()
    .then(() => runSync())
    .then((result) => {
      console.log(
        `[sync] OK — ${result.upserted} pages upserted, ${result.pruned} pruned, ` +
          `${result.logCount} log entries synced.`
      );
      return pool.end();
    })
    .catch(async (err) => {
      console.error("[sync] Failed:", err);
      await pool.end();
      process.exit(1);
    });
}

export { slugify, runSync };
