---
title: Mixture of Experts
type: concept
tags: [architecture, efficiency]
created: 2026-08-26
updated: 2026-08-26
tier: 2
---

# Mixture of Experts

Architecture where only a subset of specialized sub-networks ('experts') are active per input, reducing compute per token.

## Details

- Allows scaling total parameter count without proportionally scaling inference cost.
- Used in several frontier-scale LLMs to improve efficiency.

## Related

- [[Transformer]]
- [[Large Language Model]]
- [[Scaling Laws]]

## Sources

- raw/misc/sample-corpus.md — seeded as representative sample data for graph visualization
