#!/usr/bin/env node
/**
 * Symlinks root .env into each app so Next.js and the resource server pick it up.
 * Run automatically before `npm run dev`.
 */
import { symlinkSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, '.env');

if (!existsSync(src)) {
  console.error('No .env found at', src);
  process.exit(1);
}

const targets = [
  resolve(root, 'apps/web/.env.local'),
  resolve(root, 'apps/resource-server/.env'),
];

for (const target of targets) {
  try {
    if (existsSync(target)) unlinkSync(target);
    symlinkSync(src, target);
    console.log('  linked', target.replace(root, '.'));
  } catch (e) {
    console.error('  failed to link', target, e.message);
  }
}
