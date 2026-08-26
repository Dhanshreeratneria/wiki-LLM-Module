Audit the wiki for structural problems and write a severity-tiered report.

Check for:

- 🔴 Broken `[[links]]` (link targets that don't exist as a page)
- 🔴 Pages missing required frontmatter (title, type, tags, created, updated)
- 🟡 One-directional links (A links to B, B doesn't link back)
- 🟡 Pages not listed in `wiki/index.md`
- 🟡 Index entries pointing to nonexistent pages
- 🔵 Pages with no `## Sources` section (unclear provenance)
- 🔵 Likely duplicate/near-duplicate pages

Write the findings to `wiki/pages/lint-<YYYY-MM-DD>.md` grouped by
severity, each item with a one-line suggested fix. Don't apply fixes
automatically — just report. Give me a short summary in chat with the
counts per severity.
