#!/usr/bin/env node
/**
 * Phase 2 — Idempotent Okta org setup.
 * Creates: groups, users, web app, agent client (Mode C), custom AS scopes,
 * groups claim, access policy+rule, trusted origin.
 * Safe to re-run — searches first, creates only if absent.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function loadEnv() {
  const p = resolve(root, '.env');
  if (!existsSync(p)) { console.error('No .env — run preflight first'); process.exit(1); }
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
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Welcome1!';
const REDIRECT_URI = process.env.OKTA_REDIRECT_URI ?? 'http://localhost:3000/auth/callback';

if (!ORG || !TOKEN) { console.error('OKTA_ORG_URL and OKTA_API_TOKEN required'); process.exit(1); }

const SSWS = { Authorization: `SSWS ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' };

async function api(method, path, body) {
  const res = await fetch(`${ORG}${path}`, { method, headers: SSWS, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) {
    console.error(`API error ${method} ${path}: ${res.status} ${JSON.stringify(json)}`);
  }
  return { status: res.status, body: json };
}

async function getOrCreate(searchPath, searchQuery, createPath, createBody, idField = 'id') {
  const { body: found } = await api('GET', `${searchPath}?q=${encodeURIComponent(searchQuery)}&limit=5`);
  if (Array.isArray(found) && found.length > 0) {
    const match = found[0];
    console.log(`  ✓ already exists: ${match[idField] ?? match.id}`);
    return match;
  }
  const { body: created, status } = await api('POST', createPath, createBody);
  if (status >= 200 && status < 300) {
    console.log(`  ✓ created: ${created[idField] ?? created.id}`);
    return created;
  }
  console.error(`  ✗ failed: ${JSON.stringify(created)}`);
  return null;
}

// ── 2.1 Groups ────────────────────────────────────────────────────────────────
console.log('\n[2.1] Groups');
const groupNames = ['BenefitsDemo-HR-Admins', 'BenefitsDemo-Benefits-Team', 'BenefitsDemo-Managers', 'BenefitsDemo-Employees'];
const groups = {};
for (const name of groupNames) {
  process.stdout.write(`  ${name}: `);
  const g = await getOrCreate('/api/v1/groups', name, '/api/v1/groups', { profile: { name, description: 'Benefits demo' } });
  if (g) groups[name] = g.id;
}

// ── 2.2 Users ─────────────────────────────────────────────────────────────────
console.log('\n[2.2] Users');
const personas = [
  { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@acmecorp.example', group: 'BenefitsDemo-HR-Admins' },
  { firstName: 'James', lastName: 'Wilson', email: 'james.wilson@acmecorp.example', group: 'BenefitsDemo-Benefits-Team' },
  { firstName: 'Michael', lastName: 'Chen', email: 'michael.chen@acmecorp.example', group: 'BenefitsDemo-Managers' },
  { firstName: 'Emily', lastName: 'Davis', email: 'emily.davis@acmecorp.example', group: 'BenefitsDemo-Employees' },
  { firstName: 'Lisa', lastName: 'Park', email: 'lisa.park@acmecorp.example', group: 'BenefitsDemo-Employees' },
];

const createdUsers = {};
for (const p of personas) {
  process.stdout.write(`  ${p.email}: `);
  const { body: found } = await api('GET', `/api/v1/users/${encodeURIComponent(p.email)}`);
  let user = found?.id ? found : null;
  if (!user) {
    const { body: created, status } = await api('POST', '/api/v1/users?activate=true', {
      profile: { firstName: p.firstName, lastName: p.lastName, email: p.email, login: p.email },
      credentials: { password: { value: PASSWORD } },
    });
    user = status < 300 ? created : null;
    if (user) console.log(`created: ${user.id}`);
    else { console.log('failed'); continue; }
  } else {
    console.log(`exists: ${user.id}`);
  }
  createdUsers[p.email] = user.id;
  // Add to their primary group
  if (groups[p.group] && user.id) {
    await api('PUT', `/api/v1/groups/${groups[p.group]}/users/${user.id}`, {});
  }
  // Everyone goes in Employees
  if (p.group !== 'BenefitsDemo-Employees' && groups['BenefitsDemo-Employees'] && user.id) {
    await api('PUT', `/api/v1/groups/${groups['BenefitsDemo-Employees']}/users/${user.id}`, {});
  }
}

// ── 2.3 Web app ───────────────────────────────────────────────────────────────
console.log('\n[2.3] Web App');
let webClientId = process.env.OKTA_WEB_CLIENT_ID ?? '';
let webClientSecret = process.env.OKTA_WEB_CLIENT_SECRET ?? '';

if (!webClientId) {
  const { body: apps } = await api('GET', '/api/v1/apps?q=Benefits+Agent+-+Web&limit=5');
  const existing = Array.isArray(apps) ? apps.find(a => a.label === 'Benefits Agent - Web') : null;
  if (existing) {
    webClientId = existing.credentials?.oauthClient?.client_id ?? existing.id;
    webClientSecret = existing.credentials?.oauthClient?.client_secret ?? '';
    console.log(`  ✓ exists: ${webClientId}`);
  } else {
    const { body: created, status } = await api('POST', '/api/v1/apps', {
      name: 'oidc_client',
      label: 'Benefits Agent - Web',
      signOnMode: 'OPENID_CONNECT',
      credentials: { oauthClient: { token_endpoint_auth_method: 'client_secret_basic' } },
      settings: {
        oauthClient: {
          redirect_uris: [REDIRECT_URI],
          post_logout_redirect_uris: ['http://localhost:3000'],
          response_types: ['code'],
          grant_types: ['authorization_code', 'refresh_token'],
          application_type: 'web',
          consent_method: 'TRUSTED',
        },
      },
    });
    if (status < 300) {
      webClientId = created.credentials?.oauthClient?.client_id ?? created.id;
      webClientSecret = created.credentials?.oauthClient?.client_secret ?? '';
      console.log(`  ✓ created: ${webClientId}`);
    } else {
      console.error('  ✗ failed to create web app');
    }
  }
  // Assign groups to app
  for (const gid of Object.values(groups)) {
    const appId = webClientId || 'unknown';
    // Need the actual app ID (not client ID) for group assignment
    // We'll look it up by client ID
    const { body: appsById } = await api('GET', `/api/v1/apps?q=${encodeURIComponent('Benefits Agent - Web')}&limit=5`);
    const app = Array.isArray(appsById) ? appsById.find(a => a.credentials?.oauthClient?.client_id === webClientId) : null;
    if (app) {
      await api('PUT', `/api/v1/apps/${app.id}/groups/${gid}`, {});
    }
  }
}

// ── 2.4 Agent client (Mode C) ─────────────────────────────────────────────────
console.log('\n[2.4] Agent Client (Mode C API Services)');
let agentClientId = process.env.OKTA_AGENT_CLIENT_ID ?? '';
let agentClientSecret = process.env.OKTA_AGENT_CLIENT_SECRET ?? '';

if (!agentClientId) {
  const { body: apps } = await api('GET', '/api/v1/apps?q=Benefits+Agent+-+Agent+Client&limit=5');
  const existing = Array.isArray(apps) ? apps.find(a => a.label === 'Benefits Agent - Agent Client') : null;
  if (existing) {
    agentClientId = existing.credentials?.oauthClient?.client_id ?? existing.id;
    agentClientSecret = existing.credentials?.oauthClient?.client_secret ?? '';
    console.log(`  ✓ exists: ${agentClientId}`);
  } else {
    const { body: created, status } = await api('POST', '/api/v1/apps', {
      name: 'oidc_client',
      label: 'Benefits Agent - Agent Client',
      signOnMode: 'OPENID_CONNECT',
      credentials: { oauthClient: { token_endpoint_auth_method: 'client_secret_basic' } },
      settings: {
        oauthClient: {
          response_types: ['token'],
          grant_types: ['client_credentials'],
          application_type: 'service',
        },
      },
    });
    if (status < 300) {
      agentClientId = created.credentials?.oauthClient?.client_id ?? created.id;
      agentClientSecret = created.credentials?.oauthClient?.client_secret ?? '';
      console.log(`  ✓ created: ${agentClientId}`);
      console.log('  ⚠️  MANUAL STEP NEEDED: Go to Applications → Benefits Agent - Agent Client → General Settings → Edit → Grant type → Advanced → enable "Token Exchange" → Save');
    } else {
      console.error('  ✗ failed — see error above. Try enabling Token Exchange manually.');
    }
  }
}

// ── 2.5 Custom AS scopes ──────────────────────────────────────────────────────
console.log('\n[2.5] Custom AS scopes');
const scopeNames = [
  'benefits.record.read',
  'benefits.compensation.read',
  'benefits.notes.read',
  'benefits.enrollment.read',
  'benefits.enrollment.write',
  'benefits.pto.read',
  'benefits.audit.read',
];

const { body: existingScopes } = await api('GET', '/api/v1/authorizationServers/default/scopes?limit=200');
const existingScopeNames = new Set(Array.isArray(existingScopes) ? existingScopes.map(s => s.name) : []);

for (const name of scopeNames) {
  if (existingScopeNames.has(name)) {
    console.log(`  ✓ scope exists: ${name}`);
  } else {
    const { status } = await api('POST', '/api/v1/authorizationServers/default/scopes', {
      name,
      description: `Benefits Agent — ${name}`,
      consent: 'IMPLICIT',
      metadataPublish: 'ALL_CLIENTS',
    });
    console.log(`  ${status < 300 ? '✓ created' : '✗ failed'}: ${name}`);
  }
}

// ── 2.6 Groups claim ──────────────────────────────────────────────────────────
console.log('\n[2.6] Groups claim on custom AS');
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
      value: '^(BenefitsDemo-HR-Admins|BenefitsDemo-Benefits-Team|BenefitsDemo-Managers|BenefitsDemo-Employees)$',
      conditions: { scopes: [] },
    });
    console.log(`  ${status < 300 ? '✓' : '✗'} groups claim (${claimType}): ${status}${status >= 300 ? ' — ' + JSON.stringify(body?.errorSummary) : ''}`);
  }
}

// ── 2.7 Access policy ─────────────────────────────────────────────────────────
console.log('\n[2.7] Access policy');
const { body: policies } = await api('GET', '/api/v1/authorizationServers/default/policies?limit=50');
const existingPolicy = Array.isArray(policies) ? policies.find(p => p.name === 'Benefits Agent Policy') : null;
let policyId = existingPolicy?.id;

if (!policyId) {
  // Get web app's numeric ID
  const { body: webApps } = await api('GET', `/api/v1/apps?q=${encodeURIComponent('Benefits Agent - Web')}&limit=5`);
  const webApp = Array.isArray(webApps) ? webApps.find(a => a.credentials?.oauthClient?.client_id === webClientId) : null;
  const agentApps = await api('GET', `/api/v1/apps?q=${encodeURIComponent('Benefits Agent - Agent Client')}&limit=5`);
  const agentApp = Array.isArray(agentApps.body) ? agentApps.body.find(a => a.credentials?.oauthClient?.client_id === agentClientId) : null;

  const clientIds = [webApp?.id, agentApp?.id].filter(Boolean);

  const { body: policy, status } = await api('POST', '/api/v1/authorizationServers/default/policies', {
    type: 'OAUTH_AUTHORIZATION_POLICY',
    name: 'Benefits Agent Policy',
    description: 'Benefits Agent demo',
    priority: 1,
    conditions: { clients: { include: clientIds.length > 0 ? clientIds : ['ALL_CLIENTS'] } },
  });
  policyId = policy?.id;
  console.log(`  ${status < 300 ? '✓ created' : '✗ failed'} policy: ${policyId}`);
} else {
  console.log(`  ✓ policy exists: ${policyId}`);
}

if (policyId) {
  // Get Everyone group
  const { body: everyoneGroups } = await api('GET', '/api/v1/groups?q=Everyone&limit=5');
  const everyoneId = Array.isArray(everyoneGroups) ? (everyoneGroups.find(g => g.profile?.name === 'Everyone')?.id ?? 'EVERYONE') : 'EVERYONE';

  const { body: existingRules } = await api('GET', `/api/v1/authorizationServers/default/policies/${policyId}/rules?limit=50`);
  const ruleExists = Array.isArray(existingRules) && existingRules.some(r => r.name === 'Allow benefits flows');
  if (!ruleExists) {
    const { status } = await api('POST', `/api/v1/authorizationServers/default/policies/${policyId}/rules`, {
      type: 'RESOURCE_ACCESS',
      name: 'Allow benefits flows',
      priority: 1,
      conditions: {
        people: { groups: { include: [everyoneId] } },
        grantTypes: {
          include: [
            'authorization_code',
            'client_credentials',
            'urn:ietf:params:oauth:grant-type:token-exchange',
            'urn:ietf:params:oauth:grant-type:jwt-bearer',
          ],
        },
        scopes: { include: ['*'] },
      },
      actions: {
        token: {
          accessTokenLifetimeMinutes: 60,
          refreshTokenLifetimeMinutes: 0,
          refreshTokenWindowMinutes: 10080,
        },
      },
    });
    console.log(`  ${status < 300 ? '✓' : '✗'} policy rule: ${status}`);
  } else {
    console.log('  ✓ policy rule exists');
  }
}

// ── 2.8 Trusted origin ────────────────────────────────────────────────────────
console.log('\n[2.8] Trusted origin');
const { body: origins } = await api('GET', '/api/v1/trustedOrigins?limit=50');
const originExists = Array.isArray(origins) && origins.some(o => o.origin === 'http://localhost:3000');
if (originExists) {
  console.log('  ✓ trusted origin exists');
} else {
  const { status } = await api('POST', '/api/v1/trustedOrigins', {
    name: 'localhost-web',
    origin: 'http://localhost:3000',
    scopes: [{ type: 'CORS' }, { type: 'REDIRECT' }],
  });
  console.log(`  ${status < 300 ? '✓ created' : '✗ failed'}: ${status}`);
}

// ── Write .env additions ───────────────────────────────────────────────────────
console.log('\n[ENV] Writing values to .env');
const envPath = resolve(root, '.env');
let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

function setEnvVar(content, key, value) {
  if (!value) return content;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, `${key}=${value}`);
  return content + `\n${key}=${value}`;
}

envContent = setEnvVar(envContent, 'OKTA_WEB_CLIENT_ID', webClientId);
envContent = setEnvVar(envContent, 'OKTA_WEB_CLIENT_SECRET', webClientSecret);
envContent = setEnvVar(envContent, 'OKTA_AGENT_CLIENT_ID', agentClientId);
envContent = setEnvVar(envContent, 'OKTA_AGENT_CLIENT_SECRET', agentClientSecret);
writeFileSync(envPath, envContent);
console.log(`  OKTA_WEB_CLIENT_ID=${webClientId || '(not set)'}`);
console.log(`  OKTA_AGENT_CLIENT_ID=${agentClientId || '(not set)'}`);

// ── 2.9 Manual step reminder ──────────────────────────────────────────────────
console.log('\n[2.9] MANUAL STEP (Mode A/B):');
console.log('  Applications → Benefits Agent - Web → Sign On tab → OpenID Connect ID Token → Edit');
console.log('  Groups claim filter: groups   Matches regex   ^(BenefitsDemo-HR-Admins|BenefitsDemo-Benefits-Team|BenefitsDemo-Managers|BenefitsDemo-Employees)$');
console.log('  → Save');

console.log('\n✅ GATE 2 setup complete. Run: node scripts/verify-okta.mjs');
