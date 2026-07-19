import { SignJWT, importJWK } from 'jose';
import { randomUUID } from 'node:crypto';

export async function clientAssertion(
  clientId: string,
  privateJwk: string,
  kid: string,
  tokenEndpoint: string
): Promise<string> {
  const key = await importJWK(JSON.parse(privateJwk), 'RS256');
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
