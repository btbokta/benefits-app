import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

function getIssuer() { return `${process.env.OKTA_ORG_URL}/oauth2/default`; }
function getAudience() { return process.env.RESOURCE_AUDIENCE ?? 'api://default'; }

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getJwks(): any {
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
    throw Object.assign(new Error('missing bearer token'), { status: 401 });
  }
  const token = authHeader.slice(7);
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: getIssuer(),
    audience: getAudience(),
  });
  const scopes = Array.isArray(payload.scp)
    ? (payload.scp as string[])
    : typeof payload.scope === 'string'
    ? payload.scope.split(' ')
    : [];
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
    const missing = needed.filter((s) => !p.scopes.includes(s));
    if (missing.length) {
      throw Object.assign(
        new Error(`insufficient_scope: ${missing.join(' ')}`),
        { status: 403, missing }
      );
    }
  };
}
