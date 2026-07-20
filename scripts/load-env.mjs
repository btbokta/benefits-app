/**
 * Shared env loader — handles multi-line quoted values (e.g. PEM keys).
 * Import and call loadEnv() before reading process.env in any script.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadEnv(envPath) {
  const path = envPath ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (!existsSync(path)) return;

  const content = readFileSync(path, 'utf8');
  // Split on newlines, but reassemble multi-line quoted values
  const lines = [];
  let buffer = '';
  let inQuote = false;

  for (const raw of content.split('\n')) {
    if (!inQuote) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const val = trimmed.slice(eq + 1);
      // Check if value starts with a quote that isn't closed on this line
      const quoteChar = val[0];
      if ((quoteChar === '"' || quoteChar === "'") && !val.slice(1).includes(quoteChar)) {
        buffer = raw;
        inQuote = true;
        continue;
      }
      buffer = raw;
    } else {
      buffer += '\n' + raw;
      const quoteChar = buffer[buffer.indexOf('=') + 1];
      // Check if the closing quote appears
      const afterFirst = buffer.slice(buffer.indexOf('=') + 2);
      if (afterFirst.includes(quoteChar)) {
        inQuote = false;
      } else {
        continue;
      }
    }

    const line = buffer.trim();
    buffer = '';
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1);

    // Strip surrounding quotes and unescape \n within single-line values
    const q = v[0];
    if ((q === '"' || q === "'") && v.endsWith(q) && v.length > 1) {
      v = v.slice(1, -1);
    }
    // Unescape literal \n sequences (Option B single-line format)
    v = v.replace(/\\n/g, '\n');

    if (k && !process.env[k]) process.env[k] = v;
  }
}
