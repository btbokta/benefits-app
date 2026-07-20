'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AuditRow {
  id: number;
  ts: string;
  actor: string;
  userSub: string;
  tool: string;
  scopeRequired: string;
  decision: 'allow' | 'deny';
  httpStatus: number;
  detail: string;
  tokenJti: string;
}

const ORG = process.env.NEXT_PUBLIC_OKTA_ORG_URL ?? '';

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'allow' | 'deny'>('all');

  useEffect(() => {
    fetch('/api/audit-proxy')
      .then(r => r.json())
      .then((d: AuditRow[] | { error?: string }) => {
        if (Array.isArray(d)) setRows(d);
        else setError((d as { error?: string }).error ?? JSON.stringify(d));
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r => filter === 'all' || r.decision === filter);
  const allowCount = rows.filter(r => r.decision === 'allow').length;
  const denyCount  = rows.filter(r => r.decision === 'deny').length;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 120px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, system-ui', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.02em' }}>
            Audit Log
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Every authorization decision — each token JTI links to Okta&apos;s System Log
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {ORG && (
            <a href={`${ORG}/admin/reports/systemlog`} target="_blank" rel="noopener noreferrer"
               style={{ fontSize: 12, color: 'var(--blue-l)', textDecoration: 'none', fontFamily: 'DM Mono, monospace' }}>
              Okta System Log →
            </a>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', count: rows.length, active: filter === 'all', onClick: () => setFilter('all'), color: 'var(--text-secondary)', bg: 'var(--bg-elevated)', border: 'var(--border-default)' },
          { label: 'Allowed', count: allowCount, active: filter === 'allow', onClick: () => setFilter('allow'), color: 'var(--green)', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.25)' },
          { label: 'Denied',  count: denyCount,  active: filter === 'deny',  onClick: () => setFilter('deny'),  color: 'var(--red)',   bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
        ].map(s => (
          <button key={s.label} onClick={s.onClick} style={{
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            background: s.active ? s.bg : 'var(--bg-surface)',
            border: `1px solid ${s.active ? s.border : 'var(--border-subtle)'}`,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: s.active ? s.color : 'var(--text-primary)' }}>{s.count}</span>
            <span style={{ fontSize: 11, color: s.active ? s.color : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
          </button>
        ))}

        {/* System Log filter */}
        {ORG && (
          <div style={{
            marginLeft: 'auto', padding: '8px 14px', borderRadius: 8,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            fontSize: 11, color: 'var(--text-muted)',
          }}>
            <span style={{ marginRight: 8 }}>System Log filter:</span>
            <code style={{ color: 'var(--text-secondary)' }}>app.oauth2.token.grant.id_jag OR workload_principal.*</code>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', paddingTop: 48, color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>Loading audit records…</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 10, padding: 16, color: 'var(--red)', fontSize: 13,
        }}>
          {error.includes('insufficient_scope') || error.includes('forbidden')
            ? 'Okta denied access — requires benefits.audit.read (hr_admin role only)'
            : error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 48, color: 'var(--text-muted)', fontSize: 13 }}>
          No {filter !== 'all' ? filter + 'ed ' : ''}audit records yet — make some agent queries first.
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                {['Time', 'Tool', 'User', 'Scope', 'Decision', 'HTTP', 'JTI', 'Detail'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace',
                    fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                    fontWeight: 400,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  background: r.decision === 'deny' ? 'rgba(248,113,113,0.04)' : 'transparent',
                  transition: 'background 0.1s',
                }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(r.ts).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}>
                    {r.tool}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.userSub}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'DM Mono, monospace', color: 'var(--cyan)', fontSize: 11 }}>
                    {r.scopeRequired.replace('benefits.', '')}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                      ...(r.decision === 'allow'
                        ? { background: 'rgba(52,211,153,0.12)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.25)' }
                        : { background: 'rgba(248,113,113,0.12)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.25)' }
                      ),
                    }}>
                      {r.decision.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{r.httpStatus}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)', fontSize: 11 }}
                      title={r.tokenJti}>
                    {r.tokenJti ? r.tokenJti.slice(0, 8) + '…' : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
