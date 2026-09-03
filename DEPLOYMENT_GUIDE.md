# LLM Wiki — Tier-Based MCP Deployment Guide

## Overview

Your wiki is structured into **3 segregated MCP endpoints** with tier-based access control:

| Endpoint | Tier Access | Use Case |
|----------|------------|----------|
| **MCP 1** | Tier 1, 2, 3 (All) | Full wiki access, no restrictions |
| **MCP 2** | Tier 2, 3 | Intermediate + deep knowledge |
| **MCP 3** | Tier 3 only | Research papers, technical deep dives |

---

## Database Tier Distribution (268 pages)

- **Tier 1**: Foundational/popular AI products and tools (Claude, ChatGPT, PyTorch, CUDA, Docker, etc.)
- **Tier 2**: Intermediate concepts and researchers (Transformers, Attention Mechanism, Andrej Karpathy, Geoffrey Hinton, etc.)
- **Tier 3**: Deep technical content (Attention Is All You Need paper, GPT-4 Technical Report, Constitutional AI paper, etc.)

---

## Deployment Steps

### Authentication

Hosted `/mcp` requests require a bearer token. This is token authentication,
not a username/password login page; this repository has no web account UI or
user database.

1. Generate a strong token locally, for example with PowerShell:
  ```powershell
  $bytes = [byte[]]::new(32); [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes); [Convert]::ToHexString($bytes)
  ```
2. In each Render service, add the same secret environment variable:
  ```
  MCP_AUTH_TOKEN=<your-generated-token>
  ```
3. Put that token in the MCP client configuration as:
  ```json
  "headers": {
    "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
  }
  ```
4. Restart or redeploy the Render services.

`/healthz` remains public so Render can perform health checks. Requests to
`/mcp` without the correct token receive `401 Unauthorized`. Keep the token
out of Git and do not commit a real value to the configuration snippet.

### Step 1: Prepare the Repository

Your code is ready. No changes needed to `index.js` or `sync.js`.

```bash
cd mcp-server
npm install    # Already done
npm run sync   # Already done — 268 pages synced
```

### Step 2: Deploy to Render (or similar platform)

You have three deployment URLs already configured. For each, follow this process:

#### **MCP 1 — Full Access (llm-wiki-mcp-1)**

1. Create a new Render Web Service
2. Connect to your GitHub repo containing this folder
3. **Build Command**: `npm install`
4. **Start Command**: `cd mcp-server && npm start`
5. **Environment Variables**:
   ```
   ACCESS_TIER=all
   WIKI_ROOT=../
   DATABASE_URL=<your-postgres-connection-string>
   ```
6. Deploy
7. Update `.mcp.json` if the URL differs from `https://llm-wiki-mcp-1.onrender.com/mcp`

#### **MPC 2 — Tier 2-3 Only (llm-wiki-mcp-2)**

Repeat Step 2, but change:
- **Environment Variable**: `ACCESS_TIER=tier2-3`
- **Service name**: `llm-wiki-mcp-2`

#### **MCP 3 — Tier 3 Only (llm-wiki-mcp-3)**

Repeat Step 2, but change:
- **Environment Variable**: `ACCESS_TIER=tier3`
- **Service name**: `llm-wiki-mcp-3`

---

### Step 3: Database Setup

Each Render deployment needs access to the same PostgreSQL database:

1. Provision a PostgreSQL database (or use an existing one)
2. Get the connection string: `postgresql://<user>:<password>@<host>:<port>/<database>`
3. Set `DATABASE_URL` in each Render service's environment variables
4. Run the schema once:
   ```bash
   psql <DATABASE_URL> < db/schema.sql
   ```
5. Sync the wiki data:
   ```bash
   npm run sync
   ```

---

### Step 4: Verify Tier Filtering

Test each endpoint to confirm segregation works:

```bash
# Test MCP 1 (should return all tiers)
curl https://llm-wiki-mcp-1.onrender.com/mcp

# Test MCP 2 (should return tier >= 2 only)
curl https://llm-wiki-mcp-2.onrender.com/mcp

# Test MCP 3 (should return tier = 3 only)
curl https://llm-wiki-mcp-3.onrender.com/mcp
```

Or use the MCP tools in Claude Desktop/Code:
- Connect each endpoint and run `wiki_list_pages` — verify tier filtering

---

## Current Configuration

Your `.mcp.json` currently points to:

```json
{
  "mcpServers": {
    "llm-wiki-mcp-1": {
      "url": "https://llm-wiki-mcp-1.onrender.com/mcp"
    },
    "llm-wiki-mcp-2": {
      "url": "https://llm-wiki-mcp-2.onrender.com/mcp"
    },
    "llm-wiki-mcp-3": {
      "url": "https://llm-wiki-mcp-3.onrender.com/mcp"
    }
  }
}
```

Update these URLs if your deployment URLs differ.

---

## How Tier Filtering Works

In `mcp-server/index.js`, the `tierFilter()` function controls database queries:

```javascript
const ACCESS_TIER = process.env.ACCESS_TIER || "all";

function tierFilter(alias = "") {
  const column = `${alias}tier`;
  if (ACCESS_TIER === "tier2-3") return `${column} >= 2`;  // Tier 2 and 3
  if (ACCESS_TIER === "tier3") return `${column} = 3`;      // Tier 3 only
  return "TRUE";                                             // All tiers
}
```

Every query (wiki_search, wiki_list_pages, etc.) applies this filter automatically.

---

## Managing Tiers

To change a page's tier, edit its frontmatter:

```markdown
---
title: Some Concept
type: concept
tier: 2  # Change this: 1, 2, or 3
tags: [ai, research]
created: 2026-08-26
updated: 2026-08-26
---
```

Then sync:
```bash
npm run sync
```

The new tier takes effect immediately on all three endpoints.

---

## Troubleshooting

- **Endpoint returns 404**: Check Render service is running
- **Tier filtering not working**: Verify `ACCESS_TIER` is set correctly in Render env vars
- **Database connection fails**: Verify `DATABASE_URL` is correct and includes full credentials
- **Pages not showing up**: Run `npm run sync` to rebuild the index from markdown

---

## Summary

✅ **Infrastructure**: Ready  
✅ **Database**: Synced (268 pages)  
✅ **Code**: Supports tier filtering  
⏳ **Deployment**: Awaiting Render setup (or equivalent)

Once deployed with correct `ACCESS_TIER` env vars, the three endpoints will automatically segregate access.
