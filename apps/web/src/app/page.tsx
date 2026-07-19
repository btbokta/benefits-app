import { getSessionUser } from '@/lib/session';
import { ROLE_SCOPES } from '@benefits-agent/shared';
import Link from 'next/link';

const PERSONAS = [
  { name: 'Sarah Johnson', email: 'sarah.johnson@acmecorp.example', role: 'hr_admin', groups: ['HR-Admins', 'Employees'], note: 'Full access incl. salary, notes, audit' },
  { name: 'James Wilson', email: 'james.wilson@acmecorp.example', role: 'benefits_specialist', groups: ['Benefits-Team', 'Employees'], note: 'Enrollment admin, no salary' },
  { name: 'Michael Chen', email: 'michael.chen@acmecorp.example', role: 'manager', groups: ['Managers', 'Employees'], note: 'Self + direct reports (Emily, Lisa, Marcus)' },
  { name: 'Emily Davis', email: 'emily.davis@acmecorp.example', role: 'employee', groups: ['Employees'], note: 'Self only' },
  { name: 'Lisa Park', email: 'lisa.park@acmecorp.example', role: 'employee', groups: ['Employees'], note: 'Self only' },
];

export default async function HomePage() {
  const user = await getSessionUser();

  return (
    <main className="max-w-4xl mx-auto p-8">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm">BA</div>
          <h1 className="text-2xl font-bold text-white">Benefits Portal</h1>
          <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">secured by Okta for AI</span>
        </div>
        <p className="text-gray-400 text-sm">HR Benefits AI Agent — every data access authorized by a real Okta-issued token</p>
      </header>

      {user ? (
        <section className="mb-8">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-white font-semibold text-lg">{user.name}</div>
                <div className="text-gray-400 text-sm">{user.email}</div>
                <div className="mt-1 flex gap-2 flex-wrap">
                  {user.groups.map((g) => (
                    <span key={g} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{g}</span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400 mb-1">Role</div>
                <div className="text-sm font-bold text-blue-400">{user.role}</div>
                <div className="text-xs text-gray-500 mt-1">Mode: {process.env.OKTA_AI_MODE ?? 'obo'}</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-2">Scope ceiling</div>
              <div className="flex flex-wrap gap-1">
                {ROLE_SCOPES[user.role].map((s) => (
                  <span key={s} className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded font-mono">{s}</span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Link href="/chat" className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm transition-colors">Chat with Agent</Link>
              <Link href="/inspector" className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm transition-colors">Token Inspector</Link>
              <Link href="/audit" className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm transition-colors">Audit Log</Link>
              <LogoutButton />
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-8">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 text-center">
            <p className="text-gray-400 mb-4">Sign in with your Okta credentials to access the Benefits Portal</p>
            <a href="/auth/login" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded text-sm transition-colors inline-block">Sign in with Okta</a>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Demo Personas</h2>
        <div className="grid gap-3">
          {PERSONAS.map((p) => (
            <div key={p.email} className="bg-gray-900 border border-gray-800 rounded p-4 flex items-start justify-between">
              <div>
                <div className="text-white text-sm font-medium">{p.name}</div>
                <div className="text-gray-500 text-xs font-mono">{p.email}</div>
                <div className="text-gray-400 text-xs mt-1">{p.note}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-blue-400 mb-1">{p.role}</div>
                <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                  {ROLE_SCOPES[p.role as keyof typeof ROLE_SCOPES].map((s) => (
                    <span key={s} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono text-[10px]">{s.replace('benefits.', '')}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function LogoutButton() {
  return (
    <form action="/auth/logout-client" method="get">
      <button type="submit" className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded text-sm transition-colors">
        Sign out
      </button>
    </form>
  );
}
