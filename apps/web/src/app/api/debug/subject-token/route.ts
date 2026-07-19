import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';

// Dev-only: returns the subject token used by the broker for manual testing
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_available' }, { status: 404 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const mode = process.env.OKTA_AI_MODE ?? 'obo';
  const subjectToken = mode === 'obo' ? user.accessToken : user.idToken;
  const preview = subjectToken.slice(0, 12) + '...';

  return NextResponse.json({
    mode,
    subjectTokenType: mode === 'obo' ? 'access_token' : 'id_token',
    preview,
    subjectToken,
  });
}
