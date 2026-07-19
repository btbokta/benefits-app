import { NextResponse } from 'next/server';
import { buildAuthorizeUrl, generatePkce, generateState, generateNonce } from '@/lib/oidc';
import { getSession } from '@/lib/session';

export async function GET() {
  const { verifier, challenge } = generatePkce();
  const state = generateState();
  const nonce = generateNonce();

  const session = await getSession();
  session.nonce = nonce;
  session.pkceVerifier = verifier;
  await session.save();

  const url = await buildAuthorizeUrl(state, nonce, challenge);
  return NextResponse.redirect(url);
}
