#!/usr/bin/env node
import { loadEnv } from './load-env.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

loadEnv(resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env'));

const ORG = (process.env.OKTA_ORG_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.OKTA_API_TOKEN ?? '';
const H = { Authorization: `SSWS ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' };

async function api(method, path, body) {
  const res = await fetch(ORG + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// Find the Benefits Agent Policy
const { body: policies } = await api('GET', '/api/v1/authorizationServers/default/policies?limit=50');
const policy = Array.isArray(policies) ? policies.find(p => p.name === 'Benefits Agent Policy') : null;
if (!policy) { console.error('Benefits Agent Policy not found'); process.exit(1); }

console.log('Policy:', policy.id);
console.log('Current clients:', JSON.stringify(policy.conditions?.clients));

// Widen to ALL_CLIENTS so the AI agent workload principal can use the jwt-bearer grant
const { status, body } = await api('PUT', `/api/v1/authorizationServers/default/policies/${policy.id}`, {
  ...policy,
  conditions: { ...policy.conditions, clients: { include: ['ALL_CLIENTS'] } },
});
console.log('Update status:', status);
if (status < 300) {
  console.log('✅ Policy now allows ALL_CLIENTS');
} else {
  console.error('❌', JSON.stringify(body));
}

// Also verify the rule has jwt-bearer grant
const { body: rules } = await api('GET', `/api/v1/authorizationServers/default/policies/${policy.id}/rules?limit=50`);
const rule = Array.isArray(rules) ? rules.find(r => r.name === 'Allow benefits flows') : null;
if (rule) {
  const grants = rule.conditions?.grantTypes?.include ?? [];
  const hasJwtBearer = grants.includes('urn:ietf:params:oauth:grant-type:jwt-bearer');
  console.log(`Rule grant types: ${grants.join(', ')}`);
  console.log(`jwt-bearer present: ${hasJwtBearer ? '✅' : '❌'}`);
  if (!hasJwtBearer) {
    const { status: rs } = await api('PUT', `/api/v1/authorizationServers/default/policies/${policy.id}/rules/${rule.id}`, {
      ...rule,
      conditions: {
        ...rule.conditions,
        grantTypes: { include: [...grants, 'urn:ietf:params:oauth:grant-type:jwt-bearer'] },
      },
    });
    console.log(`Added jwt-bearer to rule: ${rs < 300 ? '✅' : '❌'} (${rs})`);
  }
} else {
  console.log('Rule not found — check policy manually');
}
