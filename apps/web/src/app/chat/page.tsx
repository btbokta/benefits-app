'use client';

import { useState, useRef, useEffect } from 'react';
import type { ToolEvent } from '@/lib/agent/tools';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolEvents?: ToolEvent[];
  error?: string;
}

const SUGGESTED_QUERIES = [
  'How much PTO do I have?',
  'What benefits am I enrolled in?',
  'What is Michael Chen\'s salary?',
  'Show me the audit log',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastMeta, setLastMeta] = useState<{ scope: string; expiresAt: number; mode: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json() as {
        reply?: string;
        toolEvents?: ToolEvent[];
        tokenMeta?: { scope: string; expiresAt: number; mode: string };
        error?: string;
        oktaError?: string;
        oktaDescription?: string;
        stage?: string;
      };

      if (!res.ok) {
        const errMsg = data.oktaError
          ? `Okta error at ${data.stage}: ${data.oktaError} — ${data.oktaDescription}`
          : (data.error ?? 'Request failed');
        setMessages(m => [...m, { role: 'assistant', content: '', error: errMsg }]);
      } else {
        if (data.tokenMeta) setLastMeta(data.tokenMeta);
        setMessages(m => [...m, { role: 'assistant', content: data.reply ?? '', toolEvents: data.toolEvents }]);
      }
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: '', error: String(err) }]);
    } finally {
      setLoading(false);
    }
  }

  const allEvents = messages.flatMap(m => m.toolEvents ?? []);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)' }}>

      {/* ── Chat column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 700, margin: '0 auto', padding: '0 16px', minWidth: 0 }}>

        {/* Token meta strip */}
        {lastMeta && (
          <div style={{
            display: 'flex', gap: 16, padding: '10px 14px',
            background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
            fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap',
          }}>
            <span>mode:<span style={{ color: 'var(--cyan)', marginLeft: 4 }}>{lastMeta.mode}</span></span>
            <span>scopes:<span style={{ color: 'var(--green)', marginLeft: 4, fontFamily: 'DM Mono, monospace', fontSize: 10 }}>{lastMeta.scope}</span></span>
            <span>exp:<span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>{new Date(lastMeta.expiresAt * 1000).toLocaleTimeString()}</span></span>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', margin: '0 auto 16px',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(34,211,238,0.3))',
                border: '1px solid rgba(59,130,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>◈</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                Ask the Benefits Agent anything.<br />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Every tool call is authorized by Okta.</span>
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {SUGGESTED_QUERIES.map(q => (
                  <button key={q} onClick={() => send(q)}
                    style={{
                      padding: '7px 14px', borderRadius: 20,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                      fontFamily: 'DM Mono, monospace', transition: 'border-color 0.15s',
                    }}
                  >{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 10, marginTop: 2,
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.4), rgba(34,211,238,0.4))',
                  border: '1px solid rgba(59,130,246,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                }}>◈</div>
              )}
              <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role === 'user'
                  ? 'rgba(59,130,246,0.18)'
                  : m.error ? 'rgba(248,113,113,0.1)' : 'var(--bg-surface)',
                border: m.role === 'user'
                  ? '1px solid rgba(59,130,246,0.3)'
                  : m.error ? '1px solid rgba(248,113,113,0.25)' : '1px solid var(--border-subtle)',
                fontSize: 13, lineHeight: 1.65,
                color: m.error ? 'var(--red)' : 'var(--text-primary)',
              }}>
                {m.error ? (
                  <><span style={{ opacity: 0.7, fontSize: 11 }}>⚠ </span>{m.error}</>
                ) : (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{m.content}</pre>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.4), rgba(34,211,238,0.4))',
                border: '1px solid rgba(59,130,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
              }}>◈</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--blue)',
                    animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 0 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', gap: 10,
        }}>
          <input
            className="input-field"
            style={{ flex: 1 }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about benefits, PTO, salary…"
            disabled={loading}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="btn-primary"
            style={{ padding: '10px 20px' }}
          >Send</button>
        </div>
      </div>

      {/* ── Auth trace sidebar ── */}
      <div style={{
        width: 280, flexShrink: 0,
        borderLeft: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }} className="hidden-mobile">
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Auth Trace
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{allEvents.length} events</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {allEvents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', paddingTop: 24 }}>
              Tool calls appear here
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allEvents.map((ev, i) => (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: ev.allowed ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)',
                  border: `1px solid ${ev.allowed ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {ev.tool}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 4,
                      ...(ev.allowed
                        ? { background: 'rgba(52,211,153,0.15)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.25)' }
                        : { background: 'rgba(248,113,113,0.15)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.25)' }
                      ),
                    }}>
                      {ev.allowed ? 'ALLOW' : 'DENY'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    scope: <span style={{ color: 'var(--text-secondary)' }}>{ev.scopeRequired.replace('benefits.', '')}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>HTTP {ev.httpStatus}</div>
                  {!ev.allowed && Boolean((ev.output as Record<string, unknown>)?.missingScopes) && (
                    <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>
                      missing: {((ev.output as Record<string, unknown>).missingScopes as string[])
                        .map(s => s.replace('benefits.', '')).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
