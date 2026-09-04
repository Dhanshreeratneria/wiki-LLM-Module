# OAuth Update — Files Changed

Only these 3 files were changed from your previous zip. Everything else
(index.js, sync.js, db.js, wiki/, raw/, etc.) is unchanged — merge these
into your existing project, don't overwrite anything else.

## 1. `mcp-server/.env`
Added the 3 OAuth vars (`MCP_PUBLIC_URL`, `AUTH0_ISSUER`,
`AUTH0_AUDIENCE`) using the Auth0 credentials you created:
- Issuer: `https://dev-mmyrhtmiz68y8i1e.us.auth0.com/`
- Audience: `https://llm-wiki-mcp1`

This local `.env` is set up to run as **mcp-1 (Full Access)** for local
testing, since one `.env` = one running process. Do not copy all three
`MCP_PUBLIC_URL` values into this file — see the comments inside it.

## 2. `MCP_LINKS.md`
- Fixed the hostnames to match `render.yaml` (`llm-wiki-mcp-1/2/3`)
  instead of the old mismatched names.
- Removed static-token instructions; added a section explaining that
  MCP clients no longer need a hardcoded `Authorization` header — the
  Auth0 login flow is triggered automatically.

## 3. `render_mcp_config.snippet.json`
- Fixed URLs to match `render.yaml`.
- Removed the hardcoded `Authorization` headers (raw tokens) — not
  needed with OAuth, and they weren't even in valid `Bearer <token>`
  format.

## What you still need to do on Render (not in this zip — dashboard-only)
For **each** of the 3 services (mcp-1, mcp-2, mcp-3), in its Environment
tab, set:
```
AUTH0_ISSUER=https://dev-mmyrhtmiz68y8i1e.us.auth0.com/
AUTH0_AUDIENCE=https://llm-wiki-mcp1
MCP_PUBLIC_URL=<that service's own onrender.com URL>
```
Then redeploy each one, and confirm via:
```
https://<service-url>/.well-known/oauth-protected-resource
```
