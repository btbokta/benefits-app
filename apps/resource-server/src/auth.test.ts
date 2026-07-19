import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { verifyBearer, requireScopes, _setKeyResolverForTests } from './auth.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let privateKey: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let publicKey: any;

beforeAll(async () => {
  process.env.OKTA_ORG_URL = 'https://test.example.okta.com';
  process.env.RESOURCE_AUDIENCE = 'api://default';

  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;

  // Inject test key resolver
  _setKeyResolverForTests(publicKey as Parameters<typeof _setKeyResolverForTests>[0]);
});

afterAll(() => {
  _setKeyResolverForTests(null as unknown as Parameters<typeof _setKeyResolverForTests>[0]);
});

async function makeToken(overrides: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({ scp: ['benefits.record.read'], ...overrides })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://test.example.okta.com/oauth2/default')
    .setAudience('api://default')
    .setSubject('sarah.johnson@acmecorp.example')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

describe('verifyBearer', () => {
  it('rejects missing bearer token with status 401', async () => {
    await expect(verifyBearer(undefined)).rejects.toMatchObject({ status: 401 });
    await expect(verifyBearer('Basic foo')).rejects.toMatchObject({ status: 401 });
  });

  it('rejects expired token', async () => {
    const token = await new SignJWT({ scp: ['benefits.record.read'] })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://test.example.okta.com/oauth2/default')
      .setAudience('api://default')
      .setSubject('test@example.com')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey);
    await expect(verifyBearer(`Bearer ${token}`)).rejects.toThrow();
  });

  it('accepts valid token and extracts scopes', async () => {
    const token = await makeToken({ scp: ['benefits.record.read', 'benefits.pto.read'] });
    const principal = await verifyBearer(`Bearer ${token}`);
    expect(principal.sub).toBe('sarah.johnson@acmecorp.example');
    expect(principal.scopes).toContain('benefits.record.read');
    expect(principal.scopes).toContain('benefits.pto.read');
  });

  it('extracts cid and jti when present', async () => {
    const token = await makeToken({ cid: 'agent-client-id', jti: 'test-jti-123' });
    const principal = await verifyBearer(`Bearer ${token}`);
    expect(principal.cid).toBe('agent-client-id');
    expect(principal.jti).toBe('test-jti-123');
  });
});

describe('requireScopes', () => {
  it('passes when scope is present', async () => {
    const token = await makeToken({ scp: ['benefits.record.read', 'benefits.compensation.read'] });
    const principal = await verifyBearer(`Bearer ${token}`);
    expect(() => requireScopes('benefits.record.read')(principal)).not.toThrow();
    expect(() => requireScopes('benefits.compensation.read')(principal)).not.toThrow();
  });

  it('throws 403 when scope is missing', async () => {
    const token = await makeToken({ scp: ['benefits.record.read'] });
    const principal = await verifyBearer(`Bearer ${token}`);
    expect(() => requireScopes('benefits.compensation.read')(principal)).toThrow();
    try {
      requireScopes('benefits.compensation.read')(principal);
    } catch (e: unknown) {
      const err = e as { status?: number; missing?: string[] };
      expect(err.status).toBe(403);
      expect(err.missing).toContain('benefits.compensation.read');
    }
  });
});
