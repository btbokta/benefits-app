# Benefits Agent — Improvement Roadmap

## Status: Core demo working (Mode A ID-JAG, resource server, agent loop)

---

## Item 1 — Design & UX Overhaul

**Goal:** Replace the current developer-gray UI with a polished, production-grade benefits portal that looks like a real enterprise HR application.

**Scope:**
- Full visual redesign using a benefits/HR aesthetic — clean whites, professional typography, real component hierarchy (nav, cards, data tables, modals)
- Use the `frontend-design` skill (Claude's built-in design system) for high-quality component generation
- LiteLLM passes through to Claude — the `/frontend-design` skill works via the same Anthropic SDK, so it applies here
- Specific surfaces to redesign:
  - `/` home page — persona selector as a proper login chooser, not a raw list
  - `/chat` — conversational UI with proper message bubbles, typing indicators, structured data rendering (tables for PTO/enrollment data)
  - `/inspector` — token chain visualization as an interactive diagram, not raw JSON
  - `/audit` — proper data table with filters, search, color-coded allow/deny rows
- Responsive layout, consistent color system, micro-interactions

---

## Item 2 — Okta for AI Token Flow Visualizer

**Goal:** A dedicated `/flow` page that makes the ID-JAG token exchange legible to someone who has never seen Okta for AI before — essentially a live, annotated walkthrough of what just happened.

**Scope:**
- Animated step-by-step diagram of the Mode A two-hop exchange:
  1. User signs in → ID token issued by org AS
  2. Web app sends ID token to org AS token endpoint → receives ID-JAG (`typ: oauth-id-jag+jwt`)
  3. Agent presents ID-JAG to custom AS → receives scoped access token
  4. Agent presents access token to resource server → data returned (or denied)
- Each step shows:
  - The actual endpoint called (e.g. `POST /oauth2/v1/token`)
  - The grant type URN used
  - A decoded view of the token at that stage (header + key claims, signature redacted)
  - Latency for that hop
  - Whether the step succeeded or failed (with Okta's verbatim error if failed)
- Live — updates in real time when a new broker exchange happens
- "What is this?" tooltip explanations on hover for non-obvious fields (`jti`, `scp`, `act`, `cid`, `aud`)
- Side-by-side comparison: what the user's ID token contained vs. what the agent's access token contains (scope narrowing is the key story)
- System Log link: copyable filter string for each event type (`app.oauth2.token.grant.id_jag`, `workload_principal.*`)

---

## Item 3 — Guided Story Mode

**Goal:** An interactive guided tour that walks a presenter (or first-time viewer) through the full demo narrative step by step, with narration, actions, and the ability to run in auto-pilot or manual-advance mode.

**Scope:**
- Launchable from the home page via a "Start Demo" button
- Two modes:
  - **Auto mode** — the app drives itself: logs in as personas, sends pre-scripted queries, advances steps automatically with timed pauses
  - **Manual mode** — presenter clicks "Next" at each beat; the UI highlights what to look at and what to do
- Story beats (mapped to the DEMO_RUNBOOK.md):
  1. **Setup** — show the persona roster, explain scope ceilings before anyone logs in
  2. **Employee login (Emily)** — auto-login or prompt to log in; highlight her narrow scope ceiling
  3. **Allowed query** — ask "How much PTO do I have?"; show the green ALLOW trace
  4. **Live denial** — ask "What is Michael's salary?"; show the red DENY + missing scope; explain Okta enforced this, not app code
  5. **Token Inspector** — navigate to `/flow`; walk the chain; point at `sub`, `scp`, `cid`
  6. **HR Admin login (Sarah)** — switch personas; show expanded ceiling
  7. **Same salary query → allowed** — contrast with Emily's denial
  8. **Audit log** — show both decisions side-by-side with matching `jti`
  9. **Kill switch** — prompt presenter to deactivate agent in console; show the live failure; reactivate
  10. **System Log** — show Okta-side events matching the `jti`s
- Each beat has:
  - A narration panel (what's happening and why it matters for Okta for AI)
  - The relevant UI surface highlighted/focused
  - A "skip" option to jump ahead
- Story state is URL-addressable (e.g. `/story?step=4`) so it can be shared or resumed
- Progress indicator showing current beat out of total

---

## Implementation order

1. Item 2 (Token Flow Visualizer) — highest demo value, builds on existing `/inspector` data
2. Item 3 (Story Mode) — wraps the whole demo in a narrative; makes Items 1+2 shine
3. Item 1 (Design overhaul) — polish pass after the feature set is locked

---

*Enter plan mode to scope and implement each item.*
