'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV = [
  { href: '/',       label: 'Dashboard',   icon: 'shield_person' },
  { href: '/flow',   label: 'Token Flows', icon: 'account_tree'  },
  { href: '/chat',   label: 'Agent Chat',  icon: 'smart_toy'     },
  { href: '/audit',  label: 'Audit Log',   icon: 'list_alt'      },
  { href: '/story',  label: 'Demo Guide',  icon: 'play_circle'   },
];

interface Me {
  authenticated?: boolean;
  name?: string;
  role?: string;
  email?: string;
  mode?: string;
}

const ROLE_COLOR: Record<string, string> = {
  hr_admin:            'var(--persona-hr)',
  benefits_specialist: 'var(--persona-specialist)',
  manager:             'var(--persona-manager)',
  employee:            'var(--persona-employee)',
};

export function AppNav() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then((d: Me) => setMe(d)).catch(() => {});
  }, [pathname]);

  return (
    <>
      {/* ── Top bar ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64, zIndex: 50,
        background: 'rgba(19,19,20,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(69,70,75,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px 0 272px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--primary)', letterSpacing: '-0.01em' }}>
            Benefits Portal
          </span>
          <span style={{ color: 'rgba(144,144,150,0.5)', fontSize: 14 }}>/</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--on-surface-variant)' }}>
            {NAV.find(n => pathname === n.href || (pathname.startsWith(n.href) && n.href !== '/'))?.label ?? 'Dashboard'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {me?.mode && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 2,
              background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)',
              color: 'var(--cyan)', letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>mode:{me.mode}</span>
          )}
          <span className="pulse-dot" style={{ marginRight: 4 }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--allow)' }}>LIVE</span>

          {me?.authenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 12px 5px 6px',
                background: 'var(--surface)', border: '1px solid var(--outline-variant)',
                borderRadius: 2,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: `rgba(${me.role === 'hr_admin' ? '251,191,36' : me.role === 'manager' ? '168,85,247' : '34,211,238'},0.2)`,
                  border: `1px solid ${ROLE_COLOR[me.role ?? ''] ?? 'var(--outline-variant)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 12,
                  color: ROLE_COLOR[me.role ?? ''] ?? 'var(--primary)',
                }}>
                  {(me.name ?? 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--on-surface)', lineHeight: 1.2 }}>
                    {me.name?.split(' ')[0]}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: ROLE_COLOR[me.role ?? ''] ?? 'var(--on-surface-variant)', lineHeight: 1 }}>
                    {me.role?.replace('_', ' ')}
                  </div>
                </div>
              </div>
              <a href="/auth/logout-client" style={{
                fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--on-surface-variant)',
                textDecoration: 'none', padding: '5px 10px', borderRadius: 2,
                background: 'transparent', border: '1px solid transparent',
                transition: 'color 0.15s',
              }}>sign out</a>
            </div>
          ) : (
            <a href="/auth/login" style={{
              fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14,
              padding: '7px 18px', borderRadius: 2,
              background: 'var(--primary)', color: 'var(--on-primary)',
              textDecoration: 'none',
            }}>Sign in</a>
          )}
        </div>
      </header>

      {/* ── Sidebar ── */}
      <aside style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: 248, zIndex: 40,
        background: 'var(--surface-low)', borderRight: '1px solid rgba(69,70,75,0.4)',
        display: 'flex', flexDirection: 'column', paddingTop: 64,
      }}>
        {/* Brand block */}
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="material-symbols-outlined fill-1" style={{ color: 'var(--primary)', fontSize: 18 }}>security</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.05em' }}>
              OPERATOR CONSOLE
            </span>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--on-surface-variant)', opacity: 0.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Okta for AI — Identity Signal
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => {
            const active = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: '0.25rem',
                textDecoration: 'none',
                background: active ? 'rgba(69,73,95,0.6)' : 'transparent',
                color: active ? 'var(--secondary)' : 'var(--on-surface-variant)',
                transition: 'background 0.15s, color 0.15s',
              }}>
                <span className={`material-symbols-outlined ${active ? 'fill-1' : ''}`} style={{ fontSize: 20, flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(69,70,75,0.3)' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--outline-variant)', letterSpacing: '0.04em' }}>
            ID-JAG Protocol — Mode A
          </div>
        </div>
      </aside>
    </>
  );
}
