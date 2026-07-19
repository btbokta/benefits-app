import { decodeJwt } from 'jose';
import type { SessionData } from './session.js';
import { ROLE_SCOPES } from '@benefits-agent/shared';
import { clientAssertion } from './client-assertion.js';

export interface TokenChainStage {
  stage: string;
  tokenPreview: string;
  decoded?: { header: Record<string, unknown>; payload: Record<string, unknown> };
  expiresAt?: number;
}

export interface BrokeredToken {
  accessToken: string;
  scope: string;
  expiresAt: number;
  chain: TokenChainStage[];
}

export class BrokerError extends Error {
  constructor(
    public stage: string,
    public status: number,
    public oktaError: string,
    public oktaDescription: string
  ) {
    super(`[${stage}] ${oktaError}: ${oktaDescription}`);
    this.name = 'BrokerError';
  }
}

function decodeStage(token: string, stageName: string): TokenChainStage {
  try {
    const parts = token.split('.');
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = decodeJwt(token) as Record<string, unknown>;
    return {
      stage: stageName,
      tokenPreview: token.slice(0, 12) + '...',
      decoded: { header, payload },
      expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
    };
  } catch {
    return { stage: stageName, tokenPreview: token.slice(0, 12) + '...' };
  }
}

async function postForm(url: string, params: URLSearchParams, headers: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: params.toString(),
  });
  const body = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(JSON.stringify(body));
  }
  return body;
}

// ── Mode A / B — two-hop ID-JAG exchange ──────────────────────────────────────

async function brokerModeA(session: SessionData): Promise<BrokeredToken> {
  const org = (process.env.OKTA_ORG_URL ?? '').replace(/\/$/, '');
  const agentClientId = process.env.OKTA_AGENT_CLIENT_ID ?? '';
  const privateJwk = process.env.OKTA_AGENT_PRIVATE_JWK ?? '';
  const kid = process.env.OKTA_AGENT_KID ?? '';
  const customAsIssuer = `${org}/oauth2/default`;
  const scopes = ROLE_SCOPES[session.role].join(' ');
  const chain: TokenChainStage[] = [];

  chain.push(decodeStage(session.idToken, 'ID token (org AS)'));

  // Hop 1: org AS → ID-JAG
  const hop1Endpoint = `${org}/oauth2/v1/token`;
  let hop1Assertion: string;
  try {
    hop1Assertion = await clientAssertion(agentClientId, privateJwk, kid, hop1Endpoint);
  } catch (e) {
    throw new BrokerError('hop1-client-assertion', 0, 'key_error', String(e));
  }

  const hop1Params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type: 'urn:ietf:params:oauth:token-type:id-jag',
    subject_token: session.idToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: hop1Assertion,
    audience: customAsIssuer,
    scope: scopes,
  });

  let hop1Body: Record<string, unknown>;
  try {
    hop1Body = await postForm(hop1Endpoint, hop1Params, {});
  } catch (e) {
    const raw = String(e).replace('Error: ', '');
    try {
      const parsed = JSON.parse(raw) as { error?: string; error_description?: string };
      throw new BrokerError('hop1', 400, parsed.error ?? 'exchange_error', parsed.error_description ?? raw);
    } catch {
      if (e instanceof BrokerError) throw e;
      throw new BrokerError('hop1', 400, 'exchange_error', raw);
    }
  }

  const idJag = hop1Body.access_token as string;
  chain.push(decodeStage(idJag, 'ID-JAG (identity assertion)'));

  // Hop 2: custom AS → agent access token
  const hop2Endpoint = `${org}/oauth2/default/v1/token`;
  let hop2Assertion: string;
  try {
    hop2Assertion = await clientAssertion(agentClientId, privateJwk, kid, hop2Endpoint);
  } catch (e) {
    throw new BrokerError('hop2-client-assertion', 0, 'key_error', String(e));
  }

  const hop2Params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: idJag,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: hop2Assertion,
  });

  let hop2Body: Record<string, unknown>;
  try {
    hop2Body = await postForm(hop2Endpoint, hop2Params, {});
  } catch (e) {
    const raw = String(e).replace('Error: ', '');
    try {
      const parsed = JSON.parse(raw) as { error?: string; error_description?: string };
      throw new BrokerError('hop2', 400, parsed.error ?? 'exchange_error', parsed.error_description ?? raw);
    } catch {
      if (e instanceof BrokerError) throw e;
      throw new BrokerError('hop2', 400, 'exchange_error', raw);
    }
  }

  const accessToken = hop2Body.access_token as string;
  const expiresIn = (hop2Body.expires_in as number) ?? 3600;
  chain.push(decodeStage(accessToken, 'Agent access token (custom AS)'));

  return {
    accessToken,
    scope: hop2Body.scope as string ?? scopes,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    chain,
  };
}

// ── Mode C — GA on-behalf-of token exchange ───────────────────────────────────

async function brokerModeObo(session: SessionData): Promise<BrokeredToken> {
  const org = (process.env.OKTA_ORG_URL ?? '').replace(/\/$/, '');
  const agentClientId = process.env.OKTA_AGENT_CLIENT_ID ?? '';
  const agentClientSecret = process.env.OKTA_AGENT_CLIENT_SECRET ?? '';
  const scopes = ROLE_SCOPES[session.role].join(' ');
  const chain: TokenChainStage[] = [];

  chain.push(decodeStage(session.accessToken, 'User access token (custom AS)'));

  const endpoint = `${org}/oauth2/default/v1/token`;
  const credentials = Buffer.from(`${agentClientId}:${agentClientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: session.accessToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    scope: scopes,
    audience: process.env.RESOURCE_AUDIENCE ?? 'api://default',
  });

  let body: Record<string, unknown>;
  try {
    body = await postForm(endpoint, params, { Authorization: `Basic ${credentials}` });
  } catch (e) {
    const raw = String(e).replace('Error: ', '');
    try {
      const parsed = JSON.parse(raw) as { error?: string; error_description?: string };
      throw new BrokerError('obo', 400, parsed.error ?? 'exchange_error', parsed.error_description ?? raw);
    } catch {
      if (e instanceof BrokerError) throw e;
      throw new BrokerError('obo', 400, 'exchange_error', raw);
    }
  }

  const accessToken = body.access_token as string;
  const expiresIn = (body.expires_in as number) ?? 3600;
  chain.push(decodeStage(accessToken, 'Agent access token (delegated, custom AS)'));

  return {
    accessToken,
    scope: body.scope as string ?? scopes,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    chain,
  };
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const _cache = new Map<string, BrokeredToken>();

function cacheKey(session: SessionData): string {
  return `${session.sub}|${process.env.OKTA_AI_MODE ?? 'obo'}|${ROLE_SCOPES[session.role].join(',')}`;
}

export async function getAgentToken(session: SessionData): Promise<BrokeredToken> {
  const key = cacheKey(session);
  const cached = _cache.get(key);
  if (cached && cached.expiresAt - Math.floor(Date.now() / 1000) > 60) {
    return cached;
  }

  const mode = process.env.OKTA_AI_MODE ?? 'obo';
  let token: BrokeredToken;

  if (mode === 'agents' || mode === 'xaa') {
    token = await brokerModeA(session);
  } else {
    token = await brokerModeObo(session);
  }

  _cache.set(key, token);
  return token;
}

export function invalidateCache(sub: string): void {
  for (const k of _cache.keys()) {
    if (k.startsWith(sub + '|')) _cache.delete(k);
  }
}

export async function revokeAgentToken(session: SessionData): Promise<void> {
  const key = cacheKey(session);
  const cached = _cache.get(key);
  if (!cached) return;

  const org = (process.env.OKTA_ORG_URL ?? '').replace(/\/$/, '');
  const agentClientId = process.env.OKTA_AGENT_CLIENT_ID ?? '';
  const agentClientSecret = process.env.OKTA_AGENT_CLIENT_SECRET ?? '';

  const credentials = Buffer.from(`${agentClientId}:${agentClientSecret}`).toString('base64');
  await fetch(`${org}/oauth2/default/v1/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ token: cached.accessToken, token_type_hint: 'access_token' }).toString(),
  }).catch(() => {});

  _cache.delete(key);
}
