import { getSessionUser } from '@/lib/session';
import { ROLE_SCOPES } from '@benefits-agent/shared';
import Link from 'next/link';
import { StartDemoButton } from './StartDemoButton';

const PERSONAS = [
  { name: 'Sarah Johnson', email: 'sarah.johnson@acmecorp.example', role: 'hr_admin',            note: 'All 7 scopes — compensation, notes, audit' },
  { name: 'James Wilson',  email: 'james.wilson@acmecorp.example',  role: 'benefits_specialist', note: 'Enrollment admin — no compensation data' },
  { name: 'Michael Chen',  email: 'michael.chen@acmecorp.example',  role: 'manager',             note: 'Self + direct reports (Emily, Lisa, Marcus)' },
  { name: 'Emily Davis',   email: 'emily.davis@acmecorp.example',   role: 'employee',            note: 'Self only — no salary or HR notes' },
  { name: 'Lisa Park',     email: 'lisa.park@acmecorp.example',     role: 'employee',            note: 'Self only — no salary or HR notes' },
];

const ROLE_COLOR: Record<string, { accent: string; bg: string }> = {
  hr_admin:            { accent: 'var(--persona-hr)',         bg: 'rgba(251,191,36,0.1)' },
  benefits_specialist: { accent: 'var(--persona-specialist)', bg: 'rgba(34,211,238,0.1)' },
  manager:             { accent: 'var(--persona-manager)',    bg: 'rgba(168,85,247,0.1)' },
  employee:            { accent: 'var(--persona-employee)',   bg: 'rgba(34,197,94,0.1)' },
};

export default async function HomePage() {
  const user = await getSessionUser();

  return (
    <div style={{ padding: '40px 40px 120px', maxWidth: 1040 }}>

      {/* Hero */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span className="pulse-dot" />
          <span className="label-caps" style={{ color: 'var(--allow)' }}>System active</span>
          <span style={{ color: 'var(--outline-variant)', margin: '0 4px' }}>·</span>
          <span className="label-caps" style={{ color: 'var(--on-surface-variant)' }}>Okta for AI — Mode A</span>
        </div>
        <h1 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--on-surface)', marginBottom: 14 }}>
          Every data access<br />authorized by Okta
        </h1>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: 16, lineHeight: 1.65, maxWidth: 520 }}>
          An AI agent acts on behalf of a signed-in employee. Every tool call presents a real
          Okta-issued token via the two-hop ID-JAG exchange — no hardcoded permission checks
          anywhere in the application code.
        </p>
      </section>

      {/* Auth state */}
      {user ? (
        <section style={{
          background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
          borderRadius: '0.5rem', padding: 24, marginBottom: 32,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: ROLE_COLOR[user.role]?.bg,
                border: `1px solid ${ROLE_COLOR[user.role]?.accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 18,
                color: ROLE_COLOR[user.role]?.accent,
              }}>{user.name[0]}</div>
              <div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--on-surface)' }}>{user.name}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>{user.email}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {user.groups.map(g => (
                    <span key={g} className="label-caps" style={{
                      padding: '2px 8px', borderRadius: 2,
                      background: 'var(--surface-high)', border: '1px solid var(--outline-variant)',
                      color: 'var(--on-surface-variant)',
                    }}>{g}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{
              padding: '6px 14px', borderRadius: 2,
              background: ROLE_COLOR[user.role]?.bg,
              border: `1px solid ${ROLE_COLOR[user.role]?.accent}`,
            }}>
              <div className="label-caps" style={{ color: ROLE_COLOR[user.role]?.accent }}>
                {user.role.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Scope ceiling */}
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--outline-variant)' }}>
            <div className="label-caps" style={{ color: 'var(--on-surface-variant)', marginBottom: 10 }}>
              Scope ceiling — what the agent may request on your behalf
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ROLE_SCOPES[user.role].map(s => (
                <span key={s} className="scope-chip">{s}</span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/chat" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined fill-1" style={{ fontSize: 17 }}>smart_toy</span>
              Chat with Agent
            </Link>
            <Link href="/flow" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>account_tree</span>
              Token Flow
            </Link>
            <StartDemoButton />
          </div>
        </section>
      ) : (
        <section style={{
          background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
          borderRadius: '0.5rem', padding: 40, marginBottom: 32, textAlign: 'center',
        }}>
          <span className="material-symbols-outlined fill-1" style={{ fontSize: 40, color: 'var(--primary)', display: 'block', marginBottom: 12 }}>
            lock_person
          </span>
          <p style={{ color: 'var(--on-surface-variant)', marginBottom: 20, fontSize: 15 }}>
            Sign in with Okta to access the Benefits Portal
          </p>
          <a href="/auth/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Sign in with Okta
          </a>
          <div style={{ marginTop: 14 }}>
            <Link href="/story" style={{ fontSize: 13, color: 'var(--on-surface-variant)', textDecoration: 'none' }}>
              View Demo Guide →
            </Link>
          </div>
        </section>
      )}

      {/* Personas */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--on-surface)' }}>
            Demo Personas
          </h2>
          <span className="label-caps" style={{ color: 'var(--on-surface-variant)' }}>
            password: SEED_USER_PASSWORD from .env
          </span>
        </div>

        <div style={{ border: '1px solid var(--outline-variant)', borderRadius: '0.5rem', overflow: 'hidden', background: 'var(--surface-low)' }}>
          {PERSONAS.map((p, i) => {
            const rc = ROLE_COLOR[p.role];
            return (
              <div key={p.email} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                gap: 16, alignItems: 'center',
                padding: '14px 20px',
                borderBottom: i < PERSONAS.length - 1 ? '1px solid var(--outline-variant)' : 'none',
                background: 'transparent',
                transition: 'background 0.1s',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--on-surface)' }}>
                      {p.name}
                    </span>
                    <span className="label-caps" style={{
                      padding: '2px 8px', borderRadius: 2,
                      background: rc?.bg, color: rc?.accent,
                      border: `1px solid ${rc?.accent}40`,
                    }}>{p.role.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                      {p.email}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--outline)', fontStyle: 'italic' }}>{p.note}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 300 }}>
                  {ROLE_SCOPES[p.role as keyof typeof ROLE_SCOPES].map(s => (
                    <span key={s} style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 500,
                      padding: '2px 6px', borderRadius: 2,
                      background: 'var(--surface-high)', border: '1px solid var(--outline-variant)',
                      color: 'var(--on-surface-variant)',
                    }}>{s.replace('benefits.', '')}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
