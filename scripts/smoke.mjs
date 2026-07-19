#!/usr/bin/env node
/**
 * Phase 10 — Pre-demo smoke test.
 * Checks all critical surfaces without requiring a live Okta token.
 */
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

const org = (process.env.OKTA_ORG_URL ?? '').replace(/\/$/, '');
const webBase = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const rsBase = process.env.RESOURCE_BASE_URL ?? 'http://localhost:3001';

async function check(label, fn) {
  try {
    const ok = await fn();
    console.log(`${ok ? '✅' : '❌'} ${label}`);
    return ok;
  } catch (e) {
    console.log(`❌ ${label} — ${e.message}`);
    return false;
  }
}

console.log('\nSmoke test…\n');

await check('RS /healthz up', async () => {
  const r = await fetch(`${rsBase}/healthz`);
  const b = await r.json();
  return r.ok && b.ok === true;
});

await check('RS /.well-known/oauth-protected-resource (RFC 9728)', async () => {
  const r = await fetch(`${rsBase}/.well-known/oauth-protected-resource`);
  const b = await r.json();
  return r.ok && Array.isArray(b.scopes_supported) && b.scopes_supported.includes('benefits.record.read');
});

await check('RS /api/employees → 401 with WWW-Authenticate', async () => {
  const r = await fetch(`${rsBase}/api/employees`);
  return r.status === 401 && (r.headers.get('www-authenticate') ?? '').includes('resource_metadata');
});

await check('Web / up', async () => {
  const r = await fetch(`${webBase}/`);
  return r.ok;
});

await check('Web /api/me → 401 (unauthenticated)', async () => {
  const r = await fetch(`${webBase}/api/me`);
  return r.status === 401;
});

if (org) {
  await check('Okta org AS reachable', async () => {
    const r = await fetch(`${org}/.well-known/openid-configuration`);
    return r.ok;
  });

  await check('Okta custom AS reachable', async () => {
    const r = await fetch(`${org}/oauth2/default/.well-known/openid-configuration`);
    return r.ok;
  });
}

console.log('\nSmoke test done. Fix any ❌ before presenting.');
