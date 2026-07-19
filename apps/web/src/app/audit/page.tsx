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

  useEffect(() => {
    fetch('/api/audit-proxy')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setRows(d);
        else setError(d.error ?? JSON.stringify(d));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-bold text-xl">Audit Log</h1>
          <p className="text-gray-400 text-sm mt-1">Every agent authorization decision, tracked by Okta token JTI</p>
        </div>
        <div className="flex gap-3 items-center">
          {ORG && (
            <a href={`${ORG}/admin/reports/systemlog`} target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-400 hover:text-blue-300 underline">
              Okta System Log →
            </a>
          )}
          <Link href="/" className="bg-gray-800 text-gray-400 hover:text-white px-3 py-1.5 rounded text-sm">Home</Link>
        </div>
      </div>

      {loading && <div className="text-gray-400 text-sm text-center py-16 animate-pulse">Loading…</div>}

      {error && (
        <div className="bg-red-950 border border-red-700 rounded p-4 text-red-300 text-sm">
          {error.includes('insufficient_scope') || error.includes('forbidden')
            ? 'Okta denied access — you need benefits.audit.read scope (hr_admin only)'
            : error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-gray-500 text-sm text-center py-16">No audit records yet — make some agent queries first.</div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Time</th>
                <th className="text-left py-2 pr-4">Tool</th>
                <th className="text-left py-2 pr-4">User</th>
                <th className="text-left py-2 pr-4">Scope Required</th>
                <th className="text-left py-2 pr-4">Decision</th>
                <th className="text-left py-2 pr-4">HTTP</th>
                <th className="text-left py-2 pr-4">JTI</th>
                <th className="text-left py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-gray-800 hover:bg-gray-900 ${r.decision === 'deny' ? 'bg-red-950/20' : ''}`}>
                  <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{new Date(r.ts).toLocaleTimeString()}</td>
                  <td className="py-2 pr-4 font-mono text-white">{r.tool}</td>
                  <td className="py-2 pr-4 text-gray-400 truncate max-w-32">{r.userSub}</td>
                  <td className="py-2 pr-4 font-mono text-gray-300">{r.scopeRequired.replace('benefits.', '')}</td>
                  <td className="py-2 pr-4">
                    <span className={`font-bold ${r.decision === 'allow' ? 'text-green-400' : 'text-red-400'}`}>
                      {r.decision.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{r.httpStatus}</td>
                  <td className="py-2 pr-4 font-mono text-gray-500 truncate max-w-24" title={r.tokenJti}>
                    {r.tokenJti ? r.tokenJti.slice(0, 8) + '…' : '—'}
                  </td>
                  <td className="py-2 text-gray-400 truncate max-w-40">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && ORG && (
        <div className="mt-4 bg-gray-900 border border-gray-700 rounded p-3 text-xs text-gray-400">
          System Log filter:
          <code className="ml-2 bg-gray-800 px-2 py-0.5 rounded text-gray-300 select-all">
            app.oauth2.token.grant.id_jag OR workload_principal.*
          </code>
          <a href={`${ORG}/admin/reports/systemlog`} target="_blank" rel="noopener noreferrer"
             className="ml-2 text-blue-400 hover:underline">Open in Okta →</a>
        </div>
      )}
    </div>
  );
}
