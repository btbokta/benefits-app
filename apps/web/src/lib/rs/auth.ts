import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

function getIssuer() { return `${process.env.OKTA_ORG_URL}/oauth2/default`; }
function getAudience() { return process.env.RESOURCE_AUDIENCE ?? 'api://default'; }

const RS_BASE = process.env.RESOURCE_BASE_URL ?? 'http://localhost:3000';
export const PRM_URL = `${RS_BASE}/.well-known/oauth-protected-resource`;
export const WWW_AUTHENTICATE = `Bearer resource_metadata="${PRM_URL}"`;

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!_jwks) _jwks = createRemoteJWKSet(new URL(`${getIssuer()}/v1/keys`));
  return _jwks;
}

export interface Principal {
  sub: string;
  email?: string;
  groups?: string[];
  scopes: string[];
  cid?: string;
  act?: unknown;
  jti?: string;
  raw: JWTPayload;
}

export async function verifyBearer(authHeader?: string): Promise<Principal> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('missing_token'), { status: 401 });
  }
  const { payload } = await jwtVerify(authHeader.slice(7), getJwks(), {
    issuer: getIssuer(),
    audience: getAudience(),
  });
  const scopes = Array.isArray(payload.scp)
    ? (payload.scp as string[])
    : typeof payload.scope === 'string' ? payload.scope.split(' ') : [];
  return {
    sub: String(payload.sub),
    email: payload.email as string | undefined,
    groups: payload.groups as string[] | undefined,
    scopes,
    cid: payload.cid as string | undefined,
    act: payload.act,
    jti: payload.jti as string | undefined,
    raw: payload,
  };
}

export function requireScopes(...needed: string[]) {
  return (p: Principal): void => {
    const missing = needed.filter(s => !p.scopes.includes(s));
    if (missing.length) throw Object.assign(
      new Error(`insufficient_scope: ${missing.join(' ')}`),
      { status: 403, missing }
    );
  };
}

export function denied(message: string, status: number, extra?: object) {
  return Response.json(
    { error: message, ...extra },
    { status, headers: { 'WWW-Authenticate': WWW_AUTHENTICATE } }
  );
}
