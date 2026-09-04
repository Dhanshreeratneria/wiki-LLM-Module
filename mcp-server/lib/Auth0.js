// Wires this MCP server up as an OAuth 2.0 *resource server* that trusts
// Auth0 as the *authorization server*. We never issue our own tokens or
// implement /authorize or /token ourselves — Claude talks to Auth0 directly,
// and we just verify the access tokens Auth0 hands out.
//
// Required env vars:
//   AUTH0_DOMAIN    e.g. "your-tenant.us.auth0.com" (no https://, no trailing slash)
//   AUTH0_AUDIENCE  the Identifier of the Auth0 API you create for this server,
//                   e.g. "https://wiki-llm-module-1.onrender.com/mcp"
//                   (must match resourceServerUrl below, and must be a JWT-issuing
//                   API in Auth0 — i.e. you created it under Auth0 > APIs, not just
//                   an Application. Without a registered API, Auth0 issues opaque
//                   tokens that can't be verified as JWTs here.)

import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

if (!AUTH0_DOMAIN || !AUTH0_AUDIENCE) {
  throw new Error(
    "AUTH0_DOMAIN and AUTH0_AUDIENCE must be set to enable OAuth (see lib/auth0.js header comment)."
  );
}

const issuer = `https://${AUTH0_DOMAIN}/`;
const jwks = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));

// Fetched once at boot. Auth0's own /.well-known/openid-configuration is the
// authoritative source for its endpoint URLs — we republish the relevant
// fields (not invent our own) so mcpAuthMetadataRouter can point clients at
// the real authorize/token/registration endpoints.
export async function fetchAuth0Metadata() {
  const res = await fetch(`https://${AUTH0_DOMAIN}/.well-known/openid-configuration`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Auth0 OIDC metadata: ${res.status} ${res.statusText}`);
  }
  const oidc = await res.json();
  // Shape expected by @modelcontextprotocol/sdk's mcpAuthMetadataRouter
  // (RFC 8414 authorization server metadata).
  return {
    issuer: oidc.issuer,
    authorization_endpoint: oidc.authorization_endpoint,
    token_endpoint: oidc.token_endpoint,
    registration_endpoint: oidc.registration_endpoint, // present only if DCR is enabled on your tenant
    revocation_endpoint: oidc.revocation_endpoint,
    response_types_supported: oidc.response_types_supported || ["code"],
    code_challenge_methods_supported: oidc.code_challenge_methods_supported || ["S256"],
    token_endpoint_auth_methods_supported:
      oidc.token_endpoint_auth_methods_supported || ["client_secret_post", "none"],
    grant_types_supported: oidc.grant_types_supported || ["authorization_code", "refresh_token"],
    scopes_supported: oidc.scopes_supported,
  };
}

// Verifier passed to the SDK's requireBearerAuth middleware.
export const tokenVerifier = {
  async verifyAccessToken(token) {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: AUTH0_AUDIENCE,
    });
    return {
      token,
      clientId: payload.azp || payload.client_id || "unknown",
      scopes: typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [],
      expiresAt: payload.exp,
    };
  },
};