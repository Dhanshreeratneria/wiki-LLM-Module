# LLM Wiki MCP Links

## Tier-Based Access Control

### MCP 1: Full Access (Tier 1 + 2 + 3)
```
https://wiki-llm-module-1.onrender.com/mcp
```

### MCP 2: Intermediate + Deep (Tier 2 + 3)
```
https://llm-wiki-tier2-3.onrender.com/mcp
```

### MCP 3: Deep Only (Tier 3)
```
https://llm-wiki-tier3.onrender.com/mcp
```

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
