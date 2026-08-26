# Project instructions: LLM Wiki

This project implements the "raw/wiki" personal-knowledge-base pattern.
Follow these rules in every session, whether invoked via a slash command or
a plain-language request.

## Ownership rules (strict)

- `raw/**` — human-owned. **Never create, edit, or delete files here.**
  Read-only, always. If asked to "save" or "write" something derived from a
  conversation, it goes in `wiki/`, never `raw/`.
- `wiki/**` — LLM-owned and LLM-maintained. You may create, edit, merge, and
  reorganize files here freely, but always keep `wiki/index.md` and
  `wiki/log.md` consistent with whatever you change.

## Compiling a raw source into the wiki

1. Read the raw file in full.
2. Identify the distinct things worth their own wiki page: concepts,
   people, tools/products, and the source itself (a "source page"
   summarizing what the raw document is and linking out to the
   concept/people/tool pages it touches).
3. For each one:
   - If a matching page already exists in `wiki/pages/`, update it —
     add the new fact/date/quote, don't duplicate the page.
   - If not, create `wiki/pages/<slug>.md` using the page template below.
4. Add bidirectional `[[wikilinks]]`: every page you touch should link to
   every other page it meaningfully relates to, and vice versa. When you
   add a link from A to B, also open B and add the backlink to A if it's
   missing.
5. Update `wiki/index.md`: add the new/changed pages under the right
   section (Topics / People / Tools / Sources).
6. Append one line to `wiki/log.md`: date, what was ingested, what pages
   were created or touched.
7. Mark the raw file as compiled by noting it in `wiki/log.md` — do not
   modify the raw file itself (raw is read-only, including frontmatter).

## Page template

```markdown
---
title: <Page Title>
type: concept | person | tool | source
tags: [tag1, tag2]
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---

# <Page Title>

One or two sentence summary.

## Details

- Key facts, in your own words. Prefer bullets over prose paragraphs so
  future compiles can scan and extend this cheaply.

## Related

- [[Other Page]] — why it's related, in a few words
- [[Another Page]] — why it's related

## Sources

- raw/<path-to-source-file> — what this page drew from it
```

## Optional PostgreSQL index / MCP server

If `mcp-server/` is set up (see README.md) and the `llm-wiki` MCP tools are
available in this session, prefer `wiki_search` / `wiki_get_page` /
`wiki_related` over reading files from `wiki/pages/` directly — it's faster
and avoids loading the whole corpus into context. The Postgres index is a
cache: if it looks stale or a page you just wrote isn't showing up, run
`npm run sync` inside `mcp-server/` (or tell the person to) before trusting
a "not found" result. Postgres and the MCP server never change what's
authoritative — `wiki/*.md` is still the only thing you ever write to.

## Answering questions

When asked a question that the wiki might already answer:

- Read `wiki/index.md` first to find the relevant pages, then read only
  those pages — don't re-read all of `raw/` and don't answer from general
  knowledge/memory when the wiki has an answer.
- If the wiki doesn't cover it, say so, answer as best you can, and offer
  to file the answer back into `wiki/` as a new page (with links back to
  whatever raw sources or reasoning informed it).
- Cite which wiki page(s) an answer came from.

## Style

- Wiki pages are dense and skimmable: bullets over paragraphs, short
  sentences, no filler.
- Never invent facts to fill out a page. If something is uncertain, say so
  in the page rather than smoothing it over.
- Idempotency matters: re-running ingest/compile on the same inputs should
  not create duplicate pages or duplicate log entries.
