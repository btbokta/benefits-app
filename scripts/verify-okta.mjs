#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
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
const SSWS = { Authorization: `SSWS ${TOKEN}`, Accept: 'application/json' };

async function check(label, url, validate) {
  try {
    const res = await fetch(url, { headers: SSWS });
    const body = await res.json().catch(() => ({}));
    const ok = res.ok && validate(body);
    console.log(`${ok ? '✅' : '❌'} ${label}`);
    return ok;
  } catch (e) {
    console.log(`❌ ${label} — ${e.message}`);
    return false;
  }
}

console.log('\nVerifying Okta org setup…\n');

await check('Groups: BenefitsDemo-HR-Admins exists', `${ORG}/api/v1/groups?q=BenefitsDemo-HR-Admins&limit=5`, b => Array.isArray(b) && b.some(g => g.profile?.name === 'BenefitsDemo-HR-Admins'));
await check('Groups: BenefitsDemo-Benefits-Team exists', `${ORG}/api/v1/groups?q=BenefitsDemo-Benefits-Team&limit=5`, b => Array.isArray(b) && b.some(g => g.profile?.name === 'BenefitsDemo-Benefits-Team'));
await check('Groups: BenefitsDemo-Managers exists', `${ORG}/api/v1/groups?q=BenefitsDemo-Managers&limit=5`, b => Array.isArray(b) && b.some(g => g.profile?.name === 'BenefitsDemo-Managers'));
await check('Users: sarah.johnson exists', `${ORG}/api/v1/users/sarah.johnson%40acmecorp.example`, b => !!b.id);
await check('Users: emily.davis exists', `${ORG}/api/v1/users/emily.davis%40acmecorp.example`, b => !!b.id);
await check('Web app exists', `${ORG}/api/v1/apps?q=Benefits+Agent+-+Web&limit=5`, b => Array.isArray(b) && b.some(a => a.label === 'Benefits Agent - Web'));
await check('Agent client exists', `${ORG}/api/v1/apps?q=Benefits+Agent+-+Agent+Client&limit=5`, b => Array.isArray(b) && b.some(a => a.label === 'Benefits Agent - Agent Client'));
await check('Custom AS: benefits.record.read scope', `${ORG}/api/v1/authorizationServers/default/scopes?limit=200`, b => Array.isArray(b) && b.some(s => s.name === 'benefits.record.read'));
await check('Custom AS: benefits.compensation.read scope', `${ORG}/api/v1/authorizationServers/default/scopes?limit=200`, b => Array.isArray(b) && b.some(s => s.name === 'benefits.compensation.read'));
await check('Custom AS: groups claim', `${ORG}/api/v1/authorizationServers/default/claims?limit=200`, b => Array.isArray(b) && b.some(c => c.name === 'groups'));
await check('Custom AS: Benefits Agent Policy', `${ORG}/api/v1/authorizationServers/default/policies?limit=50`, b => Array.isArray(b) && b.some(p => p.name === 'Benefits Agent Policy'));
await check('Trusted origin: localhost:3000', `${ORG}/api/v1/trustedOrigins?limit=50`, b => Array.isArray(b) && b.some(o => o.origin === 'http://localhost:3000'));

console.log('\nDone. Fix any ❌ above before proceeding to Phase 3.');
