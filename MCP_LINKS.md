# LLM Wiki MCP Links

## Tier-Based Access Control

### MCP 1: Full Access (Tier 1 + 2 + 3)
```
https://wiki-llm-module-1.onrender.com/mcp
```

### MCP 2: Intermediate + Research (Tier 2 + 3)
```
https://llm-wiki-tier2-3.onrender.com/mcp
```

### MCP 3: Research Only (Tier 3)
```
https://llm-wiki-tier3.onrender.com/mcp
```

> These must match whatever hostnames are actually live on Render. Check
> each service's page in the Render dashboard and update the URLs above
> if they differ.

---

## Authentication: OAuth via Auth0

All three services share one Auth0 API (same `AUTH0_ISSUER` /
`AUTH0_AUDIENCE`), set individually per service in each Render
service's Environment tab — see `mcp-server/.env` for the values and
comments. Only `MCP_PUBLIC_URL` differs between the three.

Because OAuth is configured, MCP clients do **not** need a hardcoded
`Authorization` header. On first connection to a `/mcp` URL below, the
client receives a 401 with a `WWW-Authenticate` header pointing at
`/.well-known/oauth-protected-resource`, and will prompt you to log in
through Auth0. No token needs to be pasted into any config file.

---

## Claude Desktop Config

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "llm-wiki-mcp-1": {
      "url": "https://wiki-llm-module-1.onrender.com/mcp"
    },
    "llm-wiki-mcp-2": {
      "url": "https://llm-wiki-tier2-3.onrender.com/mcp"
    },
    "llm-wiki-mcp-3": {
      "url": "https://llm-wiki-tier3.onrender.com/mcp"
    }
  }
}
```

---

## Claude Code Config

Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "llm-wiki-mcp-1": {
      "url": "https://wiki-llm-module-1.onrender.com/mcp"
    },
    "llm-wiki-mcp-2": {
      "url": "https://llm-wiki-tier2-3.onrender.com/mcp"
    },
    "llm-wiki-mcp-3": {
      "url": "https://llm-wiki-tier3.onrender.com/mcp"
    }
  }
}
```
