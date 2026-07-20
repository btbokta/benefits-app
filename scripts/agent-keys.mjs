#!/usr/bin/env node
// Node 18 polyfill for Web Crypto global (required by jose)
import { webcrypto } from 'node:crypto';
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

/**
 * Phase 5.1 — Generate RS256 JWK pair for the agent's private-key-JWT authentication.
 * - Writes private JWK (single-line JSON) to .env as OKTA_AGENT_PRIVATE_JWK + OKTA_AGENT_KID
 * - Prints the PUBLIC JWK to stdout for pasting into Okta Directory → AI Agents → Credentials → Add public key
 */
import { generateKeyPair, exportJWK } from 'jose';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const envPath = resolve(root, '.env');

const kid = randomUUID();
const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });

const privateJwk = await exportJWK(privateKey);
privateJwk.kid = kid;
privateJwk.use = 'sig';
privateJwk.alg = 'RS256';

const publicJwk = await exportJWK(publicKey);
publicJwk.kid = kid;
publicJwk.use = 'sig';
publicJwk.alg = 'RS256';

const privateJwkStr = JSON.stringify(privateJwk);

// Update .env
let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

function setEnvVar(content, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (re.test(content)) return content.replace(re, line);
  return content + `\n${line}`;
}

envContent = setEnvVar(envContent, 'OKTA_AGENT_KID', kid);
envContent = setEnvVar(envContent, 'OKTA_AGENT_PRIVATE_JWK', `'${privateJwkStr}'`);
writeFileSync(envPath, envContent);

console.log('\n✅ Agent key pair generated and written to .env');
console.log(`   Kid: ${kid}`);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PUBLIC JWK — paste this into Okta:');
console.log('  Directory → AI Agents → [your agent] → Credentials tab → Add public key');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(JSON.stringify(publicJwk, null, 2));
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\nAfter adding the key in Okta:');
console.log('  1. Click the ⋯ menu on the key → Activate');
console.log('  2. Copy the Agent Client ID shown on the page → add to .env as OKTA_AGENT_CLIENT_ID');
