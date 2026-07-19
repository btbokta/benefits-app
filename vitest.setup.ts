import { webcrypto } from 'node:crypto';

// Node 18 doesn't expose Web Crypto globally — polyfill for jose
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}
