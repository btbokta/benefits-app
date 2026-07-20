#!/usr/bin/env node
/**
 * Phase 5.5 — CLI to run the token broker with a real session token.
 * Usage: node scripts/get-agent-token.mjs
 *
 * Instructions:
 * 1. npm run dev (in another terminal)
 * 2. Log in as a persona in the browser
 * 3. Visit http://localhost:3000/api/debug/subject-token and copy the subjectToken
 * 4. Paste it here when prompted
 */
import { createInterface } from 'node:readline';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

import { loadEnv } from './load-env.mjs';
loadEnv(resolve(root, '.env'));

const mode = process.env.OKTA_AI_MODE ?? 'obo';
const org = (process.env.OKTA_ORG_URL ?? '').replace(/\/$/, '');

console.log(`\nToken Broker CLI — mode: ${mode}`);
console.log('─────────────────────────────────────────────────────────');
console.log('1. Start the web app: npm run dev');
console.log('2. Log in as a persona');
console.log('3. Visit: http://localhost:3000/api/debug/subject-token');
console.log('4. Copy the subjectToken value and paste below');
console.log('─────────────────────────────────────────────────────────\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const subjectToken = await new Promise(r => rl.question('Paste subject token: ', r));
rl.close();

if (!subjectToken.trim()) { console.error('No token provided'); process.exit(1); }

function decodeJwt(token) {
  try {
    const parts = token.split('.');
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return { header, payload };
  } catch { return { header: {}, payload: {} }; }
}

async function postForm(url, params, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: params.toString(),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function preview(token) { return token.slice(0, 12) + '...'; }

if (mode === 'agents' || mode === 'xaa') {
  const agentClientId = process.env.OKTA_AGENT_CLIENT_ID ?? '';
  const privateJwkRaw = process.env.OKTA_AGENT_PRIVATE_JWK ?? '';
  const kid = process.env.OKTA_AGENT_KID ?? '';

  if (!agentClientId || !privateJwkRaw || !kid) {
    console.error('OKTA_AGENT_CLIENT_ID, OKTA_AGENT_PRIVATE_JWK, and OKTA_AGENT_KID required for Mode A');
    process.exit(1);
  }

  const { importJWK, importPKCS8, SignJWT } = await import('jose');
  const { randomUUID } = await import('node:crypto');

  async function assertion(endpoint) {
    const trimmed = privateJwkRaw.trim();
    const key = trimmed.startsWith('-----BEGIN')
      ? await importPKCS8(trimmed, 'RS256')
      : await importJWK(JSON.parse(trimmed), 'RS256');
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(agentClientId).setSubject(agentClientId).setAudience(endpoint)
      .setIssuedAt(now).setExpirationTime(now + 300).setJti(randomUUID())
      .sign(key);
  }

  console.log('\n[Hop 1] Exchanging ID token → ID-JAG at org AS…');
  const hop1Endpoint = `${org}/oauth2/v1/token`;
  const hop1Params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type: 'urn:ietf:params:oauth:token-type:id-jag',
    subject_token: subjectToken.trim(),
    subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: await assertion(hop1Endpoint),
    audience: `${org}/oauth2/default`,
    scope: process.env.BROKER_SCOPES ?? 'benefits.record.read benefits.enrollment.read benefits.pto.read',
  });
  const hop1 = await postForm(hop1Endpoint, hop1Params);
  if (!hop1.ok) { console.error('Hop 1 FAILED:', JSON.stringify(hop1.body, null, 2)); process.exit(1); }
  const idJag = hop1.body.access_token;
  const decoded1 = decodeJwt(idJag);
  console.log(`  ID-JAG preview: ${preview(idJag)}`);
  console.log(`  typ: ${decoded1.header.typ ?? 'unknown'}`);
  console.log(`  sub: ${decoded1.payload.sub}`);
  console.log(`  jti: ${decoded1.payload.jti}`);

  console.log('\n[Hop 2] Exchanging ID-JAG → agent access token at custom AS…');
  const hop2Endpoint = `${org}/oauth2/default/v1/token`;
  const hop2Params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: idJag,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: await assertion(hop2Endpoint),
  });
  const hop2 = await postForm(hop2Endpoint, hop2Params);
  if (!hop2.ok) { console.error('Hop 2 FAILED:', JSON.stringify(hop2.body, null, 2)); process.exit(1); }
  const agentToken = hop2.body.access_token;
  const decoded2 = decodeJwt(agentToken);
  console.log(`\n✅ Agent access token:`);
  console.log(`  preview: ${preview(agentToken)}`);
  console.log(`  sub: ${decoded2.payload.sub}`);
  console.log(`  cid: ${decoded2.payload.cid ?? 'n/a'}`);
  console.log(`  scp: ${JSON.stringify(decoded2.payload.scp)}`);
  console.log(`  jti: ${decoded2.payload.jti}`);
  console.log(`  iss: ${decoded2.payload.iss}`);
  console.log(`\nTest it:\n  curl http://localhost:3001/api/employees -H "Authorization: Bearer ${agentToken}"`);

} else {
  // Mode C
  const agentClientId = process.env.OKTA_AGENT_CLIENT_ID ?? '';
  const agentClientSecret = process.env.OKTA_AGENT_CLIENT_SECRET ?? '';
  const scopes = process.env.BROKER_SCOPES ?? 'benefits.record.read benefits.enrollment.read benefits.pto.read';

  const credentials = Buffer.from(`${agentClientId}:${agentClientSecret}`).toString('base64');
  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: subjectToken.trim(),
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    scope: scopes,
    audience: process.env.RESOURCE_AUDIENCE ?? 'api://default',
  });

  console.log('\n[OBO] Exchanging user access token → agent token…');
  const { ok, body } = await postForm(`${org}/oauth2/default/v1/token`, params, { Authorization: `Basic ${credentials}` });
  if (!ok) { console.error('OBO exchange FAILED:', JSON.stringify(body, null, 2)); process.exit(1); }
  const agentToken = body.access_token;
  const decoded = decodeJwt(agentToken);
  console.log(`\n✅ Agent access token:`);
  console.log(`  preview: ${preview(agentToken)}`);
  console.log(`  sub: ${decoded.payload.sub}`);
  console.log(`  cid: ${decoded.payload.cid}`);
  console.log(`  scp: ${JSON.stringify(decoded.payload.scp)}`);
  console.log(`  jti: ${decoded.payload.jti}`);
  console.log(`  iss: ${decoded.payload.iss}`);
  console.log(`\nTest it:\n  curl http://localhost:3001/api/employees -H "Authorization: Bearer ${agentToken}"`);
}
