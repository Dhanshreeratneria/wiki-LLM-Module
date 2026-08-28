# LLM Wiki — Karpathy Pattern

A personal knowledge base built from two folders, an index, and Claude Code.
No vector database. No chunking pipeline. No embeddings. Just markdown files
that an LLM organizes and keeps organized.

## The idea

1. Drop raw source material (transcripts, articles, notes, PDFs — anything
   text-readable) into `raw/`.
2. Tell Claude Code to ingest it. Claude reads the raw file, extracts the
   concepts/people/tools/claims worth remembering, and writes or updates
   pages in `wiki/`.
3. Every wiki page gets bidirectional `[[links]]` to related pages and gets
   registered in `wiki/index.md`.
4. Next time you (or an agent) need context, you read `wiki/` — a compact,
   pre-digested set of pages — instead of re-reading every raw source from
   scratch. That's the whole trick: compile once, query cheaply forever.

## Folder structure

```
karpathy-llm-wiki/
├── CLAUDE.md              # ground rules Claude Code reads automatically
├── raw/                   # YOUR source material — human-owned, LLM never writes here
│   ├── transcripts/
│   ├── articles/
│   └── misc/
├── wiki/                  # LLM-maintained knowledge base
│   ├── index.md           # master index: topics, people, tools, sources
│   ├── log.md             # append-only changelog of what was compiled when
│   └── pages/             # one markdown file per concept/person/tool/source
└── .claude/
    └── commands/          # slash commands that drive the pipeline
        ├── wiki-ingest.md
        ├── wiki-compile.md
        ├── wiki-query.md
        ├── wiki-lint.md
        └── wiki-audit.md
```

## Setup (5 minutes)

1. Unzip this folder and open it in **Claude Code** (or in Obsidian for
   browsing — Obsidian is optional, it's just a nice front-end for the
   `wiki/` graph/backlinks view, but any editor or plain `ls`/`cat` works
   fine since it's all just markdown).
2. In Claude Code, run `claude` inside this folder so it picks up
   `CLAUDE.md` automatically.
3. Drop a few source files into `raw/transcripts/`, `raw/articles/`, or
   `raw/misc/`.
4. Run `/wiki-ingest` (or just say "ingest the new files in raw/") to have
   Claude compile them into `wiki/`.
5. Run `/wiki-compile` periodically to backfill links and refresh
   `wiki/index.md` as the wiki grows.
6. Ask Claude questions — with `/wiki-query` or normally — and it will
   answer from `wiki/`, not from re-reading `raw/` or guessing from memory.

## The ownership rule (important)

- **`raw/` is human-owned.** You put things there. Claude reads it but
  **never writes to it**. It's your immutable source of truth — if the LLM
  ever gets something wrong in the wiki, you can always trace back to the
  raw source and correct the wiki page.
- **`wiki/` is LLM-owned.** Claude writes, edits, and reorganizes it. You
  can read and hand-edit it too, but the LLM is expected to keep it
  internally consistent (index, backlinks, log).
- Never let raw AI-generated "journaling" or scratch thoughts leak into
  `raw/` — it contaminates the source of truth. Keep Claude's own planning
  files in `.claude/`, not in either folder.

## Optional: PostgreSQL index + MCP server

The markdown in `wiki/` is always the source of truth, but once the wiki
grows, grepping/reading files by hand (or having an agent load them all into
context) gets slow. This project can optionally maintain a **PostgreSQL
index** of `wiki/` — full-text search, tags, and the link graph — served to
any MCP client (Claude Desktop, Claude Code, etc.) through a small **MCP
server**. Postgres is a rebuildable cache; if you ever doubt it, drop it and
re-run the sync script.

```
karpathy-llm-wiki/
├── db/
│   └── schema.sql              # Postgres schema (pages, links, sources, log)
├── mcp-server/
│   ├── package.json
│   ├── .env.example            # DATABASE_URL goes in a copy of this: .env
│   ├── sync.js                 # markdown wiki/  ->  Postgres (rerun anytime)
│   ├── index.js                # the MCP server (stdio transport)
│   └── lib/
│       ├── db.js                # pg connection pool
│       └── parseWiki.js         # frontmatter / links / sources parser
├── .mcp.json                    # registers the server for Claude Code
└── claude_desktop_config.snippet.json   # example for Claude Desktop
```

### 1. Install PostgreSQL

- macOS: `brew install postgresql@16 && brew services start postgresql@16`
- Ubuntu/Debian: `sudo apt install postgresql && sudo systemctl start postgresql`
- Or use Docker, no local install needed:
  ```bash
  docker run --name llm-wiki-pg -e POSTGRES_USER=wiki_user \
    -e POSTGRES_PASSWORD=wiki_pass -e POSTGRES_DB=llm_wiki \
    -p 5432:5432 -d postgres:16
  ```

### 2. Create the database and schema

```bash
# skip createuser/createdb if you used the Docker command above
createuser wiki_user -P            # set password: wiki_pass (or your own)
createdb -O wiki_user llm_wiki

psql "postgresql://wiki_user:wiki_pass@localhost:5432/llm_wiki" \
  -f db/schema.sql
```

### 3. Install the MCP server's dependencies

```bash
cd mcp-server
npm install
cp .env.example .env
# edit .env if your DATABASE_URL or WIKI_ROOT differ from the defaults
```

### 4. Sync the markdown wiki into Postgres

Run this once now, and again any time `wiki/` changes (e.g. after
`/wiki-ingest` or `/wiki-compile`):

```bash
npm run sync
```

This upserts every `wiki/pages/*.md` file into `pages`, rebuilds the
`page_links` / `page_sources` tables from each page's `[[links]]` and
`## Sources`, mirrors `wiki/log.md` into `wiki_log`, and prunes rows for
pages that no longer exist on disk.

### 5. Run the MCP server

```bash
npm start          # runs `node index.js`, listens on stdio
```

It exposes these tools to any connected MCP client:

| Tool | What it does |
|---|---|
| `wiki_search` | Full-text search across title/tags/summary/body |
| `wiki_get_page` | Fetch one page in full, by title or slug |
| `wiki_list_pages` | Browse/filter pages by `type` or `tag` |
| `wiki_related` | One-hop link graph (incoming + outgoing) for a page |
| `wiki_lint` | Reports broken `[[links]]` and one-directional links |
| `wiki_recent_log` | Recent entries from `wiki/log.md` |

### 6. Add it to Claude

**Claude Code** — already wired up. `.mcp.json` at the project root
registers the server, so running `claude` inside `karpathy-llm-wiki/` picks
it up automatically (you'll be prompted to approve the project's MCP server
the first time). No extra steps needed.

**Claude Desktop** — merge `claude_desktop_config.snippet.json` into your
Desktop config, replacing the placeholder path with the absolute path to
this project on your machine:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Then fully restart Claude Desktop. You should see "llm-wiki" listed under
the MCP/tools icon, with the six tools above available in chat.

Once connected, you can ask Claude things like *"search the wiki for
attention mechanism"* or *"what links to Andrej Karpathy's page?"* and it
will call the MCP tools instead of reading every markdown file.

## Deploy three access tiers on Render

This repository includes `render.yaml`, which defines one PostgreSQL database
and three Node web services. In Render, create a Blueprint from this repo and
deploy it. Each service runs the same MCP code at `/mcp`, but receives a
different `ACCESS_TIER` value:

| Service | `ACCESS_TIER` | Visible pages |
|---|---|---|
| MCP 1 (`llm-wiki-mcp-1`) | `all` | Tiers 1, 2, and 3 |
| MCP 2 (`llm-wiki-mcp-2`) | `tier2-3` | Tiers 2 and 3 |
| MCP 3 (`llm-wiki-mcp-3`) | `tier3` | Tier 3 only |

Pages without an explicit `tier` use an automatic default based on their YAML
`type`: `person` and `organization` pages are Tier 1, `concept` and `tool`
pages are Tier 2, and `source` pages are Tier 3. An explicit `tier` overrides
this default:

```yaml
---
title: Example Page
type: concept
tier: 3
tags: [example]
---
```

Audit classification before deploying:

```bash
cd mcp-server
npm run tier-audit
```

The command prints the count and filename of every page in each tier, followed
by pages using an automatic type default. It exits successfully when all pages
have valid explicit tiers or supported type-based defaults.

Render supplies `DATABASE_URL` to all three services from the shared database.
The server applies the tier filter to search, page fetches, listings, and
related-page results. After changing wiki files, redeploy so the boot-time
sync refreshes PostgreSQL. The resulting MCP URLs are the service URLs with
`/mcp` appended. Use `/healthz` for a simple health check.

With the service names in `render.yaml`, the resulting endpoints are:

```text
MCP 1: https://llm-wiki-mcp-1.onrender.com/mcp
MCP 2: https://llm-wiki-mcp-2.onrender.com/mcp
MCP 3: https://llm-wiki-mcp-3.onrender.com/mcp
```

`render_mcp_config.snippet.json` contains the same three URLs in MCP client
configuration format. Merge only the endpoint you intend to trust into your
Claude configuration, and protect the Render services with access controls or
an authenticated proxy when the knowledge base is not public.

Treat the tier URLs as separate trust boundaries: protect them with Render
access controls or an authenticated proxy if the endpoints must not be public.

## Scaling notes

Karpathy reported this holding up fine at roughly ~100 source articles and
~400K words, with the LLM keeping `wiki/index.md` current as an
auto-maintained table of contents. At that scale, a well-maintained index
means Claude only has to load the handful of wiki pages relevant to a given
question — not the whole corpus, and not a RAG pipeline. If your corpus
grows much larger than that, consider splitting `wiki/index.md` into
per-topic sub-indexes, but the two-folder pattern itself doesn't need to
change.
