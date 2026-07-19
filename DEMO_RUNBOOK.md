# Benefits Agent — Demo Runbook

## Prerequisites
```bash
cd benefits-agent
npm run dev           # starts web (:3000) and resource-server (:3001)
node scripts/smoke.mjs  # verify all green before starting
```

---

## Beat 1 — Employee login, small scope ceiling
1. Open http://localhost:3000 (logged out)
2. Click **Sign in with Okta**
3. Log in as **Emily Davis** (`emily.davis@acmecorp.example` / your SEED_USER_PASSWORD)
4. Home page shows:
   - Role: `employee`
   - Scope ceiling chips: `record.read`, `enrollment.read`, `enrollment.write`, `pto.read`
   - *Point out: no compensation.read, no notes.read, no audit.read*

## Beat 2 — Live Okta denial (salary)
1. Click **Chat with Agent**
2. Ask: *"What is Michael Chen's salary?"*
3. The agent calls `get_compensation` → Okta denies → Authorization Trace panel shows **DENY**, HTTP 403, missing scope: `benefits.compensation.read`
4. Agent replies: *"Okta denied the agent that permission — missing scope: benefits.compensation.read"*
   - *No hallucinated salary. The token literally cannot read that field.*

## Beat 3 — Allowed request (PTO)
1. Ask: *"How much PTO do I have?"*
2. Agent calls `get_pto` → Okta allows (scope in ceiling) → returns Emily's own balances only
3. Authorization Trace shows **ALLOW**, HTTP 200

## Beat 4 — Token Inspector
1. Click **Token Inspector** (or nav link)
2. Walk the chain:
   - **Mode A**: ID token (org AS) → **ID-JAG** (point at `typ: oauth-id-jag+jwt`, `sub`=Emily, `aud`=custom AS) → Agent access token (`sub`=Emily, `scp`=her ceiling, `cid`=agent client ID)
   - **Mode C**: User access token → Agent access token (`sub`=Emily, **`cid`=agent client ID**, `scp`=her ceiling)
3. Note TTL countdown — token expires in ~1h
4. *"Every tool call presents this token. If Okta doesn't mint it, the agent reads nothing."*

## Beat 5 — HR Admin view
1. Log out (Sign out button)
2. Log in as **Sarah Johnson** (`sarah.johnson@acmecorp.example`)
3. Scope ceiling now includes `compensation.read`, `notes.read`, `audit.read`
4. Ask: *"What is Michael Chen's salary?"* → **ALLOW**, salary returned
5. Visit **/audit** → full log of both Emily's denial + Sarah's allowance, each with `tokenJti`

## Beat 6 — MCP transport (optional)
1. Stop the dev server
2. `AGENT_TOOL_TRANSPORT=mcp npm run dev`
3. Same salary question → same allow/deny behavior, same audit rows
4. *"Every MCP tool call carried the same Okta token"*

## Beat 7 — Revoke from inspector
1. Visit **/inspector** → click **Revoke agent token**
2. Ask any question in chat → error: broker must re-exchange
3. Click **Refresh exchange** → new token minted → queries resume

## Beat 8 — Kill switch
**Mode A:**
1. Okta Admin Console → Directory → AI Agents → Benefits AI Agent → Actions → **Deactivate**
2. Chat: any question → `BrokerError: invalid_client` (verbatim from Okta)
3. Reactivate → next question succeeds

**Mode C:**
1. Applications → Benefits Agent - Agent Client → Deactivate
2. Same failure, same recovery

## Beat 9 — System Log evidence
1. Reports → System Log in the Okta Admin Console
2. Filter: `app.oauth2.token.grant.id_jag` (Mode A) or `user.authentication.*`
3. Match `jti` values in the filter against the `/audit` page rows
4. For Mode A also filter: `workload_principal.*` to see agent lifecycle events

---

## Quick persona reference

| Persona | Role | Notable scopes |
|---|---|---|
| sarah.johnson@acmecorp.example | hr_admin | All 7 scopes |
| james.wilson@acmecorp.example | benefits_specialist | enrollment (no salary) |
| michael.chen@acmecorp.example | manager | self + Emily/Lisa/Marcus only |
| emily.davis@acmecorp.example | employee | self only, no salary |
| lisa.park@acmecorp.example | employee | self only, no salary |
