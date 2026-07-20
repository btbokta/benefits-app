import { getSessionUser } from '@/lib/session';
import { ROLE_SCOPES } from '@benefits-agent/shared';
import Link from 'next/link';
import { StartDemoButton } from './StartDemoButton';

const PERSONAS = [
  { name: 'Sarah Johnson', email: 'sarah.johnson@acmecorp.example', role: 'hr_admin',            note: 'All 7 scopes — salary, notes, audit' },
  { name: 'James Wilson',  email: 'james.wilson@acmecorp.example',  role: 'benefits_specialist', note: 'Enrollment admin — no compensation' },
  { name: 'Michael Chen',  email: 'michael.chen@acmecorp.example',  role: 'manager',             note: 'Self + direct reports only' },
  { name: 'Emily Davis',   email: 'emily.davis@acmecorp.example',   role: 'employee',            note: 'Self only — no salary or notes' },
  { name: 'Lisa Park',     email: 'lisa.park@acmecorp.example',     role: 'employee',            note: 'Self only — no salary or notes' },
];

const ROLE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  hr_admin:            { bg: 'rgba(251,191,36,0.1)',  text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  benefits_specialist: { bg: 'rgba(34,211,238,0.1)',  text: '#67e8f9', border: 'rgba(34,211,238,0.25)' },
  manager:             { bg: 'rgba(192,132,252,0.1)', text: '#d8b4fe', border: 'rgba(192,132,252,0.25)' },
  employee:            { bg: 'rgba(52,211,153,0.1)',  text: '#6ee7b7', border: 'rgba(52,211,153,0.25)' },
};

export default async function HomePage() {
  const user = await getSessionUser();

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 120px' }}>

      {/* Hero */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            fontSize: 10, padding: '3px 10px', borderRadius: 20,
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
            color: '#93c5fd', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em',
          }}>OKTA FOR AI — MODE A</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }} className="pulse-dot">LIVE</div>
        </div>
        <h1 style={{ fontFamily: 'Syne, system-ui', fontWeight: 800, fontSize: 36, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 12, letterSpacing: '-0.03em' }}>
          Benefits Portal<br />
          <span style={{ background: 'linear-gradient(90deg, #3b82f6, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Secured by Okta for AI
          </span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 560, lineHeight: 1.7 }}>
          Every data access authorized by a real Okta-issued token. The AI agent exchanges
          the user's ID token for a scoped Bearer token via the two-hop ID-JAG protocol —
          no hardcoded permission checks in application code.
        </p>
      </div>

      {/* Signed-in user card */}
      {user ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 16, padding: 24, marginBottom: 32,
          boxShadow: '0 0 40px rgba(59,130,246,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--blue), var(--cyan))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'white',
                flexShrink: 0,
              }}>{user.name[0]}</div>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user.email}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {user.groups.map(g => (
                    <span key={g} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Role</div>
              <div style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 6,
                background: ROLE_COLOR[user.role]?.bg ?? 'var(--bg-elevated)',
                border: `1px solid ${ROLE_COLOR[user.role]?.border ?? 'var(--border-default)'}`,
                color: ROLE_COLOR[user.role]?.text ?? 'var(--text-primary)',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13,
              }}>{user.role.replace('_', ' ')}</div>
            </div>
          </div>

          {/* Scope ceiling */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Scope ceiling — what the agent may request</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ROLE_SCOPES[user.role].map(s => (
                <span key={s} className="scope-chip">{s}</span>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/chat" style={{
              padding: '9px 18px', borderRadius: 8, background: 'var(--blue)',
              color: 'white', textDecoration: 'none', fontSize: 13,
              fontFamily: 'DM Mono, monospace', transition: 'background 0.15s',
            }}>◈ Chat with Agent</Link>
            <Link href="/flow" style={{
              padding: '9px 18px', borderRadius: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13,
              fontFamily: 'DM Mono, monospace',
            }}>⬡ Token Flow</Link>
            <Link href="/audit" style={{
              padding: '9px 18px', borderRadius: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13,
              fontFamily: 'DM Mono, monospace',
            }}>▦ Audit Log</Link>
            <StartDemoButton />
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 16, padding: 32, marginBottom: 32, textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
            Sign in with Okta to access the Benefits Portal
          </p>
          <a href="/auth/login" style={{
            display: 'inline-block', padding: '10px 24px', borderRadius: 8,
            background: 'var(--blue)', color: 'white', textDecoration: 'none',
            fontSize: 13, fontFamily: 'DM Mono, monospace',
          }}>Sign in with Okta</a>
          <div style={{ marginTop: 16 }}>
            <a href="/story" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
              ◎ View Demo Guide →
            </a>
          </div>
        </div>
      )}

      {/* Persona table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Syne, system-ui', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            Demo Personas
          </h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>password: SEED_USER_PASSWORD from .env</span>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {PERSONAS.map(p => {
            const rc = ROLE_COLOR[p.role];
            return (
              <div key={p.email} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 10, padding: '14px 18px',
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center',
                transition: 'border-color 0.15s',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>{p.name}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 4,
                      background: rc?.bg, border: `1px solid ${rc?.border}`, color: rc?.text,
                      fontFamily: 'DM Mono, monospace',
                    }}>{p.role.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{p.email}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.note}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 320 }}>
                  {ROLE_SCOPES[p.role as keyof typeof ROLE_SCOPES].map(s => (
                    <span key={s} style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 3,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace',
                    }}>{s.replace('benefits.', '').replace('.', ' ')}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LogoutButton() {
  return (
    <form action="/auth/logout-client" method="get">
      <button type="submit" style={{
        padding: '9px 18px', borderRadius: 8,
        background: 'transparent', border: '1px solid var(--border-default)',
        color: 'var(--text-muted)', fontSize: 13,
        fontFamily: 'DM Mono, monospace', cursor: 'pointer',
      }}>Sign out</button>
    </form>
  );
}
