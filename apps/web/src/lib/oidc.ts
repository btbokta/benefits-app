import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomBytes, createHash } from 'node:crypto';
import { groupsToRole } from '@benefits-agent/shared';

// Login issuer depends on mode: A/B use org AS, C uses custom AS
function getLoginIssuer(): string {
  const mode = process.env.OKTA_AI_MODE ?? 'obo';
  const org = (process.env.OKTA_ORG_URL ?? '').replace(/\/$/, '');
  return mode === 'obo' ? `${org}/oauth2/default` : org;
}

let _discoveryCache: Record<string, unknown> | null = null;
let _jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function getDiscovery(): Promise<Record<string, unknown>> {
  if (_discoveryCache) return _discoveryCache;
  const issuer = getLoginIssuer();
  const res = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  _discoveryCache = await res.json() as Record<string, unknown>;
  return _discoveryCache;
}

export async function getJwks() {
  if (_jwksCache) return _jwksCache;
  const discovery = await getDiscovery();
  _jwksCache = createRemoteJWKSet(new URL(discovery.jwks_uri as string));
  return _jwksCache;
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(24).toString('base64url');
}

export function generateNonce(): string {
  return randomBytes(24).toString('base64url');
}

export async function buildAuthorizeUrl(state: string, nonce: string, pkceChallenge: string): Promise<string> {
  const discovery = await getDiscovery();
  const mode = process.env.OKTA_AI_MODE ?? 'obo';
  const scopes = mode === 'obo' ? 'openid profile email' : 'openid profile email groups';

  const params = new URLSearchParams({
    client_id: process.env.OKTA_WEB_CLIENT_ID ?? '',
    response_type: 'code',
    scope: scopes,
    redirect_uri: process.env.OKTA_REDIRECT_URI ?? 'http://localhost:3000/auth/callback',
    state,
    nonce,
    code_challenge: pkceChallenge,
    code_challenge_method: 'S256',
  });

  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

export async function exchangeCode(code: string, pkceVerifier: string): Promise<{
  idToken: string;
  accessToken: string;
  expiresIn: number;
}> {
  const discovery = await getDiscovery();
  const tokenEndpoint = discovery.token_endpoint as string;
  const clientId = process.env.OKTA_WEB_CLIENT_ID ?? '';
  const clientSecret = process.env.OKTA_WEB_CLIENT_SECRET ?? '';
  const redirectUri = process.env.OKTA_REDIRECT_URI ?? 'http://localhost:3000/auth/callback';

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: pkceVerifier,
  });

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await res.json() as { id_token?: string; access_token?: string; expires_in?: number };
  return {
    idToken: data.id_token ?? '',
    accessToken: data.access_token ?? '',
    expiresIn: data.expires_in ?? 3600,
  };
}

export async function parseIdToken(idToken: string, nonce: string): Promise<{
  sub: string;
  email: string;
  name: string;
  groups: string[];
}> {
  const jwks = await getJwks();
  const issuer = getLoginIssuer();
  const clientId = process.env.OKTA_WEB_CLIENT_ID ?? '';

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: clientId,
  });

  if (payload.nonce !== nonce) throw new Error('nonce mismatch');

  const rawGroups = Array.isArray(payload.groups) ? payload.groups as string[] : [];
  return {
    sub: payload.sub ?? '',
    email: (payload.email as string) ?? '',
    name: (payload.name as string) ?? '',
    groups: rawGroups,
  };
}

export async function buildLogoutUrl(idToken: string): Promise<string> {
  const discovery = await getDiscovery();
  const endSessionEndpoint = discovery.end_session_endpoint as string | undefined;
  if (!endSessionEndpoint) return '/';

  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: process.env.OKTA_POST_LOGOUT_URI ?? 'http://localhost:3000',
  });
  return `${endSessionEndpoint}?${params.toString()}`;
}

export { getLoginIssuer, groupsToRole };
