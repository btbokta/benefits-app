#!/usr/bin/env node
/**
 * Adds the generated public key to the AI agent via the Okta Management API,
 * bypassing the Admin Console UI dialog.
 */
import { webcrypto } from 'node:crypto';
if (typeof globalThis.crypto === 'undefined') Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importJWK, exportSPKI } from 'jose';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
  if (k && v) process.env[k] = v;
}

const ORG = (process.env.OKTA_ORG_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.OKTA_API_TOKEN ?? '';
const AGENT_CLIENT_ID = process.env.OKTA_AGENT_CLIENT_ID ?? '';
const SSWS = { Authorization: `SSWS ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' };

if (!AGENT_CLIENT_ID) { console.error('OKTA_AGENT_CLIENT_ID not set in .env'); process.exit(1); }

// Build public JWK from private
const privateJwk = JSON.parse(process.env.OKTA_AGENT_PRIVATE_JWK ?? '{}');
const { d, dp, dq, p, q, qi, ...publicJwk } = privateJwk;
const kid = publicJwk.kid;

async function api(method, path, body) {
  const res = await fetch(`${ORG}${path}`, {
    method, headers: SSWS,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// Step 1: find the agent by client ID
console.log('\nLooking up AI agent...');
const { body: agents } = await api('GET', '/workload-principals/api/v1/ai-agents?limit=50');

let agent = null;
if (Array.isArray(agents)) {
  agent = agents.find(a => a.clientId === AGENT_CLIENT_ID || a.id === AGENT_CLIENT_ID);
}
if (!agent) {
  console.log('Agents found:', JSON.stringify(agents?.map?.(a => ({ id: a.id, clientId: a.clientId, name: a.profile?.name })), null, 2));
  console.error('\nCould not find agent with clientId:', AGENT_CLIENT_ID);
  console.error('Check OKTA_AGENT_CLIENT_ID in .env');
  process.exit(1);
}
console.log(`Found agent: ${agent.profile?.name ?? agent.id} (id: ${agent.id})`);

// Step 2: list existing credentials
const { body: creds } = await api('GET', `/workload-principals/api/v1/ai-agents/${agent.id}/credentials/keys`);
console.log('\nExisting credentials:', JSON.stringify(creds, null, 2));

// Step 3: add the new public key
console.log('\nAdding public key via API...');
const { status, body: added } = await api('POST', `/workload-principals/api/v1/ai-agents/${agent.id}/credentials/keys`, {
  ...publicJwk
});
console.log(`Status: ${status}`);
console.log('Response:', JSON.stringify(added, null, 2));

if (status >= 200 && status < 300) {
  const keyId = added.kid ?? added.id ?? kid;
  console.log(`\n✅ Key added. kid: ${keyId}`);

  // Activate it if needed
  if (added.status === 'INACTIVE' || added.status !== 'ACTIVE') {
    console.log('Activating key...');
    const { status: actStatus, body: actBody } = await api(
      'POST',
      `/workload-principals/api/v1/ai-agents/${agent.id}/credentials/keys/${keyId}/lifecycle/activate`,
      {}
    );
    console.log(`Activate status: ${actStatus}`, JSON.stringify(actBody, null, 2));
  }
} else {
  console.error('\n❌ Failed to add key via API. Try these alternative formats in the UI:');

  // Try minimal JWK (no use/alg)
  const { use, alg, ...minimalJwk } = publicJwk;
  console.log('\nMinimal JWK (no use/alg):');
  console.log(JSON.stringify(minimalJwk, null, 2));

  const pubKey = await importJWK(publicJwk, 'RS256');
  const pem = await exportSPKI(pubKey);
  console.log('\nPEM:');
  console.log(pem);
}
