'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ToolEvent } from '@/lib/agent/tools';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolEvents?: ToolEvent[];
  error?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastTokenMeta, setLastTokenMeta] = useState<{ scope: string; expiresAt: number; mode: string } | null>(null);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
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
          : data.error ?? 'Request failed';
        setMessages((m) => [...m, { role: 'assistant', content: '', error: errMsg }]);
      } else {
        if (data.tokenMeta) setLastTokenMeta(data.tokenMeta);
        setMessages((m) => [...m, { role: 'assistant', content: data.reply ?? '', toolEvents: data.toolEvents }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: '', error: String(err) }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen">
      {/* Chat panel */}
      <div className="flex flex-col flex-1 max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-white font-semibold">Benefits Agent</h1>
          <div className="flex gap-2">
            <Link href="/inspector" className="text-xs text-blue-400 hover:text-blue-300">Token Inspector</Link>
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-300">Home</Link>
          </div>
        </div>

        {lastTokenMeta && (
          <div className="mb-3 bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-400">
            Mode: <span className="text-blue-400">{lastTokenMeta.mode}</span>
            {' · '}Scopes: <span className="text-green-400 font-mono">{lastTokenMeta.scope}</span>
            {' · '}Exp: <span>{new Date(lastTokenMeta.expiresAt * 1000).toLocaleTimeString()}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 && (
            <div className="text-gray-500 text-sm text-center pt-16">
              Ask about benefits, PTO, enrollments, or employee information.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-md rounded-lg px-4 py-2 text-sm ${m.role === 'user' ? 'bg-blue-700 text-white' : m.error ? 'bg-red-900 text-red-200 border border-red-700' : 'bg-gray-800 text-gray-100'}`}>
                {m.error ? (
                  <div><span className="font-bold">Error: </span>{m.error}</div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-lg px-4 py-2 text-sm text-gray-400 animate-pulse">thinking…</div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about benefits, PTO, salary…"
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Authorization trace panel */}
      <div className="w-72 border-l border-gray-800 p-4 overflow-y-auto hidden lg:block">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Authorization Trace</h2>
        {messages.filter((m) => m.toolEvents && m.toolEvents.length > 0).map((m, mi) => (
          <div key={mi} className="mb-4">
            <div className="text-xs text-gray-500 mb-2">Turn {mi + 1}</div>
            {m.toolEvents!.map((ev, ei) => (
              <div key={ei} className={`mb-2 p-2 rounded text-xs border ${ev.allowed ? 'bg-green-950 border-green-800' : 'bg-red-950 border-red-800'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-white">{ev.tool}</span>
                  <span className={`font-bold ${ev.allowed ? 'text-green-400' : 'text-red-400'}`}>{ev.allowed ? 'ALLOW' : 'DENY'}</span>
                </div>
                <div className="text-gray-400">scope: <span className="font-mono text-gray-300">{ev.scopeRequired}</span></div>
                <div className="text-gray-400">HTTP {ev.httpStatus}</div>
                {!ev.allowed && (ev.output as Record<string, unknown>)?.missingScopes && (
                  <div className="text-red-300 mt-1">missing: {((ev.output as Record<string, unknown>).missingScopes as string[]).join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        ))}
        {messages.every((m) => !m.toolEvents?.length) && (
          <div className="text-gray-600 text-xs text-center pt-8">Tool calls appear here</div>
        )}
      </div>
    </div>
  );
}
