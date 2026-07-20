'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { STORY_BEATS, PERSONA_EMAILS } from '@/lib/story/config';

export function StoryBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [active, setActive] = useState(false);
  const [step, setStep] = useState(1);
  const [minimized, setMinimized] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [personaOk, setPersonaOk] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  const beat = STORY_BEATS.find(b => b.step === step) ?? STORY_BEATS[0];

  // ── Init from localStorage + URL param ──────────────────────────────────────
  useEffect(() => {
    const storyParam = searchParams.get('story');
    if (storyParam) {
      const n = Number(storyParam);
      if (n >= 1 && n <= STORY_BEATS.length) {
        setStep(n);
        setActive(true);
        localStorage.setItem('storyActive', 'true');
        localStorage.setItem('storyStep', String(n));
        return;
      }
    }
    const stored = localStorage.getItem('storyActive');
    if (stored === 'true') {
      setActive(true);
      setStep(Number(localStorage.getItem('storyStep')) || 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync step → URL + localStorage ─────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('story', String(step));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    localStorage.setItem('storyStep', String(step));
    setRunResult(null);
    setPersonaOk(false);
  }, [step, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persona check ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !beat.requiresPersona) {
      setPersonaOk(true);
      return;
    }
    setPersonaOk(false);
    fetch('/api/me')
      .then(r => r.json())
      .then((d: { email?: string; authenticated?: boolean }) => {
        setCurrentEmail(d.email ?? null);
        setPersonaOk(d.email === PERSONA_EMAILS[beat.requiresPersona!]);
      })
      .catch(() => setPersonaOk(false));
  }, [step, active, beat.requiresPersona]);

  // ── Highlight element ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!beat.highlightElement) return;
    const el = document.querySelector(beat.highlightElement);
    if (!el) return;
    el.classList.add('ring-2', 'ring-blue-400', 'animate-pulse');
    return () => el.classList.remove('ring-2', 'ring-blue-400', 'animate-pulse');
  }, [step, pathname, beat.highlightElement]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    const next = Math.min(step + 1, STORY_BEATS.length);
    setStep(next);
    const nextBeat = STORY_BEATS.find(b => b.step === next);
    if (nextBeat?.action === 'navigate' && nextBeat.actionTarget) {
      router.push(nextBeat.actionTarget);
    }
  }, [step, router]);

  const goPrev = useCallback(() => {
    setStep(prev => Math.max(prev - 1, 1));
  }, []);

  // ── Run action ───────────────────────────────────────────────────────────────
  async function runAction() {
    if (!beat.actionTarget) return;
    setRunning(true);
    setRunResult(null);

    if (beat.action === 'navigate') {
      router.push(beat.actionTarget);
      setRunning(false);
      return;
    }

    if (beat.action === 'query') {
      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: beat.actionTarget }),
        });
        const data = await res.json() as { reply?: string; error?: string; oktaError?: string; oktaDescription?: string };
        if (data.oktaError) {
          setRunResult(`Okta denied: ${data.oktaError} — ${data.oktaDescription}`);
        } else {
          setRunResult(data.reply ?? data.error ?? 'Done');
        }
        router.push('/chat');
      } catch (e) {
        setRunResult(String(e));
      } finally {
        setRunning(false);
      }
    }
  }

  // ── Exit ─────────────────────────────────────────────────────────────────────
  function exitStory() {
    setActive(false);
    localStorage.removeItem('storyActive');
    localStorage.removeItem('storyStep');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('story');
    const qs = params.toString();
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
  }

  if (!active) return null;

  const isLastStep = step === STORY_BEATS.length;
  const needsPersona = !!beat.requiresPersona && !personaOk;
  const expectedEmail = beat.requiresPersona ? PERSONA_EMAILS[beat.requiresPersona] : null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 shadow-2xl">
      {/* Title bar — always visible */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded font-bold">
            DEMO {step}/{STORY_BEATS.length}
          </span>
          <span className="text-white text-sm font-medium truncate max-w-xs">{beat.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMinimized(m => !m)}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded transition-colors"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? '▲' : '▼'}
          </button>
          <button
            onClick={exitStory}
            className="text-gray-500 hover:text-red-400 text-xs px-2 py-1 rounded transition-colors"
          >
            ✕ Exit
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {!minimized && (
        <div className="px-4 py-3">
          {/* Persona warning */}
          {needsPersona && (
            <div className="bg-amber-950 border border-amber-700 rounded p-2 mb-3 flex items-center justify-between gap-3 text-xs">
              <span className="text-amber-300">
                This step requires <strong>{expectedEmail}</strong>
                {currentEmail && currentEmail !== expectedEmail && ` — currently signed in as ${currentEmail}`}
              </span>
              <a href="/auth/login" className="bg-amber-700 hover:bg-amber-600 text-white px-3 py-1 rounded text-xs whitespace-nowrap transition-colors">
                Sign in →
              </a>
            </div>
          )}

          {/* Narration */}
          <p className="text-gray-300 text-sm leading-relaxed mb-3">{beat.narration}</p>

          {/* Run result */}
          {runResult && (
            <div className="bg-gray-800 border border-gray-600 rounded p-2 mb-3 text-xs text-gray-300 font-mono max-h-20 overflow-y-auto">
              {runResult}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={goPrev}
              disabled={step === 1}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-1.5 rounded text-sm transition-colors"
            >
              ← Prev
            </button>

            {beat.action && beat.action !== 'manual' && (
              <button
                onClick={runAction}
                disabled={running || needsPersona}
                className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm transition-colors"
              >
                {running ? 'Running…' : beat.action === 'query' ? '▶ Run query' : '▶ Navigate'}
              </button>
            )}

            <button
              onClick={goNext}
              disabled={isLastStep}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-1.5 rounded text-sm transition-colors"
            >
              Next →
            </button>

            {/* Step dots */}
            <div className="flex gap-1 ml-2">
              {STORY_BEATS.map(b => (
                <button
                  key={b.step}
                  onClick={() => setStep(b.step)}
                  className={`w-2 h-2 rounded-full transition-colors ${b.step === step ? 'bg-blue-400' : 'bg-gray-600 hover:bg-gray-400'}`}
                  title={b.title}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
