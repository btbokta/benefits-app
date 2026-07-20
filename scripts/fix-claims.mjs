#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function loadEnv() {
  const p = resolve(root, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k && v) process.env[k] = v;
  }
}
loadEnv();

const ORG = (process.env.OKTA_ORG_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.OKTA_API_TOKEN ?? '';
const SSWS = { Authorization: `SSWS ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' };

async function api(method, path, body) {
  const res = await fetch(`${ORG}${path}`, {
    method, headers: SSWS,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

function setEnvVar(content, key, value) {
  if (!value) return content;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, `${key}=${value}`);
  return content.trimEnd() + `\n${key}=${value}\n`;
}

// ── Fix groups claim ──────────────────────────────────────────────────────────
console.log('\n[2.6] Groups claim (fix)');
const { body: existingClaims } = await api('GET', '/api/v1/authorizationServers/default/claims?limit=200');
const hasClaim = Array.isArray(existingClaims) && existingClaims.some(c => c.name === 'groups');

if (hasClaim) {
  console.log('  ✓ groups claim already exists');
} else {
  for (const claimType of ['RESOURCE', 'IDENTITY']) {
    const { status, body } = await api('POST', '/api/v1/authorizationServers/default/claims', {
      name: 'groups',
      status: 'ACTIVE',
      claimType,
      valueType: 'GROUPS',
      group_filter_type: 'REGEX',
      value: '^(HR-Admins|Benefits-Team|Managers|Employees)$',
      conditions: { scopes: [] },
    });
    console.log(`  ${status < 300 ? '✓' : '✗'} ${claimType}: ${status}${status >= 300 ? ' — ' + body.errorSummary : ''}`);
  }
}

// ── Get web client secret ─────────────────────────────────────────────────────
console.log('\n[Fix] Web client secret');
const webClientId = process.env.OKTA_WEB_CLIENT_ID ?? '';
if (webClientId) {
  const { body: apps } = await api('GET', `/api/v1/apps?q=${encodeURIComponent('Benefits Agent - Web')}&limit=5`);
  const app = Array.isArray(apps) ? apps.find(a => a.credentials?.oauthClient?.client_id === webClientId) : null;
  if (app) {
    const secret = app.credentials?.oauthClient?.client_secret;
    if (secret) {
      let env = readFileSync(resolve(root, '.env'), 'utf8');
      env = setEnvVar(env, 'OKTA_WEB_CLIENT_SECRET', secret);
      writeFileSync(resolve(root, '.env'), env);
      console.log('  ✓ OKTA_WEB_CLIENT_SECRET written');
    } else {
      console.log('  ⚠ secret not in response — checking credentials endpoint');
      const { body: creds } = await api('GET', `/api/v1/apps/${app.id}`);
      const s2 = creds.credentials?.oauthClient?.client_secret;
      if (s2) {
        let env = readFileSync(resolve(root, '.env'), 'utf8');
        env = setEnvVar(env, 'OKTA_WEB_CLIENT_SECRET', s2);
        writeFileSync(resolve(root, '.env'), env);
        console.log('  ✓ OKTA_WEB_CLIENT_SECRET written');
      } else {
        console.log('  ✗ Could not retrieve secret — you may need to rotate it in the console');
        console.log('    Applications → Benefits Agent - Web → Client Credentials → Edit → Rotate secret');
      }
    }
  }
} else {
  console.log('  ⚠ OKTA_WEB_CLIENT_ID not set');
}

// ── Get agent client secret ───────────────────────────────────────────────────
console.log('\n[Fix] Agent client secret');
const agentClientId = process.env.OKTA_AGENT_CLIENT_ID ?? '';
if (agentClientId) {
  const { body: apps } = await api('GET', `/api/v1/apps?q=${encodeURIComponent('Benefits Agent - Agent Client')}&limit=5`);
  const app = Array.isArray(apps) ? apps.find(a => a.credentials?.oauthClient?.client_id === agentClientId) : null;
  if (app) {
    const secret = app.credentials?.oauthClient?.client_secret;
    if (secret) {
      let env = readFileSync(resolve(root, '.env'), 'utf8');
      env = setEnvVar(env, 'OKTA_AGENT_CLIENT_SECRET', secret);
      writeFileSync(resolve(root, '.env'), env);
      console.log('  ✓ OKTA_AGENT_CLIENT_SECRET written');
    } else {
      console.log('  ✓ No client_secret (service app — Mode A will use private key JWT)');
    }
  }
}

console.log('\nDone. Run: node scripts/verify-okta.mjs');
