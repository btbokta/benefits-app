#!/usr/bin/env node
/**
 * Creates payroll.read and payroll.adjust scopes on the Okta custom AS.
 * Reads OKTA_ORG_URL, OKTA_API_TOKEN, and OKTA_CUSTOM_AS_ID from root .env
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');

if (!existsSync(envPath)) { console.error('No .env found at', envPath); process.exit(1); }

// Parse .env (same multi-line logic as resource server)
const env = {};
const content = readFileSync(envPath, 'utf8');
const lines = [];
let buf = '', inQ = false;
for (const raw of content.split('\n')) {
  if (!inQ) {
    const t = raw.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const val = t.slice(eq + 1);
    const q = val[0];
    if ((q === '"' || q === "'") && !val.slice(1).includes(q)) { buf = raw; inQ = true; continue; }
    lines.push(raw);
  } else {
    buf += '\n' + raw;
    const q = buf[buf.indexOf('=') + 1];
    if (buf.slice(buf.indexOf('=') + 2).includes(q)) { inQ = false; lines.push(buf); buf = ''; }
  }
}
for (const line of lines) {
  const t = line.trim();
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1);
  const q = v[0];
  if ((q === '"' || q === "'") && v.endsWith(q) && v.length > 1) v = v.slice(1, -1);
  v = v.replace(/\\n/g, '\n');
  env[k] = v;
}

const orgUrl = env.OKTA_ORG_URL?.replace(/\/$/, '');
const apiToken = env.OKTA_API_TOKEN;
const asId = env.OKTA_CUSTOM_AS_ID || env.OKTA_AS_ID;

if (!orgUrl) { console.error('OKTA_ORG_URL not set in .env'); process.exit(1); }
if (!apiToken) { console.error('OKTA_API_TOKEN not set in .env'); process.exit(1); }

async function apiFetch(path, opts = {}) {
  const url = `${orgUrl}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `SSWS ${apiToken}`, 'Content-Type': 'application/json', Accept: 'application/json', ...opts.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
}

// Find the custom AS (by ID if provided, else search by name)
let authServerId = asId;
if (!authServerId) {
  console.log('OKTA_CUSTOM_AS_ID not set — searching for custom AS...');
  const { ok, body } = await apiFetch('/api/v1/authorizationServers?limit=50');
  if (!ok) { console.error('Failed to list authorization servers:', body); process.exit(1); }
  // Exclude the org AS (id: 'default' or name matching "Okta Authorization Server")
  const custom = body.filter(s => s.id !== 'default' && !s.name?.includes('Okta Authorization Server'));
  if (custom.length === 0) { console.error('No custom AS found. Set OKTA_CUSTOM_AS_ID in .env'); process.exit(1); }
  if (custom.length > 1) {
    console.log('Multiple custom AS found:');
    custom.forEach(s => console.log(`  ${s.id}  ${s.name}`));
    console.error('Set OKTA_CUSTOM_AS_ID=<id> in .env to specify which one');
    process.exit(1);
  }
  authServerId = custom[0].id;
  console.log(`Using AS: ${custom[0].name} (${authServerId})`);
}

// Check existing scopes to avoid duplicates
const { ok: scopesOk, body: existingScopes } = await apiFetch(`/api/v1/authorizationServers/${authServerId}/scopes`);
if (!scopesOk) { console.error('Failed to list scopes:', existingScopes); process.exit(1); }
const existingNames = new Set(existingScopes.map(s => s.name));

const scopesToCreate = [
  { name: 'payroll.read', displayName: 'Read Payroll Records', description: 'View pay stubs, pay summaries, and tax withholding elections', consent: 'IMPLICIT', metadataPublish: 'ALL_CLIENTS' },
  { name: 'payroll.adjust', displayName: 'Adjust Payroll', description: 'Submit salary adjustment requests (restricted to hr_admin role)', consent: 'IMPLICIT', metadataPublish: 'ALL_CLIENTS' },
];

for (const scope of scopesToCreate) {
  if (existingNames.has(scope.name)) {
    console.log(`  SKIP  ${scope.name}  (already exists)`);
    continue;
  }
  const { ok, status, body } = await apiFetch(`/api/v1/authorizationServers/${authServerId}/scopes`, {
    method: 'POST',
    body: JSON.stringify(scope),
  });
  if (ok) {
    console.log(`  OK    ${scope.name}  id=${body.id}`);
  } else {
    console.error(`  FAIL  ${scope.name}  HTTP ${status}:`, JSON.stringify(body));
  }
}

console.log('\nDone. Next: update the resource connection policy in Directory → AI Agents to include payroll.read and payroll.adjust.');
