import { STORY_BEATS } from '@/lib/story/config';
import Link from 'next/link';

const GROUPS = [
  {
    name: 'BenefitsDemo-HR-Admins',
    color: 'var(--persona-hr)',
    bg: 'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.25)',
    persona: 'Sarah Johnson',
    role: 'hr_admin',
    purpose: 'Full access to all 7 benefits scopes, including compensation, HR notes, and the audit log. Used to demonstrate that Okta grants broader permissions to higher-privilege roles.',
    scopes: ['record.read', 'compensation.read', 'notes.read', 'enrollment.read', 'enrollment.write', 'pto.read', 'audit.read'],
  },
  {
    name: 'BenefitsDemo-Benefits-Team',
    color: 'var(--persona-specialist)',
    bg: 'rgba(34,211,238,0.08)',
    border: 'rgba(34,211,238,0.25)',
    persona: 'James Wilson',
    role: 'benefits_specialist',
    purpose: 'Can manage enrollments for all employees but cannot see salary or HR notes. Shows that scopes can be role-specific without admin access.',
    scopes: ['record.read', 'enrollment.read', 'enrollment.write', 'pto.read'],
  },
  {
    name: 'BenefitsDemo-Managers',
    color: 'var(--persona-manager)',
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.25)',
    persona: 'Michael Chen',
    role: 'manager',
    purpose: 'Can view records and PTO for themselves and their direct reports only. Demonstrates row-level enforcement — even with the right scope, the resource server filters by relationship.',
    scopes: ['record.read', 'enrollment.read', 'pto.read'],
  },
  {
    name: 'BenefitsDemo-Employees',
    color: 'var(--persona-employee)',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
    persona: 'Emily Davis, Lisa Park',
    role: 'employee',
    purpose: 'Self-only access. No compensation or notes scopes. The key persona for the live denial demo — when Emily asks for salary data, Okta returns 403 with missing_scopes in the response.',
    scopes: ['record.read', 'enrollment.read', 'enrollment.write', 'pto.read'],
  },
];

const PERSONA_COLOR: Record<string, string> = {
  emily: 'var(--persona-employee)',
  sarah: 'var(--persona-hr)',
  michael: 'var(--persona-manager)',
};

const ACTION_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  query:    { label: 'auto',   bg: 'rgba(16,185,129,0.1)',  color: 'var(--allow)',            border: 'rgba(16,185,129,0.25)' },
  navigate: { label: 'nav',    bg: 'rgba(34,211,238,0.1)',  color: 'var(--persona-specialist)',border: 'rgba(34,211,238,0.25)' },
  manual:   { label: 'manual', bg: 'rgba(144,144,150,0.1)', color: 'var(--on-surface-variant)',border: 'var(--outline-variant)' },
};

export default function StoryPage() {
  return (
    <div style={{ padding: '40px 40px 120px', maxWidth: 860 }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 2, background: 'rgba(195,198,210,0.1)', border: '1px solid rgba(195,198,210,0.2)', color: 'var(--primary)', letterSpacing: '0.06em' }}>
            DEMO GUIDE
          </span>
        </div>
        <h1 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 30, color: 'var(--on-surface)', letterSpacing: '-0.02em', marginBottom: 10 }}>
          Okta for AI — Presenter Script
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'var(--on-surface-variant)', lineHeight: 1.65, maxWidth: 600 }}>
          A step-by-step walkthrough showing how real Okta tokens gate every AI agent action —
          from employee login through live denial to the audit trail.
        </p>
      </div>

      {/* Groups reference */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--on-surface)', marginBottom: 4 }}>
          Okta Groups &amp; Roles
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 16 }}>
          Each group maps to a scope ceiling. Okta enforces these — the app never checks permissions itself.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {GROUPS.map(g => (
            <div key={g.name} style={{
              background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
              borderLeft: `3px solid ${g.color}`,
              borderRadius: '0 0.25rem 0.25rem 0',
              padding: '16px 20px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                      padding: '3px 10px', borderRadius: 2,
                      background: g.bg, border: `1px solid ${g.border}`, color: g.color,
                    }}>{g.name}</span>
                  </div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 4 }}>
                    <span style={{ color: 'var(--outline)' }}>Persona: </span>{g.persona}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: g.color }}>
                    {g.role.replace('_', ' ')}
                  </div>
                </div>
                <div>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.6, marginBottom: 10 }}>
                    {g.purpose}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {g.scopes.map(s => (
                      <span key={s} className="scope-chip" style={{ fontSize: 10 }}>{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--outline)', marginTop: 12 }}>
          Password for all personas: <span style={{ color: 'var(--on-surface-variant)' }}>SEED_USER_PASSWORD</span> from your .env
        </p>
      </section>

      {/* Story beats */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--on-surface)' }}>
            Story Beats
          </h2>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--outline)' }}>
            {STORY_BEATS.length} steps
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {STORY_BEATS.map(beat => {
            const actionBadge = beat.action ? ACTION_BADGE[beat.action] : null;
            const personaColor = beat.requiresPersona ? PERSONA_COLOR[beat.requiresPersona] : null;
            return (
              <a key={beat.step} href={`/?story=${beat.step}`} style={{
                display: 'grid', gridTemplateColumns: '36px 1fr auto',
                gap: 14, alignItems: 'start',
                background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
                borderRadius: '0.25rem', padding: '14px 16px',
                textDecoration: 'none', transition: 'border-color 0.15s, background 0.15s',
              }}
              className="story-beat-row"
              >
                {/* Step number */}
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 2, textAlign: 'center',
                  background: 'rgba(195,198,210,0.1)', border: '1px solid rgba(195,198,210,0.2)', color: 'var(--primary)',
                }}>{beat.step}</div>

                {/* Content */}
                <div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--on-surface)', marginBottom: 4 }}>
                    {beat.title}
                  </div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--on-surface-variant)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {beat.narration}
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
                  {beat.requiresPersona && (
                    <span className="label-caps" style={{
                      padding: '2px 8px', borderRadius: 2,
                      background: personaColor ? `${personaColor}18` : 'var(--surface-high)',
                      border: `1px solid ${personaColor ? `${personaColor}40` : 'var(--outline-variant)'}`,
                      color: personaColor ?? 'var(--on-surface-variant)',
                    }}>{beat.requiresPersona}</span>
                  )}
                  {actionBadge && (
                    <span className="label-caps" style={{
                      padding: '2px 8px', borderRadius: 2,
                      background: actionBadge.bg, border: `1px solid ${actionBadge.border}`, color: actionBadge.color,
                    }}>{actionBadge.label}</span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <a href="/?story=1" className="btn btn-primary" style={{ textDecoration: 'none', fontSize: 14 }}>
          <span className="material-symbols-outlined fill-1" style={{ fontSize: 16 }}>play_circle</span>
          Begin Demo from Step 1
        </a>
        <Link href="/" className="btn btn-ghost" style={{ textDecoration: 'none', fontSize: 14 }}>
          Back to Dashboard
        </Link>
      </div>

      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--outline)', marginTop: 16 }}>
        Each step is URL-addressable — share{' '}
        <span style={{ color: 'var(--on-surface-variant)' }}>/?story=7</span>{' '}
        to jump directly to the live denial beat.
      </p>
    </div>
  );
}
