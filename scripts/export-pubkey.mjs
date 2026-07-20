#!/usr/bin/env node
import { webcrypto } from 'node:crypto';
if (typeof globalThis.crypto === 'undefined') Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

import { readFileSync } from 'node:fs';
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

const privateJwk = JSON.parse(process.env.OKTA_AGENT_PRIVATE_JWK ?? '{}');
const { d, dp, dq, p, q, qi, ...publicJwk } = privateJwk;

console.log('\n=== Public JWK (try this first) ===');
console.log(JSON.stringify(publicJwk, null, 2));

const pubKey = await importJWK(publicJwk, 'RS256');
const pem = await exportSPKI(pubKey);
console.log('\n=== Public key — PEM format (try if JWK not accepted) ===');
console.log(pem);
