import { NextRequest, NextResponse } from 'next/server';
import { buildLogoutUrl } from '@/lib/oidc';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const idToken = session.idToken ?? '';
  session.destroy();

  // If no id token, skip Okta RP-initiated logout — just go home
  if (!idToken) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  try {
    const logoutUrl = await buildLogoutUrl(idToken);
    return NextResponse.redirect(logoutUrl);
  } catch {
    return NextResponse.redirect(new URL('/', req.url));
  }
}
