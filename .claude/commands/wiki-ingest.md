Ingest any raw sources that haven't been compiled into the wiki yet.

Steps:

1. List every file under `raw/` (recursively).
2. Cross-reference against `wiki/log.md` to find which raw files have
   already been compiled. Only process files that are new or that you
   have reason to believe changed.
3. For each uncompiled file, follow the "Compiling a raw source into the
   wiki" procedure in `CLAUDE.md` exactly: extract concepts/people/tools,
   create or update the corresponding pages in `wiki/pages/`, add
   bidirectional `[[links]]`, update `wiki/index.md`, and append a log
   entry to `wiki/log.md`.
4. Before writing anything, briefly tell me what you found in each raw
   file (the candidate pages you plan to create/update) and ask what to
   emphasize if the source is long or ambiguous — otherwise proceed.
5. When done, summarize: how many raw files were ingested, how many wiki
   pages were created vs. updated, and any raw files you skipped and why.

Never modify anything under `raw/`.
