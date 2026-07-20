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
    <div style={{
      position: 'fixed', bottom: 0, left: 248, right: 0, zIndex: 50,
      background: 'rgba(28,27,28,0.92)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(69,70,75,0.5)',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
    }}>
      {/* Title bar — always visible */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: minimized ? 'none' : '1px solid rgba(69,70,75,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 2, background: 'rgba(195,198,210,0.12)', border: '1px solid rgba(195,198,210,0.25)', color: '#c3c6d2', letterSpacing: '0.05em' }}>
            DEMO {step}/{STORY_BEATS.length}
          </span>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: '#e5e2e2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
            {beat.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setMinimized(m => !m)} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#909096', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }} title={minimized ? 'Expand' : 'Minimize'}>
            {minimized ? '▲' : '▼'}
          </button>
          <button onClick={exitStory} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: '#909096', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            ✕ Exit Demo
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {!minimized && (
        <div style={{ padding: '14px 20px' }}>
          {/* Persona warning */}
          {needsPersona && (
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 2, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: '#fcd34d' }}>
                Requires <strong style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{expectedEmail}</strong>
                {currentEmail && currentEmail !== expectedEmail && ` — signed in as ${currentEmail}`}
              </span>
              <a href="/auth/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 2, padding: '4px 12px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Sign in →
              </a>
            </div>
          )}

          {/* Narration */}
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: '#c6c6cc', lineHeight: 1.65, marginBottom: 12 }}>{beat.narration}</p>

          {/* Run result */}
          {runResult && (
            <div style={{ background: 'var(--surface-high)', border: '1px solid var(--outline-variant)', borderRadius: 2, padding: '8px 12px', marginBottom: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#c6c6cc', maxHeight: 80, overflowY: 'auto' }}>
              {runResult}
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={goPrev} disabled={step === 1} style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600,
              padding: '7px 14px', borderRadius: 2, cursor: 'pointer', border: '1px solid var(--outline-variant)',
              background: 'var(--surface-high)', color: '#e5e2e2', opacity: step === 1 ? 0.4 : 1,
            }}>← Prev</button>

            {beat.action && beat.action !== 'manual' && (
              <button onClick={runAction} disabled={running || needsPersona} style={{
                fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600,
                padding: '7px 16px', borderRadius: 2, cursor: 'pointer', border: 'none',
                background: 'var(--primary)', color: '#2d303a', opacity: running || needsPersona ? 0.45 : 1,
              }}>
                {running ? 'Running…' : beat.action === 'query' ? '▶ Run query' : '▶ Navigate'}
              </button>
            )}

            <button onClick={goNext} disabled={isLastStep} style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600,
              padding: '7px 14px', borderRadius: 2, cursor: 'pointer', border: '1px solid var(--outline-variant)',
              background: 'var(--surface-high)', color: '#e5e2e2', opacity: isLastStep ? 0.4 : 1,
            }}>Next →</button>

            {/* Step dots */}
            <div style={{ display: 'flex', gap: 5, marginLeft: 8 }}>
              {STORY_BEATS.map(b => (
                <button key={b.step} onClick={() => setStep(b.step)} title={b.title} style={{
                  width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: b.step === step ? 'var(--primary)' : 'var(--outline-variant)',
                  padding: 0, transition: 'background 0.15s',
                }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
