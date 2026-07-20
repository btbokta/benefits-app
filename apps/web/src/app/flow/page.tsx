'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ── Static hop metadata per mode ─────────────────────────────────────────────

const ORG = process.env.NEXT_PUBLIC_OKTA_ORG_URL ?? '{org}';

const HOP_META = {
  modeA: [
    {
      id: 'flow-hop-1',
      label: 'Hop 1',
      endpoint: `POST ${ORG}/oauth2/v1/token`,
      grantType: 'token-exchange',
      transform: 'id_token → id-jag',
      description: 'Agent presents user ID token to org AS; receives Identity Assertion JWT',
    },
    {
      id: 'flow-hop-2',
      label: 'Hop 2',
      endpoint: `POST ${ORG}/oauth2/default/v1/token`,
      grantType: 'jwt-bearer',
      transform: 'id-jag → access_token',
      description: 'Agent presents ID-JAG to custom AS; receives scoped Bearer token',
    },
  ],
  modeC: [
    {
      id: 'flow-hop-1',
      label: 'Exchange',
      endpoint: `POST ${ORG}/oauth2/default/v1/token`,
      grantType: 'token-exchange',
      transform: 'access_token → delegated access_token',
      description: 'Agent exchanges user access token for a delegated, down-scoped token',
    },
  ],
};

// ── Claim descriptions for hover tooltips ────────────────────────────────────

const CLAIM_DESCRIPTIONS: Record<string, string> = {
  sub: 'Subject — the user this token was issued for',
  scp: 'Scopes — exactly what this token is allowed to access',
  scope: 'Scopes — exactly what this token is allowed to access',
  cid: 'Client ID — the OAuth app (agent) that holds this token',
  typ: 'Token type — e.g. oauth-id-jag+jwt identifies an ID-JAG',
  jti: 'JWT ID — unique identifier; matches the Okta System Log event',
  aud: 'Audience — the service(s) this token is intended for',
  act: 'Actor — delegation chain showing who is acting on whose behalf',
  iss: 'Issuer — the Okta authorization server that minted this token',
  exp: 'Expiration — Unix timestamp when this token stops being valid',
  iat: 'Issued At — Unix timestamp when this token was created',
  groups: 'Groups — Okta groups the user belongs to (used for role derivation)',
};

const HIGHLIGHTED_CLAIMS = ['sub', 'scp', 'scope', 'cid', 'act', 'groups', 'jti', 'typ', 'aud', 'iss'];

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

function ttl(exp: number, now: number): string {
  const s = exp - Math.floor(now / 1000);
  if (s <= 0) return 'expired';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number' && (v > 1_000_000_000)) return new Date(v * 1000).toLocaleTimeString();
  return String(v);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ClaimRow({ k, v }: { k: string; v: unknown }) {
  const isHighlighted = HIGHLIGHTED_CLAIMS.includes(k);
  const description = CLAIM_DESCRIPTIONS[k];
  return (
    <div className="flex gap-2 text-xs py-0.5">
      <span className="w-16 shrink-0 text-gray-500 font-mono">{k}</span>
      <span className={`font-mono break-all ${isHighlighted ? 'text-yellow-300' : 'text-gray-400'}`}>
        {formatValue(v)}
      </span>
      {description && (
        <span className="group relative ml-auto shrink-0">
          <span className="text-gray-600 cursor-help text-xs">?</span>
          <span className="absolute right-0 bottom-full mb-1 w-56 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 leading-relaxed">
            <strong className="text-white">{k}:</strong> {description}
          </span>
        </span>
      )}
    </div>
  );
}

function TokenNode({
  id,
  index,
  stage,
  now,
  expanded,
  onToggle,
}: {
  id: string;
  index: number;
  stage: ChainStage;
  now: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const keyPayload = Object.entries(stage.decoded?.payload ?? {})
    .filter(([k]) => HIGHLIGHTED_CLAIMS.includes(k));
  const allPayload = Object.entries(stage.decoded?.payload ?? {});
  const allHeader = Object.entries(stage.decoded?.header ?? {});

  const nodeColors = [
    'border-blue-700 bg-blue-950/30',
    'border-purple-700 bg-purple-950/30',
    'border-green-700 bg-green-950/30',
  ];
  const badgeColors = ['bg-blue-900 text-blue-300', 'bg-purple-900 text-purple-300', 'bg-green-900 text-green-300'];

  return (
    <div id={id} className={`rounded-lg border ${nodeColors[index] ?? 'border-gray-700 bg-gray-900'} p-4 w-full max-w-sm`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${badgeColors[index] ?? 'bg-gray-800 text-gray-300'}`}>
            {index + 1}
          </span>
          <span className="text-white text-sm font-medium leading-tight">{stage.stage}</span>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-xs text-gray-500">{stage.tokenPreview}</div>
          {stage.expiresAt && (
            <div className="text-xs text-yellow-400 mt-0.5">{ttl(stage.expiresAt, now)}</div>
          )}
          {stage.durationMs !== undefined && (
            <div className="text-xs text-gray-500 mt-0.5">{stage.durationMs}ms</div>
          )}
        </div>
      </div>

      {/* Key claims */}
      {keyPayload.length > 0 && (
        <div className="bg-gray-950/50 rounded p-2 mb-2 space-y-0.5">
          {keyPayload.map(([k, v]) => <ClaimRow key={k} k={k} v={v} />)}
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={onToggle}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {expanded ? '▲ Hide full payload' : '▼ Show full payload'}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <div className="bg-gray-950/70 rounded p-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Header</div>
            <div className="space-y-0.5">
              {allHeader.map(([k, v]) => <ClaimRow key={k} k={k} v={v} />)}
            </div>
          </div>
          <div className="bg-gray-950/70 rounded p-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Full Payload</div>
            <div className="space-y-0.5">
              {allPayload.map(([k, v]) => <ClaimRow key={k} k={k} v={v} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HopConnector({ meta }: { meta: typeof HOP_META.modeA[0] }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-4 lg:py-0 lg:px-4 shrink-0">
      {/* Arrow — vertical on mobile, horizontal on lg */}
      <div className="flex flex-col lg:flex-row items-center gap-1 lg:gap-0">
        {/* Label above/left */}
        <div className="text-center lg:text-right lg:mr-3 max-w-[140px]">
          <div className="text-xs font-bold text-gray-300">{meta.label}</div>
          <div className="text-xs text-blue-400 font-mono mt-0.5">{meta.grantType}</div>
          <div className="text-xs text-gray-500 mt-0.5">{meta.transform}</div>
        </div>

        {/* Arrow shaft + head */}
        <div className="flex flex-col lg:flex-row items-center">
          <div className="w-px h-8 lg:w-8 lg:h-px bg-gray-600" />
          {/* Arrowhead */}
          <div className="w-0 h-0
            border-l-[6px] border-l-transparent
            border-r-[6px] border-r-transparent
            border-t-[8px] border-t-gray-500
            lg:border-t-[6px] lg:border-t-transparent
            lg:border-b-[6px] lg:border-b-transparent
            lg:border-l-[8px] lg:border-l-gray-500
            lg:border-r-0" />
        </div>
      </div>

      {/* Endpoint URL below arrow */}
      <div className="mt-2 text-center">
        <div className="text-xs text-gray-600 font-mono truncate max-w-[160px]" title={meta.endpoint}>
          {meta.endpoint.replace(ORG, '{org}')}
        </div>
      </div>
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
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function load(refresh = false) {
    setLoading(true);
    try {
      const res = await fetch(`/api/broker${refresh ? '?refresh=1' : ''}`);
      const data = await res.json() as FlowState & { error?: string };
      setState(data);
    } catch (err) {
      setState({ scope: '', expiresAt: 0, chain: [], mode: '', error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    setRevoking(true);
    await fetch('/api/broker', { method: 'DELETE' });
    setRevoking(false);
    await load(true);
  }

  useEffect(() => { load(); }, []);

  const hops = state?.mode === 'obo' ? HOP_META.modeC : HOP_META.modeA;

  // Scope transformation data
  const idTokenPayload = state?.chain[0]?.decoded?.payload ?? {};
  const userGroups = Array.isArray(idTokenPayload.groups) ? (idTokenPayload.groups as string[]) : [];
  const agentScopes = state?.scope?.split(' ').filter(Boolean) ?? [];

  return (
    <div className="max-w-6xl mx-auto p-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-white font-bold text-xl">Token Flow Visualizer</h1>
          <p className="text-gray-400 text-sm mt-1">
            The Okta for AI ID-JAG exchange — every hop decoded in real time
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm transition-colors"
          >
            {loading ? 'Loading…' : 'Refresh exchange'}
          </button>
          <button
            onClick={revoke}
            disabled={revoking || loading}
            className="bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm transition-colors"
          >
            {revoking ? 'Revoking…' : 'Revoke token'}
          </button>
          <Link href="/chat" className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm transition-colors">
            Chat →
          </Link>
          <Link href="/" className="bg-gray-800 text-gray-400 hover:text-white px-3 py-1.5 rounded text-sm transition-colors">
            Home
          </Link>
        </div>
      </div>

      {/* Mode + summary bar */}
      {state && !state.error && (
        <div className="bg-gray-900 border border-gray-700 rounded p-3 mb-6 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-400">Mode: </span>
            <span className="text-blue-400 font-bold">{state.mode}</span>
          </div>
          <div>
            <span className="text-gray-400">Scopes granted: </span>
            <span className="text-green-400 font-mono text-xs">{state.scope || '—'}</span>
          </div>
          {state.expiresAt > 0 && (
            <div>
              <span className="text-gray-400">Token TTL: </span>
              <span className="text-yellow-400">{ttl(state.expiresAt, now)}</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {state?.error && (
        <div className="bg-red-950 border border-red-700 rounded p-4 mb-6 text-red-300 text-sm">
          {state.error}
        </div>
      )}

      {/* Not authenticated */}
      {!loading && !state && (
        <div className="bg-gray-900 border border-gray-700 rounded p-8 text-center text-gray-400">
          <p className="mb-3">Sign in to see the token exchange flow.</p>
          <a href="/auth/login" className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm transition-colors inline-block">
            Sign in with Okta
          </a>
        </div>
      )}

      {/* ── Flow diagram ── */}
      {state && !state.error && state.chain.length > 0 && (
        <>
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Token Exchange Chain</h2>
          </div>

          {/* Nodes + connectors — responsive: column on mobile, row on lg */}
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-0 overflow-x-auto pb-4">
            {state.chain.map((stage, i) => (
              <div key={i} className="flex flex-col lg:flex-row items-center w-full lg:w-auto">
                <TokenNode
                  id={`flow-node-${i}`}
                  index={i}
                  stage={stage}
                  now={now}
                  expanded={!!expanded[i]}
                  onToggle={() => setExpanded(e => ({ ...e, [i]: !e[i] }))}
                />
                {i < state.chain.length - 1 && hops[i] && (
                  <HopConnector meta={hops[i]} />
                )}
              </div>
            ))}

            {/* Resource Server terminus */}
            <div className="flex flex-col lg:flex-row items-center">
              <HopConnector meta={{
                id: 'flow-hop-rs',
                label: 'API call',
                endpoint: 'Authorization: Bearer →',
                grantType: 'bearer token',
                transform: 'resource server',
                description: 'Agent presents the access token on every API call',
              }} />
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-300">RS</span>
                  <span className="text-white text-sm font-medium">Resource Server :3001</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div><span className="text-gray-500">validates: </span><span className="font-mono text-gray-300">iss + aud + exp + scp</span></div>
                  <div><span className="text-gray-500">enforces: </span><span className="font-mono text-gray-300">scope + row-level</span></div>
                  <div className="mt-2">
                    <a href={`${ORG}/admin/reports/systemlog`} target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-xs">
                      Okta System Log →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Scope transformation card ── */}
          <div className="mt-8 bg-gray-900 border border-gray-700 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Scope Transformation</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">

              {/* User identity */}
              <div className="bg-gray-950 rounded p-3">
                <div className="text-xs text-blue-400 font-semibold mb-2 uppercase tracking-wider">User identity (ID token)</div>
                {userGroups.length > 0 ? (
                  <div className="space-y-1">
                    {userGroups.map(g => (
                      <div key={g} className="text-xs font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded inline-block mr-1 mb-1">{g}</div>
                    ))}
                    <p className="text-xs text-gray-500 mt-2">Groups determine the role → scope ceiling at exchange time</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No groups claim in ID token. Groups may be included in a custom claim.</p>
                )}
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl text-gray-600">→</div>
                  <div className="text-xs text-gray-500 mt-1">Okta resource connection</div>
                  <div className="text-xs text-gray-600">scope ceiling applied</div>
                </div>
              </div>

              {/* Agent scopes */}
              <div className="bg-gray-950 rounded p-3">
                <div className="text-xs text-green-400 font-semibold mb-2 uppercase tracking-wider">Agent was granted</div>
                {agentScopes.length > 0 ? (
                  <div className="space-y-1">
                    {agentScopes.map(s => (
                      <div key={s} className="text-xs font-mono bg-green-950 text-green-300 px-2 py-0.5 rounded inline-block mr-1 mb-1">{s}</div>
                    ))}
                    <p className="text-xs text-gray-500 mt-2">Only these scopes will be accepted by the resource server</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No scopes in token yet — trigger an exchange first.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Kill switch note ── */}
          <div className="mt-4 bg-gray-900 border border-gray-700 rounded p-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-medium text-white mb-1">Kill switch demo</div>
              <p className="text-xs text-gray-400">
                Deactivate the agent in the Okta Admin Console to see all future exchanges fail with <span className="font-mono text-red-400">invalid_client</span>. Reactivate to restore access without any code changes.
              </p>
            </div>
            <a
              href={`${ORG}/admin/access/ai-agents`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Directory → AI Agents →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
