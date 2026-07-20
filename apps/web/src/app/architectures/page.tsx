'use client';

import { useState } from 'react';

// ── Flow definitions ──────────────────────────────────────────────────────────

const FLOWS = [
  {
    id: 'cross-app',
    label: 'Cross-App Access',
    icon: 'account_tree',
    accent: '#3b82f6',
    accentBg: 'rgba(59,130,246,0.08)',
    tagline: 'Combined user & agent attribution via ID-JAG',
    summary: 'Replaces insecure Personal Access Tokens. The agent acts on behalf of the user with full attribution — every token carries both identities. Okta evaluates FGA policies before issuing the ID-JAG.',
    highlight: 'This is what this demo uses (Mode A)',
    steps: [
      { id: 1, actor: 'User',          label: 'Authenticates',       detail: 'Login to web app → receives ID token, access token, refresh token', color: '#60a5fa' },
      { id: 2, actor: 'Web App',       label: 'Passes ID token',     detail: 'User issues a prompt; web app forwards user\'s ID token to the agent', color: '#60a5fa' },
      { id: 3, actor: 'Agent',         label: 'Presents credentials', detail: 'Sends user\'s ID token + signed JWT (agent\'s private key) to Okta', color: '#a78bfa' },
      { id: 4, actor: 'Okta',          label: 'Policy evaluation',   detail: 'Checks if agent is allowed, evaluates FGA (leave of absence, permission ceiling, etc.)', color: '#c3c6d2' },
      { id: 5, actor: 'Okta',          label: 'Issues ID-JAG',       detail: 'Short-lived, single-use token with full act chain: agent acting on behalf of user. No refresh token.', color: '#c3c6d2' },
      { id: 6, actor: 'Agent',         label: 'Exchanges for token', detail: 'ID-JAG → purpose-minted access token at custom AS', color: '#a78bfa' },
      { id: 7, actor: 'MCP Server',    label: 'Serves request',      detail: 'Validates bearer token, enforces scopes, returns data', color: '#34d399' },
    ],
    callouts: [
      { icon: 'security', text: 'Full delegation chain — agent AND user identity in every token' },
      { icon: 'block', text: 'No refresh tokens — prevents long-lived agent credentials' },
      { icon: 'policy', text: 'FGA policies evaluated at exchange time (leave of absence, permission ceiling)' },
    ],
  },
  {
    id: 'brokered-consent',
    label: 'Brokered Consent',
    icon: 'handshake',
    accent: '#8b5cf6',
    accentBg: 'rgba(139,92,246,0.08)',
    tagline: 'STS flow for third-party SaaS with native auth servers',
    summary: 'Required for SaaS apps like GitHub, Jira, Slack, or Salesforce that have their own native authorization servers and cannot accept Okta tokens directly. Okta brokers consent and stores the resulting token.',
    highlight: 'Used when the target resource has its own OAuth server',
    steps: [
      { id: 1, actor: 'Agent',          label: 'Requests access',       detail: 'Agent needs to call a third-party resource (GitHub, Jira, Slack)', color: '#a78bfa' },
      { id: 2, actor: 'Okta STS',       label: 'Checks Token Vault',    detail: 'Looks for an existing, valid user-consented token for this resource', color: '#c3c6d2' },
      { id: 3, actor: 'Okta STS',       label: 'interaction_required',  detail: 'No token found → returns interaction_required + interaction_uri', color: '#c3c6d2' },
      { id: 4, actor: 'User',           label: 'Consent ceremony',      detail: 'Browser redirected to third-party AS (e.g. GitHub OAuth) — standard consent screen', color: '#60a5fa' },
      { id: 5, actor: 'GitHub/Jira AS', label: 'Issues auth code',      detail: 'Third-party issues its own access code after user consents', color: '#fbbf24' },
      { id: 6, actor: 'Okta',           label: 'Stores in Token Vault', detail: 'Exchanges code for token, stores it securely — future requests skip steps 3–5', color: '#c3c6d2' },
      { id: 7, actor: 'MCP Server',     label: 'Executes API call',     detail: 'Okta provides the vaulted token; agent never sees downstream credentials', color: '#34d399' },
    ],
    callouts: [
      { icon: 'lock', text: 'Token Vault — Okta stores consented tokens; agent never touches downstream credentials' },
      { icon: 'repeat', text: 'First-time consent only — subsequent requests use the vaulted token' },
      { icon: 'hub', text: 'Works with any SaaS that has a standard OAuth 2.0 authorization server' },
    ],
  },
  {
    id: 'mcp-wrapper',
    label: 'API / MCP Wrapper',
    icon: 'api',
    accent: '#22d3ee',
    accentBg: 'rgba(34,211,238,0.08)',
    tagline: 'Custom MCP server wrapping internal APIs',
    summary: 'For internal applications (custom help desks, legacy systems) that lack native cross-app support. Developers build an MCP wrapper that describes the API\'s tools to the LLM — no browser automation or screen scraping.',
    highlight: 'Prevents agents from mimicking user clicks in browsers',
    steps: [
      { id: 1, actor: 'Developer',      label: 'Builds MCP wrapper',    detail: 'Defines schemas, tool descriptions, inputs/outputs for each API endpoint', color: '#67e8f9' },
      { id: 2, actor: 'Admin',          label: 'Creates custom AS',     detail: 'Dedicated Okta custom authorization server specifically gates this MCP server', color: '#c3c6d2' },
      { id: 3, actor: 'Admin',          label: 'Sets access policies',  detail: 'Defines which agents + user groups can call which tools and scopes', color: '#c3c6d2' },
      { id: 4, actor: 'Agent',          label: 'Authenticates',         detail: 'Calls custom AS to get a purpose-minted access token', color: '#a78bfa' },
      { id: 5, actor: 'MCP Wrapper',    label: 'Validates token',       detail: 'Enforces scopes, checks policies, may retrieve API key from Okta PAM', color: '#34d399' },
      { id: 6, actor: 'Okta PAM',       label: 'Provides API key',      detail: 'If the legacy backend requires an API key, PAM vends it to the wrapper — not the agent', color: '#fbbf24' },
      { id: 7, actor: 'Internal API',   label: 'Returns data',          detail: 'The legacy app responds to the MCP wrapper, which formats the response for the LLM', color: '#67e8f9' },
    ],
    callouts: [
      { icon: 'description', text: 'Schemas describe the API to the LLM — no need for the agent to understand the underlying system' },
      { icon: 'key', text: 'Legacy API keys retrieved from Okta PAM — never exposed to the agent' },
      { icon: 'code_off', text: 'Eliminates browser automation anti-pattern (no Playwright/Puppeteer for agent access)' },
    ],
  },
  {
    id: 'headless',
    label: 'Headless / M2M',
    icon: 'smart_toy',
    accent: '#10b981',
    accentBg: 'rgba(16,185,129,0.08)',
    tagline: 'Autonomous agents, CI/CD pipelines, machine-to-machine',
    summary: 'For workloads that run without human intervention — CI/CD pipelines, scheduled jobs, autonomous generalized agents. The service app authenticates directly with the target resource using its own registered private key.',
    highlight: 'No user in the loop — full machine identity with audit lineage',
    steps: [
      { id: 1, actor: 'Admin',         label: 'Registers app',        detail: 'Registers the service in the target system (e.g. GitHub App) with strictly scoped permissions + private key', color: '#c3c6d2' },
      { id: 2, actor: 'Service App',   label: 'Mints JWT',            detail: 'Constructs a client credential JWT signed with the registered private key', color: '#34d399' },
      { id: 3, actor: 'Target Resource', label: 'Exchanges for token', detail: 'Service presents JWT; target issues a machine-to-machine access token with only the provisioned scopes', color: '#fbbf24' },
      { id: 4, actor: 'Service App',   label: 'Calls API',            detail: 'Executes the task — read repo, run pipeline, query database, etc.', color: '#34d399' },
      { id: 5, actor: 'Okta Audit',    label: 'Captures lineage',     detail: 'Full delegation chain logged: which service called which agent, what was executed, when', color: '#c3c6d2' },
      { id: 6, actor: 'AI Model',      label: 'Trains on logs',       detail: 'Machine-readable audit logs fed back to evaluate task success and improve agent behavior', color: '#a78bfa' },
    ],
    callouts: [
      { icon: 'manage_accounts', text: 'Strictly scoped — provisioned once, no over-permissioning' },
      { icon: 'receipt_long', text: 'Full audit lineage — which service → which agent → which action, machine-readable' },
      { icon: 'model_training', text: 'Audit logs can feed back into model training and task evaluation' },
    ],
  },
  {
    id: 'mcp-gateway',
    label: 'MCP Gateway',
    icon: 'hub',
    accent: '#fbbf24',
    accentBg: 'rgba(251,191,36,0.08)',
    tagline: 'Credential isolation for local desktop agents',
    summary: 'Routes all tool calls from local desktop agents (Claude Code, Cursor, Droid) through a central gateway. The agent only receives a "promise token" — it never sees the actual downstream credentials. The gateway also acts as a policy engine filtering which tools the LLM can see.',
    highlight: 'The agent never touches real credentials — only a promise token',
    steps: [
      { id: 1, actor: 'Desktop Agent',  label: 'Authenticates',        detail: 'Claude Code / Cursor / Droid authenticates against the MCP Adapter', color: '#fcd34d' },
      { id: 2, actor: 'MCP Gateway',    label: 'Validates identity',   detail: 'Proxies back to Okta to validate user AND agent identity — both must be authorized', color: '#c3c6d2' },
      { id: 3, actor: 'MCP Gateway',    label: 'Issues promise token', detail: 'Returns a "promise token" to the local agent — a credential scoped only to the gateway, not the downstream resource', color: '#c3c6d2' },
      { id: 4, actor: 'MCP Gateway',    label: 'Filters tools',        detail: 'Like a WAF — exposes only the tools the user\'s role allows (e.g. 15 tools for manager, 10 for engineer)', color: '#c3c6d2' },
      { id: 5, actor: 'Desktop Agent',  label: 'Calls tool',           detail: 'Agent calls a tool using the promise token — only talks to the gateway', color: '#fcd34d' },
      { id: 6, actor: 'MCP Gateway',    label: 'Executes downstream',  detail: 'Gateway holds the real credential, executes the actual API call — credential never leaves gateway', color: '#c3c6d2' },
      { id: 7, actor: 'Downstream API', label: 'Returns result',       detail: 'Resource responds; gateway proxies result back to the local agent', color: '#34d399' },
    ],
    callouts: [
      { icon: 'visibility_off', text: 'Credential isolation — local agent only ever sees a promise token' },
      { icon: 'filter_alt', text: 'Tool filtering — role-based tool exposure, like a WAF for AI agents' },
      { icon: 'deployed_code_account', text: 'Hosted by Okta (MCP Gateway) or on-premises (MCP Adapter)' },
    ],
  },
];

// ── Step node component ───────────────────────────────────────────────────────
function StepNode({ step, accent, isLast }: {
  step: typeof FLOWS[0]['steps'][0];
  accent: string;
  isLast: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* Step line + number */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 32 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `${step.color}20`,
          border: `2px solid ${step.color}60`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
          color: step.color, flexShrink: 0,
        }}>{step.id}</div>
        {!isLast && (
          <div style={{ width: 1, flex: 1, minHeight: 20, background: 'var(--outline-variant)', marginTop: 2, marginBottom: 2 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ paddingBottom: isLast ? 0 : 20, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
            padding: '1px 7px', borderRadius: 2,
            background: `${step.color}15`, border: `1px solid ${step.color}35`,
            color: step.color,
          }}>{step.actor}</span>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--on-surface)' }}>
            {step.label}
          </span>
        </div>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.55, margin: 0 }}>
          {step.detail}
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ArchitecturesPage() {
  const [active, setActive] = useState(0);
  const flow = FLOWS[active];

  return (
    <div style={{ padding: '40px 0 120px' }}>

      {/* Header */}
      <div style={{ padding: '0 40px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
            padding: '2px 10px', borderRadius: 2,
            background: 'rgba(195,198,210,0.1)', border: '1px solid rgba(195,198,210,0.2)',
            color: 'var(--primary)', letterSpacing: '0.06em',
          }}>REFERENCE ARCHITECTURES</span>
        </div>
        <h1 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', color: 'var(--on-surface)', marginBottom: 8 }}>
          Okta for AI Integration Patterns
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'var(--on-surface-variant)', lineHeight: 1.65, maxWidth: 600 }}>
          The five architectures for connecting AI agents to resources through Okta —
          from user-delegated access to fully autonomous machine-to-machine flows.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, overflowX: 'auto',
        borderBottom: '1px solid var(--outline-variant)',
        marginBottom: 0, padding: '0 40px',
      }}>
        {FLOWS.map((f, i) => (
          <button key={f.id} onClick={() => setActive(i)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 20px',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: active === i ? `2px solid ${f.accent}` : '2px solid transparent',
            marginBottom: -1,
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 16, flexShrink: 0,
              color: active === i ? f.accent : 'var(--on-surface-variant)',
            }}>{f.icon}</span>
            <span style={{
              fontFamily: 'DM Sans, sans-serif', fontWeight: active === i ? 600 : 400, fontSize: 13,
              color: active === i ? f.accent : 'var(--on-surface-variant)',
            }}>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Flow content */}
      <div style={{ padding: '32px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32, alignItems: 'start' }}>

          {/* Left: steps */}
          <div>
            {/* Flow header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '0.25rem',
                  background: flow.accentBg, border: `1px solid ${flow.accent}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined fill-1" style={{ fontSize: 20, color: flow.accent }}>{flow.icon}</span>
                </div>
                <div>
                  <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--on-surface)', letterSpacing: '-0.01em' }}>
                    {flow.label}
                  </h2>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: flow.accent, marginTop: 1 }}>
                    {flow.tagline}
                  </div>
                </div>
              </div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--on-surface-variant)', lineHeight: 1.65, maxWidth: 560 }}>
                {flow.summary}
              </p>
              {flow.highlight && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginTop: 10, padding: '5px 12px', borderRadius: 2,
                  background: flow.accentBg, border: `1px solid ${flow.accent}35`,
                }}>
                  <span className="material-symbols-outlined fill-1" style={{ fontSize: 14, color: flow.accent }}>info</span>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: flow.accent, fontWeight: 500 }}>
                    {flow.highlight}
                  </span>
                </div>
              )}
            </div>

            {/* Step-by-step flow */}
            <div style={{ background: 'var(--surface-low)', border: '1px solid var(--outline-variant)', borderRadius: '0.5rem', padding: '24px 24px 20px' }}>
              <div className="label-caps" style={{ color: 'var(--outline)', marginBottom: 20 }}>Flow sequence</div>
              {flow.steps.map((step, i) => (
                <StepNode key={step.id} step={step} accent={flow.accent} isLast={i === flow.steps.length - 1} />
              ))}
            </div>
          </div>

          {/* Right: visual diagram + callouts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Visual pipeline */}
            <div style={{ background: 'var(--surface-low)', border: '1px solid var(--outline-variant)', borderRadius: '0.5rem', padding: 20 }}>
              <div className="label-caps" style={{ color: 'var(--outline)', marginBottom: 16 }}>System actors</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Unique actors */}
                {Array.from(new Set(flow.steps.map(s => s.actor))).map((actor, i, arr) => {
                  const step = flow.steps.find(s => s.actor === actor)!;
                  const isLast = i === arr.length - 1;
                  return (
                    <div key={actor} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: '0.25rem',
                        background: `${step.color}0e`, border: `1px solid ${step.color}30`,
                        width: '100%',
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: step.color, flexShrink: 0,
                        }} />
                        <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--on-surface)' }}>
                          {actor}
                        </span>
                      </div>
                      {!isLast && (
                        <div style={{ width: 1, height: 12, background: 'var(--outline-variant)', marginLeft: 18 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key properties */}
            <div style={{ background: 'var(--surface-low)', border: '1px solid var(--outline-variant)', borderRadius: '0.5rem', padding: 20 }}>
              <div className="label-caps" style={{ color: 'var(--outline)', marginBottom: 14 }}>Key properties</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {flow.callouts.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span className="material-symbols-outlined fill-1" style={{ fontSize: 18, color: flow.accent, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.55 }}>
                      {c.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Compare to other flows */}
            <div style={{ background: 'var(--surface-low)', border: '1px solid var(--outline-variant)', borderRadius: '0.5rem', padding: 20 }}>
              <div className="label-caps" style={{ color: 'var(--outline)', marginBottom: 14 }}>Other flows</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {FLOWS.filter((_, i) => i !== active).map((f, i) => (
                  <button key={f.id} onClick={() => setActive(FLOWS.indexOf(f))} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: '0.25rem',
                    background: 'none', border: '1px solid var(--outline-variant)',
                    cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: f.accent, flexShrink: 0 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)' }}>{f.label}</div>
                      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'var(--outline)' }}>{f.tagline}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
