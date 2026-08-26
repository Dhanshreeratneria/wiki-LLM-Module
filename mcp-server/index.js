// MCP server for the LLM Wiki.
//
// Exposes the PostgreSQL-indexed wiki/ folder as MCP tools so any MCP
// client (Claude Desktop, Claude Code, etc.) can search and read the wiki
// without loading every markdown file into context. wiki/*.md remains the
// source of truth; this server only reads the Postgres index built by
// sync.js — it never writes to raw/ or wiki/.

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { pool } from "./lib/db.js";
import { slugify } from "./lib/parseWiki.js";
import { runSync } from "./sync.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Each tool call needs its own Server instance in HTTP mode (the SDK ties a
// Server to one transport/session); factor construction out so both the
// stdio path and every HTTP session can build a fresh, identically wired one.
function buildServer() {
  const server = new Server(
    { name: "llm-wiki", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      switch (name) {
        case "wiki_search":
          return await toolSearch(args);
        case "wiki_get_page":
          return await toolGetPage(args);
        case "wiki_list_pages":
          return await toolListPages(args);
        case "wiki_related":
          return await toolRelated(args);
        case "wiki_lint":
          return await toolLint();
        case "wiki_recent_log":
          return await toolRecentLog(args);
        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return errorResult(err.message || String(err));
    }
  });
  return server;
}

const TOOLS = [
  {
    name: "wiki_search",
    description:
      "Full-text search over the wiki (titles, tags, summaries, and body). " +
      "Returns matching pages ranked by relevance. Use this before reading " +
      "raw markdown files directly.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "wiki_get_page",
    description:
      "Fetch one wiki page in full by title or slug, including its tags, " +
      "outgoing links, and cited raw sources.",
    inputSchema: {
      type: "object",
      properties: {
        title_or_slug: { type: "string" },
      },
      required: ["title_or_slug"],
    },
  },
  {
    name: "wiki_list_pages",
    description:
      "List wiki pages, optionally filtered by type (concept/person/tool/source) " +
      "or tag. Useful for browsing the index.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["concept", "person", "tool", "source", "organization"] },
        tag: { type: "string" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "wiki_related",
    description:
      "Get the pages linked to and from a given page (its wikilink graph " +
      "neighborhood), one hop out.",
    inputSchema: {
      type: "object",
      properties: {
        title_or_slug: { type: "string" },
      },
      required: ["title_or_slug"],
    },
  },
  {
    name: "wiki_lint",
    description:
      "Report structural issues in the current index: broken [[links]] " +
      "(pointing to pages that don't exist) and one-directional links " +
      "(A links to B but B doesn't link back).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "wiki_recent_log",
    description: "Return the most recent entries from wiki/log.md (the ingest changelog).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max entries (default 20)" },
      },
    },
  },
];

function errorResult(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

async function toolSearch({ query, limit = 10 }) {
  const { rows } = await pool.query(
    `SELECT slug, title, type, tags, summary,
            ts_rank(search_vec, plainto_tsquery('english', $1)) AS rank
     FROM pages
     WHERE search_vec @@ plainto_tsquery('english', $1)
        OR title ILIKE '%' || $1 || '%'
     ORDER BY rank DESC
     LIMIT $2`,
    [query, limit]
  );
  return textResult({ query, count: rows.length, results: rows });
}

async function resolveSlug(titleOrSlug) {
  const candidate = slugify(titleOrSlug);
  const { rows } = await pool.query(
    `SELECT slug FROM pages WHERE slug = $1 OR title ILIKE $2 LIMIT 1`,
    [candidate, titleOrSlug]
  );
  return rows[0]?.slug || null;
}

async function toolGetPage({ title_or_slug }) {
  const slug = await resolveSlug(title_or_slug);
  if (!slug) return errorResult(`No page found matching "${title_or_slug}"`);

  const { rows: pageRows } = await pool.query(`SELECT * FROM pages WHERE slug = $1`, [slug]);
  const { rows: links } = await pool.query(
    `SELECT to_slug, to_title FROM page_links WHERE from_slug = $1`,
    [slug]
  );
  const { rows: sources } = await pool.query(
    `SELECT raw_path, note FROM page_sources WHERE slug = $1`,
    [slug]
  );
  const page = pageRows[0];
  delete page.search_vec;
  return textResult({ ...page, links, sources });
}

async function toolListPages({ type, tag, limit = 50 }) {
  const conditions = [];
  const params = [];
  if (type) {
    params.push(type);
    conditions.push(`type = $${params.length}`);
  }
  if (tag) {
    params.push(tag);
    conditions.push(`$${params.length} = ANY(tags)`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT slug, title, type, tags, summary FROM pages ${where}
     ORDER BY title LIMIT $${params.length}`,
    params
  );
  return textResult({ count: rows.length, results: rows });
}

async function toolRelated({ title_or_slug }) {
  const slug = await resolveSlug(title_or_slug);
  if (!slug) return errorResult(`No page found matching "${title_or_slug}"`);

  const { rows: outgoing } = await pool.query(
    `SELECT pl.to_slug, coalesce(p.title, pl.to_title) AS title, p.type
     FROM page_links pl LEFT JOIN pages p ON p.slug = pl.to_slug
     WHERE pl.from_slug = $1`,
    [slug]
  );
  const { rows: incoming } = await pool.query(
    `SELECT pl.from_slug AS slug, p.title, p.type
     FROM page_links pl JOIN pages p ON p.slug = pl.from_slug
     WHERE pl.to_slug = $1`,
    [slug]
  );
  return textResult({ slug, outgoing_links: outgoing, incoming_links: incoming });
}

async function toolLint() {
  const { rows: broken } = await pool.query(`SELECT * FROM broken_links ORDER BY from_slug`);
  const { rows: oneWay } = await pool.query(`SELECT * FROM one_directional_links ORDER BY from_slug`);
  return textResult({
    broken_links: broken,
    one_directional_links: oneWay,
    note: "Run `npm run sync` first if the wiki has changed since the last sync.",
  });
}

async function toolRecentLog({ limit = 20 }) {
  const { rows } = await pool.query(
    `SELECT logged_at, raw_entry FROM wiki_log ORDER BY id DESC LIMIT $1`,
    [limit]
  );
  return textResult({ count: rows.length, entries: rows.reverse() });
}

// Applies db/schema.sql (idempotent — CREATE ... IF NOT EXISTS throughout)
// then upserts every wiki/pages/*.md file into it. Safe to run on every
// boot: it's how a fresh Render Postgres instance gets its tables, and how
// the index picks up wiki changes that shipped since the last deploy.
async function ensureSchemaAndSync() {
  const schemaPath = path.resolve(__dirname, "..", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  await pool.query(schemaSql);
  console.error("[llm-wiki-mcp] Schema ensured.");
  const result = await runSync();
  console.error(
    `[llm-wiki-mcp] Synced — ${result.upserted} pages upserted, ${result.pruned} pruned, ` +
      `${result.logCount} log entries.`
  );
}

// Local/editor use: `npm start` with no PORT set talks MCP over stdio to
// whatever spawned it (Claude Code, Claude Desktop, .mcp.json), exactly as
// before.
async function runStdio() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[llm-wiki-mcp] MCP server running on stdio.");
}

// Hosted use (Render, or anywhere else that sets PORT): speak MCP over
// Streamable HTTP at POST/GET/DELETE /mcp, per the spec's stateful-session
// flow. One Server+transport pair per session, keyed by the
// mcp-session-id header the SDK issues on initialize.
async function runHttp(port) {
  await ensureSchemaAndSync();

  const sessions = new Map(); // sessionId -> { server, transport }

  const httpServer = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    if (req.url !== "/mcp") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found. MCP endpoint is at /mcp.");
      return;
    }

    try {
      const sessionId = req.headers["mcp-session-id"];
      let entry = sessionId ? sessions.get(sessionId) : undefined;

      if (!entry && req.method === "POST") {
        // New session: only valid on an initialize request, per spec.
        const server = buildServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, entry);
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) sessions.delete(transport.sessionId);
        };
        entry = { server, transport };
        await server.connect(transport);
      }

      if (!entry) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No active session for mcp-session-id." }));
        return;
      }

      await entry.transport.handleRequest(req, res);
    } catch (err) {
      console.error("[llm-wiki-mcp] Request error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || String(err) }));
      }
    }
  });

  httpServer.listen(port, () => {
    console.error(`[llm-wiki-mcp] MCP server listening on :${port} (POST/GET/DELETE /mcp)`);
  });
}

const port = process.env.PORT ? Number(process.env.PORT) : null;
const main = port ? () => runHttp(port) : runStdio;

main().catch((err) => {
  console.error("[llm-wiki-mcp] Fatal error:", err);
  process.exit(1);
});
