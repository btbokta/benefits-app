import { STORY_BEATS, PERSONA_EMAILS } from '@/lib/story/config';
import Link from 'next/link';

export default function StoryPage() {
  return (
    <div className="max-w-3xl mx-auto p-8 pb-24">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm">BA</div>
          <h1 className="text-2xl font-bold text-white">Demo Guide</h1>
        </div>
        <p className="text-gray-400 text-sm">
          A guided walkthrough of the Okta for AI story — from employee login to live denial to audit trail.
        </p>
      </header>

      {/* Personas quick ref */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personas needed for this demo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(PERSONA_EMAILS).map(([role, email]) => (
            <div key={role} className="flex items-center gap-2 text-xs">
              <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-bold capitalize">{role}</span>
              <span className="font-mono text-gray-400">{email}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Password: the <span className="font-mono">SEED_USER_PASSWORD</span> from your .env</p>
      </div>

      {/* Story beats table of contents */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Story Beats</h2>
        <div className="space-y-2">
          {STORY_BEATS.map(beat => (
            <a
              key={beat.step}
              href={`/?story=${beat.step}`}
              className="flex items-start gap-3 bg-gray-900 border border-gray-800 hover:border-gray-600 rounded p-3 transition-colors group"
            >
              <span className="text-xs font-bold bg-blue-900 text-blue-300 px-2 py-0.5 rounded shrink-0 mt-0.5">
                {beat.step}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors">{beat.title}</div>
                <div className="text-gray-500 text-xs mt-0.5 line-clamp-2 leading-relaxed">{beat.narration}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {beat.requiresPersona && (
                  <span className="text-xs bg-amber-900 text-amber-300 px-1.5 py-0.5 rounded">{beat.requiresPersona}</span>
                )}
                {beat.action === 'query' && (
                  <span className="text-xs bg-green-900 text-green-300 px-1.5 py-0.5 rounded">auto</span>
                )}
                {beat.action === 'manual' && (
                  <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">manual</span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Start button */}
      <div className="flex gap-3 items-center">
        <a
          href="/?story=1"
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded text-sm font-semibold transition-colors"
        >
          ▶ Begin Demo from Step 1
        </a>
        <Link href="/" className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-3 rounded text-sm transition-colors">
          Back to home
        </Link>
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Tip: Each step is URL-addressable — share <span className="font-mono">/?story=7</span> to jump directly to the live denial beat.
      </p>
    </div>
  );
}
