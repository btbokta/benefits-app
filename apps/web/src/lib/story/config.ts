export interface StoryBeat {
  step: number;
  title: string;
  narration: string;
  action?: 'navigate' | 'query' | 'manual';
  actionTarget?: string;
  requiresPersona?: 'emily' | 'sarah' | 'michael';
  highlightElement?: string;
}

export const PERSONA_EMAILS: Record<string, string> = {
  emily: 'emily.davis@acmecorp.example',
  sarah: 'sarah.johnson@acmecorp.example',
  michael: 'michael.chen@acmecorp.example',
};

export const STORY_BEATS: StoryBeat[] = [
  {
    step: 1,
    title: 'Meet the Benefits Portal',
    narration: 'This is the ACME Benefits Portal — an HR app where employees check PTO, benefits, and compensation. Every piece of data the AI agent touches is authorized by a real Okta-issued token. There are no hardcoded permission checks in application code — Okta enforces everything.',
    action: 'navigate',
    actionTarget: '/',
  },
  {
    step: 2,
    title: 'Sign in as Emily (employee)',
    narration: 'Emily Davis is a regular employee. Her role limits what scopes Okta will grant the agent — she can read records, enrollments, and PTO, but not salary or HR notes. Sign in as emily.davis@acmecorp.example to continue.',
    action: 'manual',
    requiresPersona: 'emily',
  },
  {
    step: 3,
    title: 'The token exchange begins',
    narration: 'When Emily signs in, the app holds her ID token from the Okta org authorization server. This is the starting point for the two-hop ID-JAG exchange. The ID token proves who Emily is — the agent will use it to request a scoped access token on her behalf.',
    action: 'navigate',
    actionTarget: '/flow',
    requiresPersona: 'emily',
    highlightElement: '#flow-node-0',
  },
  {
    step: 4,
    title: 'Hop 1: ID token → ID-JAG',
    narration: 'The agent presents Emily\'s ID token to the Okta org authorization server, along with a signed JWT proving its own identity (private-key JWT). Okta validates both and issues an Identity Assertion JWT Authorization Grant — a short-lived credential that delegates Emily\'s identity to the agent.',
    action: 'navigate',
    actionTarget: '/flow',
    requiresPersona: 'emily',
    highlightElement: '#flow-node-1',
  },
  {
    step: 5,
    title: 'Hop 2: ID-JAG → scoped access token',
    narration: 'The agent presents the ID-JAG to the custom authorization server. The resource connection policy enforces the scope ceiling for Emily\'s role — the agent can only request scopes she\'s entitled to. The result is a Bearer token the agent will present to the resource server on every API call.',
    action: 'navigate',
    actionTarget: '/flow',
    requiresPersona: 'emily',
    highlightElement: '#flow-node-2',
  },
  {
    step: 6,
    title: 'Ask the agent',
    narration: 'Now let\'s see the agent in action. The chat page connects to the Benefits Agent (Claude), which uses the scoped token for every data lookup. The Authorization Trace panel on the right shows each tool call, the scope required, and whether Okta allowed or denied it.',
    action: 'navigate',
    actionTarget: '/chat',
    requiresPersona: 'emily',
  },
  {
    step: 7,
    title: 'Live denial: Emily asks for salary',
    narration: 'Emily\'s scope ceiling does not include benefits.compensation.read. When she asks for salary data, the agent calls the resource server with its scoped token — and Okta\'s enforcement at the resource server returns a 403. The agent reports the denial honestly instead of hallucinating an answer.',
    action: 'query',
    actionTarget: 'What is my salary?',
    requiresPersona: 'emily',
  },
  {
    step: 8,
    title: 'Switch to Sarah (HR admin)',
    narration: 'Sarah Johnson is an HR admin. Her scope ceiling includes all seven benefits scopes — including compensation.read, notes.read, and audit.read. Sign out of Emily\'s session and sign in as sarah.johnson@acmecorp.example to see the difference.',
    action: 'manual',
    requiresPersona: 'sarah',
  },
  {
    step: 9,
    title: "Sarah's salary query is allowed",
    narration: 'With Sarah signed in, the agent now holds a token that includes benefits.compensation.read. The exact same salary question succeeds — not because we changed any application code, but because Okta issued a different token for a different role.',
    action: 'query',
    actionTarget: "What is Michael Chen's salary?",
    requiresPersona: 'sarah',
  },
  {
    step: 10,
    title: 'The audit log: every decision traced',
    narration: 'The audit page shows every authorization decision — Emily\'s denial and Sarah\'s allow — each tagged with the token\'s JTI. The same JTI appears in Okta\'s System Log under app.oauth2.token.grant.id_jag events. This is the Okta for AI governance story: complete, traceable, tamper-evident.',
    action: 'navigate',
    actionTarget: '/audit',
    requiresPersona: 'sarah',
  },
];
