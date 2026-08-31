# LLM Wiki Tier-Based Access Control — Status Report

**Date**: 2026-08-31  
**Status**: ✅ **READY FOR DEPLOYMENT**

---

## ✅ What's Already Working

### Database Structure
- **268 wiki pages** fully indexed in PostgreSQL
- **All pages have tier assignments** (Tier 1, 2, or 3)
- **Database schema** supports tier filtering
- **Sync completed**: Pages synced from markdown to DB

### MCP Server Code
- **Tier filtering logic** implemented in `mcp-server/index.js`
- **ACCESS_TIER environment variable** controls access:
  - `ACCESS_TIER=all` → Returns all tiers (1, 2, 3)
  - `ACCESS_TIER=tier2-3` → Returns tiers 2 and 3 only
  - `ACCESS_TIER=tier3` → Returns tier 3 only
- **All MCP tools** respect tier filtering:
  - `wiki_search` — filters by tier
  - `wiki_list_pages` — filters by tier
  - `wiki_get_page` — respects tier access
  - `wiki_related` — only returns accessible pages
  - `wiki_lint` — validates tier assignments

### Configuration
- **Three MCP endpoints** already defined in `.mcp.json`:
  ```json
  {
    "llm-wiki-mcp-1": "https://llm-wiki-mcp-1.onrender.com/mcp",
    "llm-wiki-mcp-2": "https://llm-wiki-mcp-2.onrender.com/mcp",
    "llm-wiki-mcp-3": "https://llm-wiki-mcp-3.onrender.com/mcp"
  }
  ```

---

## 📋 Page Distribution (268 total)

### Tier 1: Foundational (Popular Products & Tools)
Examples: Claude, ChatGPT, PyTorch, CUDA, Docker, Jupyter, JAX, Hugging Face, Colab, GitHub Copilot, etc.

### Tier 2: Intermediate (Concepts & Researchers)
Examples: Transformers, Attention Mechanism, Backpropagation, Neural Networks, Geoffrey Hinton, Ilya Sutskever, Andrej Karpathy, OpenAI, Anthropic, etc.

### Tier 3: Deep Technical (Research Papers & Reports)
Examples: "Attention Is All You Need" (2017), GPT-4 Technical Report, Constitutional AI paper, BERT paper, AlexNet paper, LLaMA paper, etc.

---

## 🚀 Deployment Checklist

- [x] Database synced with 268 pages
- [x] All pages tagged with tier levels
- [x] Tier filtering code implemented
- [x] MCP endpoints configured in .mcp.json
- [ ] Deploy MCP 1 to Render with `ACCESS_TIER=all`
- [ ] Deploy MCP 2 to Render with `ACCESS_TIER=tier2-3`
- [ ] Deploy MCP 3 to Render with `ACCESS_TIER=tier3`
- [ ] Test tier segregation on each endpoint
- [ ] Verify database connectivity on all three services

---

## 🔧 How to Deploy (Next Steps)

### For Render.com Deployment:

1. **Create 3 Web Services** (one for each tier)
2. **For each service:**
   - Build Command: `npm install`
   - Start Command: `cd mcp-server && npm start`
   - Set environment variables (see DEPLOYMENT_GUIDE.md)
3. **Share the same PostgreSQL database** across all three services
4. **Test segregation** using the MCP tools

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

---

## 🔐 Access Control Examples

### When MCP 1 (full access) lists pages:
Returns Tier 1, 2, and 3 pages → ~268 pages total

### When MCP 2 (restricted access) lists pages:
Returns only Tier 2 and 3 pages → Filters out basic tutorials/tools, keeps intermediate+ knowledge

### When MCP 3 (deep access) lists pages:
Returns only Tier 3 pages → Research papers, technical reports, deep technical content only

---

## 📁 Key Files

- **Code**: `mcp-server/index.js` (tier filtering logic)
- **Sync**: `mcp-server/sync.js` (builds DB index)
- **Config**: `.mcp.json` (endpoint URLs)
- **Database**: `db/schema.sql` (defines tier column)
- **Guide**: `DEPLOYMENT_GUIDE.md` (full deployment instructions)
- **Audit**: `mcp-server/audit-tiers.js` (inspects tier distribution)

---

## ✨ Summary

**Your wiki is structured and ready.** The infrastructure for tier-based access control is already built into the code. The only remaining step is to deploy the three MCP servers to Render (or similar) with the correct `ACCESS_TIER` environment variables set.

Once deployed, the three endpoints will automatically segregate access based on tier, with no additional configuration needed.
