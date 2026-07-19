import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, parseIdToken, groupsToRole } from '@/lib/oidc';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    const desc = searchParams.get('error_description') ?? errorParam;
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(desc)}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=missing_code', req.url));
  }

  const session = await getSession();
  const nonce = session.nonce ?? '';
  const pkceVerifier = session.pkceVerifier ?? '';

  try {
    const { idToken, accessToken, expiresIn } = await exchangeCode(code, pkceVerifier);
    const { sub, email, name, groups } = await parseIdToken(idToken, nonce);
    const role = groupsToRole(groups);

    session.sub = sub;
    session.email = email;
    session.name = name;
    session.groups = groups;
    session.role = role;
    session.idToken = idToken;
    session.accessToken = accessToken;
    session.expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    delete session.nonce;
    delete session.pkceVerifier;
    await session.save();

    return NextResponse.redirect(new URL('/', req.url));
  } catch (err) {
    console.error('Callback error:', err);
    const msg = err instanceof Error ? err.message : 'auth_error';
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(msg)}`, req.url));
  }
}
