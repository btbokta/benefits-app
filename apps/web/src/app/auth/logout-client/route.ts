import { NextRequest, NextResponse } from 'next/server';
import { buildLogoutUrl } from '@/lib/oidc';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const idToken = session.idToken ?? '';
  session.destroy();

  try {
    const logoutUrl = await buildLogoutUrl(idToken);
    return NextResponse.redirect(logoutUrl);
  } catch {
    return NextResponse.redirect(new URL('/', req.url));
  }
}
