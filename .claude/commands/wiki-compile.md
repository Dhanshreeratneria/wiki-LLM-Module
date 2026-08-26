Run a full maintenance pass over the existing wiki (not new raw sources —
use `/wiki-ingest` for that).

Steps:

1. Read `wiki/index.md` and every page in `wiki/pages/`.
2. Find missing backlinks: if page A links to [[B]] but B doesn't link
   back to A, add the backlink on B.
3. Find pages that exist in `wiki/pages/` but aren't listed in
   `wiki/index.md`, and add them under the right section.
4. Find index entries that point to pages that no longer exist, and flag
   them (don't silently delete — ask me first).
5. Look for near-duplicate pages (same concept, slightly different title)
   and propose a merge — don't merge automatically.
6. Refresh the "Last updated" line in `wiki/index.md`.
7. Append a summary entry to `wiki/log.md` describing what this
   maintenance pass changed.

Report a short summary of what was fixed and what still needs my input
(duplicates to merge, dead links to resolve).
