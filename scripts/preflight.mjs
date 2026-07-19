#!/usr/bin/env node
/**
 * Phase 0 preflight — probes Okta org for Mode A availability.
 * Reads OKTA_ORG_URL + OKTA_API_TOKEN from .env, prints four probe results,
 * exits 0 on success, 1 on fatal error.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

// Load .env
function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) {
    console.error('ERROR: .env not found at', envPath);
    console.error('Create it from .env.example and fill in OKTA_ORG_URL + OKTA_API_TOKEN');
    process.exit(1);
  }
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) process.env[key] = val;
  }
}

loadEnv();

const org = (process.env.OKTA_ORG_URL || '').replace(/\/$/, '');
const token = process.env.OKTA_API_TOKEN || '';

if (!org || !token) {
  console.error('FATAL: OKTA_ORG_URL and OKTA_API_TOKEN must be set in .env');
  process.exit(1);
}

async function probe(label, url, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: true, status: res.status, body };
    }
    return { ok: false, status: res.status, body: {} };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

const ssws = { Authorization: `SSWS ${token}` };

console.log(`\nPreflight probing: ${org}\n`);

const results = [];

// Probe 1: org info
const p1 = await probe('org', `${org}/api/v1/org`, ssws);
if (!p1.ok) {
  console.error(`FATAL: ${org}/api/v1/org returned ${p1.status} — check OKTA_ORG_URL and OKTA_API_TOKEN`);
  process.exit(1);
}
console.log(`✅ Org: ${p1.body.name || org} (${p1.body.edition || 'unknown edition'})`);
results.push({ probe: 'org_api', ok: true, detail: p1.body.name });

// Probe 2: org AS discovery
const p2 = await probe('org-AS', `${org}/.well-known/openid-configuration`);
const p2ok = p2.ok && p2.body.issuer === org;
console.log(`${p2ok ? '✅' : '❌'} Org AS discovery: ${p2ok ? 'reachable' : `FAILED (${p2.status})`}`);
results.push({ probe: 'org_as', ok: p2ok });

// Probe 3: custom AS discovery
const p3 = await probe('custom-AS', `${org}/oauth2/default/.well-known/openid-configuration`);
const p3ok = p3.ok && !!p3.body.issuer;
console.log(`${p3ok ? '✅' : '❌'} Custom AS (default): ${p3ok ? `issuer=${p3.body.issuer}` : `FAILED (${p3.status})`}`);
results.push({ probe: 'custom_as', ok: p3ok });

// Probe 4: AI Agents API (Mode A availability)
const p4 = await probe('ai-agents-api', `${org}/workload-principals/api/v1/ai-agents`, ssws);
let modeA = false;
if (p4.ok || p4.status === 200) {
  modeA = true;
  console.log('✅ MODE A AVAILABLE — Okta for AI Agents API responded 200');
} else {
  console.log(`⚠️  MODE A NOT AVAILABLE (${p4.status}) — Directory → AI Agents API not reachable`);
  console.log('   Falling back to Mode C (obo) unless Directory → AI Agents is visible in the console.');
}
results.push({ probe: 'mode_a_api', ok: modeA, status: p4.status });

// Write PROGRESS.md
const ts = new Date().toISOString();
const progressPath = resolve(root, 'PROGRESS.md');
const progressContent = existsSync(progressPath) ? readFileSync(progressPath, 'utf8') : '';
const entry = `
## Phase 0 Preflight — ${ts}

| Probe | Result |
|---|---|
| Org API | ${results[0].ok ? '✅ ' + results[0].detail : '❌'} |
| Org AS discovery | ${results[1].ok ? '✅' : '❌'} |
| Custom AS (default) | ${results[2].ok ? '✅' : '❌'} |
| Mode A API | ${results[3].ok ? '✅ Available' : `⚠️ Not available (${results[3].status})`} |

OKTA_AI_MODE recommendation: \`${modeA ? 'agents' : 'obo'}\`
`;
writeFileSync(progressPath, progressContent + entry);
console.log('\nPROGRESS.md updated.');

const allOk = results.slice(0, 3).every(r => r.ok);
if (!allOk) {
  console.error('\n❌ One or more required probes failed. Fix the above before proceeding.');
  process.exit(1);
}

console.log('\n✅ GATE 0 passed — org reachable, both AS discovery docs OK.');
console.log(`   Recommended OKTA_AI_MODE: ${modeA ? 'agents' : 'obo'}`);
