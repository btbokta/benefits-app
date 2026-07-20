import { SignJWT, importJWK, importPKCS8 } from 'jose';
import { randomUUID } from 'node:crypto';

async function importPrivateKey(keyMaterial: string) {
  const trimmed = keyMaterial.trim();
  if (trimmed.startsWith('-----BEGIN')) {
    // PEM format (PKCS#8) — what Okta generates
    return importPKCS8(trimmed, 'RS256');
  }
  // JWK format
  return importJWK(JSON.parse(trimmed), 'RS256');
}

export async function clientAssertion(
  clientId: string,
  privateKeyMaterial: string,
  kid: string,
  tokenEndpoint: string
): Promise<string> {
  const key = await importPrivateKey(privateKeyMaterial);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(tokenEndpoint)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setJti(randomUUID())
    .sign(key);
}
