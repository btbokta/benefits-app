# Benefits Agent — Build Progress

## Status
Build in progress following v2 Implementation Plan.

## Gate checklist

| Gate | Status | Notes |
|---|---|---|
| Gate 0 — preflight | ⬜ pending | Needs OKTA_ORG_URL + OKTA_API_TOKEN in .env; run `node scripts/preflight.mjs` |
| Gate 1 — scaffold + seed | ⬜ pending | Run `npm i && npm run seed && npm test && npm run build` |
| Gate 2 — Okta setup | ⬜ pending | Run `node scripts/setup-okta.mjs` then `node scripts/verify-okta.mjs` |
| Gate 3 — web login | ⬜ pending | Log in as Sarah, verify /api/me shows role: hr_admin |
| Gate 4 — resource server | ⬜ pending | `curl -i :3001/api/employees` → 401 with WWW-Authenticate |
| Gate 5 — token broker | ⬜ pending | `node scripts/get-agent-token.mjs` with real session token |
| Gate 6 — agent loop | ⬜ pending | Emily asks "Michael's salary?" → live Okta denial |
| Gate 7 — demo surfaces | ⬜ pending | /inspector shows chain, /audit gated correctly |
| Gate 8 — MCP | ⬜ pending | `AGENT_TOOL_TRANSPORT=mcp` — same scenarios pass |

## Phase 5.2 — Mode A manual steps (HUMAN)
- [ ] Directory → AI Agents → Register AI agent → Register manually → name: "Benefits AI Agent"
- [ ] Owners tab → Edit → assign admin users
- [ ] Credentials tab → Add public key → paste PUBLIC JWK from `node scripts/agent-keys.mjs` → Activate
- [ ] Copy Key ID + Agent Client ID → update .env OKTA_AGENT_KID + OKTA_AGENT_CLIENT_ID
- [ ] Delegations tab → User sign-on → Add caller → Benefits Agent - Web
- [ ] Delegations tab → Non-human identity → Configure → authorization server: default
- [ ] Resource connections tab → Add → Authorization Server → default → Only allow → check all 7 benefits.* scopes
- [ ] Actions → Activate

## Phase 2.9 — Manual (HUMAN)
- [ ] Applications → Benefits Agent - Web → Sign On tab → OpenID Connect ID Token → Edit
      Groups claim filter: `groups` Matches regex `^(HR-Admins|Benefits-Team|Managers|Employees)$` → Save

## Phase 0 Preflight — 2026-07-20T13:24:39.340Z

| Probe | Result |
|---|---|
| Org API | ✅ undefined |
| Org AS discovery | ✅ |
| Custom AS (default) | ✅ |
| Mode A API | ✅ Available |

OKTA_AI_MODE recommendation: `agents`
