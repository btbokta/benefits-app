'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ChainStage {
  stage: string;
  tokenPreview: string;
  decoded?: { header: Record<string, unknown>; payload: Record<string, unknown> };
  expiresAt?: number;
}

interface BrokerState {
  scope: string;
  expiresAt: number;
  chain: ChainStage[];
  mode: string;
  error?: string;
}

function ttl(exp: number): string {
  const s = exp - Math.floor(Date.now() / 1000);
  if (s <= 0) return 'expired';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function highlight(key: string): string {
  const important = ['sub', 'scp', 'scope', 'cid', 'act', 'groups', 'jti', 'typ', 'aud'];
  return important.includes(key) ? 'text-yellow-300' : 'text-gray-300';
}

export default function InspectorPage() {
  const [state, setState] = useState<BrokerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  async function load(refresh = false) {
    setLoading(true);
    try {
      const res = await fetch(`/api/broker${refresh ? '?refresh=1' : ''}`);
      const data = await res.json() as BrokerState & { error?: string };
      setState(data);
    } catch (err) {
      setState({ scope: '', expiresAt: 0, chain: [], mode: '', error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function revoke() {
    setRevoking(true);
    await fetch('/api/broker', { method: 'DELETE' });
    setRevoking(false);
    await load(true);
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-blue-950 border border-blue-700 rounded p-3 mb-5 flex items-center justify-between gap-3">
        <span className="text-blue-300 text-sm">The visual Token Flow Visualizer is available — see each hop annotated with endpoints, grant types, and tooltips.</span>
        <Link href="/flow" className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap shrink-0">
          Open Flow Visualizer →
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-bold text-xl">Token Inspector</h1>
          <p className="text-gray-400 text-sm mt-1">Live broker chain — every hop decoded</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)} disabled={loading} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm transition-colors">
            {loading ? 'Loading…' : 'Refresh exchange'}
          </button>
          <button onClick={revoke} disabled={revoking || loading} className="bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm transition-colors">
            {revoking ? 'Revoking…' : 'Revoke agent token'}
          </button>
          <Link href="/" className="bg-gray-800 text-gray-400 hover:text-white px-3 py-1.5 rounded text-sm transition-colors">Home</Link>
        </div>
      </div>

      {state?.error && (
        <div className="bg-red-950 border border-red-700 rounded p-4 mb-4 text-red-300 text-sm">{state.error}</div>
      )}

      {state && !state.error && (
        <>
          <div className="bg-gray-900 border border-gray-700 rounded p-4 mb-6">
            <div className="flex gap-6 text-sm">
              <div><span className="text-gray-400">Mode: </span><span className="text-blue-400 font-bold">{state.mode}</span></div>
              <div><span className="text-gray-400">Scopes: </span><span className="text-green-400 font-mono text-xs">{state.scope}</span></div>
              <div><span className="text-gray-400">TTL: </span><span className="text-yellow-400">{ttl(state.expiresAt)}</span></div>
            </div>
          </div>

          <div className="space-y-4">
            {state.chain.map((stage, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded font-bold">{i + 1}</span>
                    <span className="text-white font-medium">{stage.stage}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="font-mono">{stage.tokenPreview}</span>
                    {stage.expiresAt && <span className="text-yellow-400">{ttl(stage.expiresAt)}</span>}
                  </div>
                </div>
                {stage.decoded && (
                  <div className="grid grid-cols-2 divide-x divide-gray-700">
                    <div className="p-3">
                      <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Header</div>
                      <pre className="text-xs overflow-x-auto">
                        {Object.entries(stage.decoded.header).map(([k, v]) => (
                          <div key={k}><span className="text-gray-500">"{k}": </span><span className={highlight(k)}>{JSON.stringify(v)}</span></div>
                        ))}
                      </pre>
                    </div>
                    <div className="p-3">
                      <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Payload</div>
                      <pre className="text-xs overflow-x-auto">
                        {Object.entries(stage.decoded.payload).map(([k, v]) => (
                          <div key={k}><span className="text-gray-500">"{k}": </span><span className={highlight(k)}>{JSON.stringify(v)}</span></div>
                        ))}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
