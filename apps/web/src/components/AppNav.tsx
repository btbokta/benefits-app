'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { href: '/chat',      label: 'Agent',       icon: '◈' },
  { href: '/flow',      label: 'Token Flow',  icon: '⬡' },
  { href: '/audit',     label: 'Audit',       icon: '▦' },
  { href: '/story',     label: 'Demo Guide',  icon: '◎' },
];

interface Me {
  authenticated: boolean;
  name?: string;
  role?: string;
  email?: string;
  mode?: string;
}

const ROLE_COLORS: Record<string, string> = {
  hr_admin:            'rgba(251,191,36,0.15)',
  benefits_specialist: 'rgba(34,211,238,0.15)',
  manager:             'rgba(192,132,252,0.15)',
  employee:            'rgba(52,211,153,0.15)',
};
const ROLE_TEXT: Record<string, string> = {
  hr_admin:            '#fbbf24',
  benefits_specialist: '#67e8f9',
  manager:             '#d8b4fe',
  employee:            '#6ee7b7',
};

export function AppNav() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then((d: Me) => setMe(d))
      .catch(() => {});
  }, [pathname]);

  return (
    <nav style={{
      background: 'rgba(5,12,27,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 0 }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginRight: 32 }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'white',
            fontFamily: 'Syne, system-ui, sans-serif',
          }}>AI</div>
          <span style={{ fontFamily: 'Syne, system-ui', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Benefits Portal
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: -4 }}>/ Okta for AI</span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {NAV_LINKS.map(link => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link key={link.href} href={link.href} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 6,
                fontSize: 12, textDecoration: 'none',
                color: active ? 'var(--blue-l)' : 'var(--text-muted)',
                background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
                border: active ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}
              >
                <span style={{ fontSize: 11, opacity: 0.8 }}>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right: user pill + mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {me?.mode && (
            <span style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 4,
              background: 'rgba(34,211,238,0.08)',
              border: '1px solid rgba(34,211,238,0.18)',
              color: 'var(--cyan)',
              fontFamily: 'DM Mono, monospace',
            }}>
              mode:{me.mode}
            </span>
          )}

          {me?.authenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '4px 10px 4px 6px', borderRadius: 20,
                background: me.role ? ROLE_COLORS[me.role] : 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--blue), var(--cyan))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'white',
                  fontFamily: 'Syne, sans-serif',
                }}>
                  {(me.name ?? 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.2 }}>{me.name?.split(' ')[0]}</div>
                  {me.role && (
                    <div style={{ fontSize: 10, color: me.role ? ROLE_TEXT[me.role] : 'var(--text-muted)', lineHeight: 1 }}>
                      {me.role.replace('_', ' ')}
                    </div>
                  )}
                </div>
              </div>
              <a href="/auth/logout-client" style={{
                fontSize: 11, color: 'var(--text-muted)',
                textDecoration: 'none', padding: '4px 8px',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >sign out</a>
            </div>
          ) : (
            <a href="/auth/login" style={{
              padding: '5px 14px', borderRadius: 6,
              background: 'var(--blue)', color: 'white',
              fontSize: 12, textDecoration: 'none',
              fontFamily: 'DM Mono, monospace',
            }}>Sign in</a>
          )}
        </div>
      </div>
    </nav>
  );
}
