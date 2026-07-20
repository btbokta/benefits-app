Design a premium security identity demo application called "Benefits Portal — Secured by Okta for AI"
  
  What this app does: It's a developer demo showing Okta's AI agent token exchange (ID-JAG protocol). An AI agent acts on behalf of a signed-in
  employee, and every data access is authorized by a real Okta-issued token. The visual centerpiece is a 3-step token exchange chain: ID Token →
  Identity Assertion JWT (ID-JAG) → Agent Access Token.

  Aesthetic direction: Premium security operations platform. Think Vercel dashboard meets Okta's admin console — refined, technical, trustworthy.
  NOT a generic dark SaaS app. The token chain visualization should feel like live signal intelligence.

  Color system to design:
  - Primary background: very deep navy (darker than #0a0f1e), with a faint hexagonal or circuit-board grid pattern
  - Surface cards: semi-transparent with subtle blue-tinted borders that glow softly on active state
  - Token node accent colors must be visually distinct and memorable: cool blue for the ID token, electric violet/indigo for the ID-JAG (the
  unique Okta-specific token), emerald green for the final agent access token
  - Text: off-white primary, slate-blue secondary, with cyan used only for important technical data like scope names and JWT claim keys
  - Success state (ALLOW): emerald with a subtle pulse animation
  - Denied state (DENY): warm red, no animation — should feel like a hard stop
  - Avoid: purple gradients, teal-heavy palettes, anything that looks like a generic AI product
  
  Pages to design (show all in the mockup):

  1. Home / Landing — hero section with a bold headline "Every data access authorized by Okta", a 5-row persona table showing role names with
  their scope ceilings as small chips, and a prominent "Start Demo" button that launches the guided story mode
  2. Chat + Auth Trace — split layout: left is a chat interface with the AI agent, right is a real-time "Authorization Trace" feed showing each
  tool call as a card with the scope required, ALLOW/DENY badge, and HTTP status. The trace panel is the star — make it feel like a security event
   stream.
  3. Token Flow Visualizer — the most important page. Three glowing nodes connected by animated flowing lines, left to right:
    - Node 1 (blue glow): "ID Token" — issued at org AS login
    - Arrow with label: "Hop 1 — token-exchange → id-jag — POST /oauth2/v1/token"
    - Node 2 (violet glow): "ID-JAG" — the Identity Assertion JWT, unique to Okta for AI
    - Arrow with label: "Hop 2 — jwt-bearer → access token — POST /oauth2/default/v1/token"
    - Node 3 (green glow): "Agent Access Token" — scoped Bearer token
    - Each node has an expandable panel showing decoded JWT claims (sub, scp, cid, jti highlighted in yellow)
    - Below: a "Scope Transformation" card showing what the user's role implied vs what scopes the agent received
  4. Guided Story Mode overlay — a bottom panel (not blocking content) that acts as a presentation teleprompter. It shows: current step (e.g.
  "Step 4 of 10"), the step title in bold, 2-3 sentences of narration explaining what just happened and WHY it matters for Okta for AI, and
  Prev/Next/Run controls. When a step requires a different user persona, show an amber warning with the required email and a "Sign in" button. The
   storytelling integration should feel like an executive demo layer floating above the app — not a tutorial widget.
  
  Typography: A distinctive geometric display font (like Syne or DM Sans) for headings paired with a developer-grade monospace (like JetBrains
  Mono or DM Mono) for token data, JWT claims, and code. The monospace should feel intentional and technical, not accidental.

  Key interaction details to show:
  - The story mode bottom panel should be collapsible to a thin strip showing just the step number + title
  - Persona role badges should each have a unique color (gold for hr_admin, cyan for benefits_specialist, purple for manager, green for employee)
  - Scope names should always display in monospace as small chips, e.g. benefits.compensation.read
  - The navigation bar should show the current user's first name and role badge in the top right
  
  Deliverable: Full desktop mockup showing all 4 views described above, with the story mode overlay active on the Token Flow page showing step 4
  narration.