'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ── Static hop metadata ───────────────────────────────────────────────────────
const ORG = process.env.NEXT_PUBLIC_OKTA_ORG_URL ?? '{org}';

const HOP_META = {
  modeA: [
    { label: 'Hop 1', grantType: 'token-exchange → id-jag', endpoint: `${ORG}/oauth2/v1/token` },
    { label: 'Hop 2', grantType: 'jwt-bearer → access_token', endpoint: `${ORG}/oauth2/default/v1/token` },
  ],
  modeC: [
    { label: 'Exchange', grantType: 'token-exchange → delegated', endpoint: `${ORG}/oauth2/default/v1/token` },
  ],
};

// ── Claim tooltips ────────────────────────────────────────────────────────────
const CLAIM_DESCRIPTIONS: Record<string, string> = {
  sub:    'Subject — the user this token was issued for',
  scp:    'Scopes — what this token is allowed to access',
  scope:  'Scopes — what this token is allowed to access',
  cid:    'Client ID — the OAuth app (agent) holding this token',
  typ:    'Token type — oauth-id-jag+jwt identifies an ID-JAG',
  jti:    'JWT ID — unique; matches the Okta System Log event',
  aud:    'Audience — the service(s) this token is intended for',
  act:    'Actor — delegation chain (agent acting for user)',
  iss:    'Issuer — the Okta AS that minted this token',
  exp:    'Expiration — Unix timestamp when this token expires',
  groups: 'Groups — used to derive role → scope ceiling',
};

const HIGHLIGHTED = ['sub','scp','scope','cid','act','groups','jti','typ','aud','iss'];

// ── Node config ───────────────────────────────────────────────────────────────
const NODE_CFG = [
  { color: 'var(--token-id)',    bg: 'rgba(59,130,246,0.08)',   glow: 'glow-id',    icon: 'fingerprint', label: 'ORIGIN' },
  { color: 'var(--token-jag)',   bg: 'rgba(139,92,246,0.08)',   glow: 'glow-jag',   icon: 'hub',         label: 'BRIDGE' },
  { color: 'var(--token-agent)', bg: 'rgba(16,185,129,0.08)',   glow: 'glow-agent', icon: 'smart_toy',   label: 'EXECUTION' },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChainStage {
  stage: string;
  tokenPreview: string;
  decoded?: { header: Record<string, unknown>; payload: Record<string, unknown> };
  expiresAt?: number;
  durationMs?: number;
}
interface FlowState {
  scope: string;
  expiresAt: number;
  chain: ChainStage[];
  mode: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ttl(exp: number, now: number) {
  const s = exp - Math.floor(now / 1000);
  if (s <= 0) return 'expired';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtVal(v: unknown): string {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number' && v > 1_000_000_000) return new Date(v * 1000).toLocaleTimeString();
  return String(v);
}

// ── ClaimRow with tooltip ─────────────────────────────────────────────────────
function ClaimRow({ k, v }: { k: string; v: unknown }) {
  const hi = HIGHLIGHTED.includes(k);
  const tip = CLAIM_DESCRIPTIONS[k];
  return (
    <div style={{ display: 'flex', gap: 8, padding: '2px 0', alignItems: 'flex-start' }}>
      <span style={{ width: 54, flexShrink: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--on-surface-variant)' }}>
        {k}
      </span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: hi ? 'var(--highlight)' : 'var(--on-surface-variant)', wordBreak: 'break-all', flex: 1 }}>
        {fmtVal(v)}
      </span>
      {tip && (
        <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }} className="group">
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--outline)', cursor: 'help', userSelect: 'none' }}>?</span>
        </span>
      )}
    </div>
  );
}

// ── Token node ────────────────────────────────────────────────────────────────
function TokenNode({ id, index, stage, now, expanded, onToggle }: {
  id: string; index: number; stage: ChainStage; now: number;
  expanded: boolean; onToggle: () => void;
}) {
  const cfg = NODE_CFG[index] ?? NODE_CFG[0];
  const keyPayload = Object.entries(stage.decoded?.payload ?? {}).filter(([k]) => HIGHLIGHTED.includes(k));
  const allPayload = Object.entries(stage.decoded?.payload ?? {});
  const allHeader  = Object.entries(stage.decoded?.header ?? {});

  const delayClass = ['animate-glow', 'animate-glow-delay-1', 'animate-glow-delay-2'][index] ?? 'animate-glow';

  return (
    <div id={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 220 }}>
      {/* Circular node */}
      <button
        onClick={onToggle}
        className={delayClass + ' ' + cfg.glow}
        style={{
          width: 110, height: 110, borderRadius: '50%',
          background: cfg.bg,
          border: `2px solid ${cfg.color}60`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'transform 0.2s',
          color: cfg.color,
        }}
      >
        <span className="material-symbols-outlined fill-1" style={{ fontSize: 42, color: cfg.color }}>
          {cfg.icon}
        </span>
      </button>

      {/* Label */}
      <div style={{ textAlign: 'center' }}>
        <div className="label-caps" style={{ color: cfg.color, marginBottom: 3 }}>{cfg.label}</div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--on-surface)' }}>{stage.stage}</div>
        {stage.durationMs !== undefined && (
          <div className="label-caps" style={{ color: 'var(--outline)', marginTop: 3 }}>{stage.durationMs}ms</div>
        )}
        {stage.expiresAt && (
          <div className="label-caps" style={{ color: '#fbbf24', marginTop: 2 }}>TTL {ttl(stage.expiresAt, now)}</div>
        )}
      </div>

      {/* JWT claims panel */}
      {expanded && stage.decoded && (
        <div style={{
          width: 280, background: 'var(--surface-high)',
          border: '1px solid rgba(69,70,75,0.4)',
          borderRadius: '0.25rem', padding: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--outline-variant)' }}>
            <span className="label-caps" style={{ color: 'var(--on-surface-variant)' }}>Decoded JWT</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--on-surface-variant)' }}>{stage.tokenPreview}</span>
          </div>

          {keyPayload.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="label-caps" style={{ color: 'var(--outline)', marginBottom: 5 }}>Key claims</div>
              {keyPayload.map(([k, v]) => <ClaimRow key={k} k={k} v={v} />)}
            </div>
          )}

          <details>
            <summary className="label-caps" style={{ color: 'var(--outline)', cursor: 'pointer', marginBottom: 5 }}>Full payload</summary>
            <div style={{ marginTop: 6 }}>
              <div className="label-caps" style={{ color: 'var(--outline-variant)', marginBottom: 3 }}>Header</div>
              {allHeader.map(([k, v]) => <ClaimRow key={k} k={k} v={v} />)}
              <div className="label-caps" style={{ color: 'var(--outline-variant)', marginTop: 8, marginBottom: 3 }}>Payload</div>
              {allPayload.map(([k, v]) => <ClaimRow key={k} k={k} v={v} />)}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FlowPage() {
  const [state, setState] = useState<FlowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  async function load(refresh = false) {
    setLoading(true);
    try {
      const res = await fetch(`/api/broker${refresh ? '?refresh=1' : ''}`);
      const data = await res.json() as FlowState & { error?: string };
      setState(data);
    } catch (e) {
      setState({ scope: '', expiresAt: 0, chain: [], mode: '', error: String(e) });
    } finally { setLoading(false); }
  }

  async function revoke() {
    setRevoking(true);
    await fetch('/api/broker', { method: 'DELETE' });
    setRevoking(false);
    await load(true);
  }

  useEffect(() => { load(); }, []);

  const hops = state?.mode === 'obo' ? HOP_META.modeC : HOP_META.modeA;
  const idTokenPayload = state?.chain?.[0]?.decoded?.payload ?? {};
  const userGroups = Array.isArray(idTokenPayload.groups) ? (idTokenPayload.groups as string[]) : [];
  const agentScopes = state?.scope?.split(' ').filter(Boolean) ?? [];

  return (
    <div style={{ padding: '40px 40px 120px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em', color: 'var(--on-surface)', marginBottom: 6 }}>
            Token Flow Visualizer
          </h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 14 }}>
            The cryptographic signal path through the Okta for AI ID-JAG protocol — decoded in real time
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => load(true)} disabled={loading} className="btn btn-ghost" style={{ fontSize: 13 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button onClick={revoke} disabled={revoking || loading} className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--deny)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>token</span>
            {revoking ? 'Revoking…' : 'Revoke token'}
          </button>
        </div>
      </div>

      {/* Mode bar */}
      {state && !state.error && (
        <div style={{
          display: 'flex', gap: 20, padding: '10px 16px', marginBottom: 32,
          background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
          borderRadius: '0.25rem', fontSize: 12, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span><span className="label-caps" style={{ color: 'var(--outline)' }}>mode </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--cyan)', fontWeight: 600 }}>{state.mode}</span>
          </span>
          {state.expiresAt > 0 && (
            <span><span className="label-caps" style={{ color: 'var(--outline)' }}>ttl </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#fbbf24' }}>{ttl(state.expiresAt, now)}</span>
            </span>
          )}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="label-caps" style={{ color: 'var(--outline)' }}>scopes</span>
            {agentScopes.map(s => <span key={s} className="scope-chip">{s}</span>)}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pulse-dot" />
            <span className="label-caps" style={{ color: 'var(--allow)' }}>SIGNAL ACTIVE</span>
          </div>
        </div>
      )}

      {/* Error */}
      {state?.error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.25rem', padding: 16, color: 'var(--deny)', marginBottom: 24 }}>
          {state.error}
        </div>
      )}

      {/* Not authenticated */}
      {!loading && (!state || !state.chain?.length) && !state?.error && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface-low)', border: '1px solid var(--outline-variant)', borderRadius: '0.5rem' }}>
          <span className="material-symbols-outlined fill-1" style={{ fontSize: 48, color: 'var(--outline)', display: 'block', marginBottom: 12 }}>lock_person</span>
          <p style={{ color: 'var(--on-surface-variant)', marginBottom: 20 }}>Sign in to see the live token exchange</p>
          <a href="/auth/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>Sign in with Okta</a>
        </div>
      )}

      {/* ── Flow visualization canvas ── */}
      {state && !state.error && state.chain.length > 0 && (
        <>
          <div style={{
            position: 'relative',
            background: 'rgba(14,14,15,0.5)',
            border: '1px solid rgba(69,70,75,0.2)',
            borderRadius: '0.75rem',
            padding: '48px 24px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 0, overflow: 'hidden', minHeight: 280,
          }}>
            {/* Animated SVG connector lines */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad1" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="grad2" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <linearGradient id="grad3" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              {/* Hop 1: blue → purple */}
              <path className="flow-dash" d="M28% 50% L47% 50%" fill="none" stroke="url(#grad1)" strokeWidth="1.5" />
              {/* Hop 2: purple → green */}
              <path className="flow-dash" d="M54% 50% L73% 50%" fill="none" stroke="url(#grad2)" strokeWidth="1.5" style={{ animationDelay: '-5s' }} />
              {/* To RS */}
              <path className="flow-dash" d="M79% 50% L93% 50%" fill="none" stroke="url(#grad3)" strokeWidth="1.5" style={{ animationDelay: '-10s' }} />
            </svg>

            {/* Node 1 — ID Token */}
            <TokenNode id="flow-node-0" index={0} stage={state.chain[0]} now={now}
              expanded={!!expanded[0]} onToggle={() => setExpanded(e => ({ ...e, 0: !e[0] }))} />

            {/* Hop 1 label */}
            {hops[0] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 40, flex: 1, minWidth: 0, gap: 4 }}>
                <span className="label-caps" style={{ color: 'var(--on-surface-variant)' }}>{hops[0].label}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--cyan)', textAlign: 'center' }}>{hops[0].grantType}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--outline)', textAlign: 'center', maxWidth: 140, lineHeight: 1.3 }}>
                  {hops[0].endpoint.replace(ORG, '{org}')}
                </span>
              </div>
            )}

            {/* Node 2 — ID-JAG */}
            {state.chain[1] && (
              <TokenNode id="flow-node-1" index={1} stage={state.chain[1]} now={now}
                expanded={!!expanded[1]} onToggle={() => setExpanded(e => ({ ...e, 1: !e[1] }))} />
            )}

            {/* Hop 2 label */}
            {hops[1] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 40, flex: 1, minWidth: 0, gap: 4 }}>
                <span className="label-caps" style={{ color: 'var(--on-surface-variant)' }}>{hops[1].label}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--cyan)', textAlign: 'center' }}>{hops[1].grantType}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--outline)', textAlign: 'center', maxWidth: 140, lineHeight: 1.3 }}>
                  {hops[1].endpoint.replace(ORG, '{org}')}
                </span>
              </div>
            )}

            {/* Node 3 — Agent Access Token */}
            {state.chain[2] && (
              <TokenNode id="flow-node-2" index={2} stage={state.chain[2]} now={now}
                expanded={!!expanded[2]} onToggle={() => setExpanded(e => ({ ...e, 2: !e[2] }))} />
            )}

            {/* Arrow to RS */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 40, flex: 1, minWidth: 0, gap: 4 }}>
              <span className="label-caps" style={{ color: 'var(--on-surface-variant)' }}>API call</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--allow)' }}>Bearer token</span>
            </div>

            {/* Resource server node */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 180 }}>
              <div style={{
                width: 88, height: 88, borderRadius: '0.5rem',
                background: 'rgba(34,211,238,0.06)', border: '1px dashed rgba(34,211,238,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined fill-1" style={{ fontSize: 36, color: 'var(--cyan)' }}>dns</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="label-caps" style={{ color: 'var(--cyan)' }}>RESOURCE</div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--on-surface)' }}>Server :3001</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--outline)', marginTop: 3 }}>validates iss + aud + scp</div>
              </div>
            </div>
          </div>

          {/* Scope Transformation */}
          <div style={{ marginTop: 20, background: 'var(--surface-low)', border: '1px solid var(--outline-variant)', borderRadius: '0.5rem', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--on-surface)' }}>Scope Transformation</div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 2 }}>Policy mapping during JWT translation across the secure bridge</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'var(--surface-high)', border: '1px solid var(--outline-variant)', borderRadius: 99 }}>
                <span className="pulse-dot" />
                <span className="label-caps" style={{ color: 'var(--on-surface)' }}>SIGNAL ACTIVE</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr' }}>
              {/* User identity */}
              <div style={{ padding: '24px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '0.25rem', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined fill-1" style={{ fontSize: 20, color: 'var(--token-id)' }}>person</span>
                  </div>
                  <div>
                    <div className="label-caps" style={{ color: 'var(--outline)' }}>Source</div>
                    <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--on-surface)' }}>User Role / Groups</div>
                  </div>
                </div>
                {userGroups.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {userGroups.map(g => (
                      <span key={g} className="label-caps" style={{ padding: '3px 10px', borderRadius: 2, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
                        {g}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--outline)' }}>groups claim not in ID token</p>
                )}
              </div>

              {/* Arrow */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid var(--outline-variant)', borderRight: '1px solid var(--outline-variant)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--outline)' }}>arrow_forward</span>
              </div>

              {/* Agent scopes */}
              <div style={{ padding: '24px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '0.25rem', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined fill-1" style={{ fontSize: 20, color: 'var(--token-agent)' }}>smart_toy</span>
                  </div>
                  <div>
                    <div className="label-caps" style={{ color: 'var(--outline)' }}>Agent granted</div>
                    <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--on-surface)' }}>Scoped Bearer Token</div>
                  </div>
                </div>
                {agentScopes.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {agentScopes.map(s => <span key={s} className="scope-chip">{s}</span>)}
                  </div>
                ) : (
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--outline)' }}>no scopes yet — trigger an exchange</p>
                )}
              </div>
            </div>
          </div>

          {/* Kill switch */}
          <div style={{ marginTop: 16, background: 'var(--surface-low)', border: '1px solid var(--outline-variant)', borderRadius: '0.25rem', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--on-surface)', marginBottom: 3 }}>Kill switch demo</div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                Deactivate the agent in Okta → next exchange fails with <code style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--deny)' }}>invalid_client</code>. Reactivate to restore — no code changes.
              </p>
            </div>
            <a href={`${ORG}/admin/access/ai-agents`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ textDecoration: 'none', fontSize: 13 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
              Directory → AI Agents
            </a>
          </div>
        </>
      )}
    </div>
  );
}
