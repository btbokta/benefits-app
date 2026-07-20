import Anthropic from '@anthropic-ai/sdk';
import type { SessionData } from '@/lib/session';
import { ROLE_SCOPES } from '@benefits-agent/shared';
import { TOOL_DEFINITIONS, executeTool, type ToolEvent, type ToolName } from './tools';
import type { BrokeredToken } from '@/lib/token-broker';

const MAX_TOOL_ITERATIONS = 8;

export interface AgentResponse {
  reply: string;
  toolEvents: ToolEvent[];
  tokenMeta: {
    scope: string;
    expiresAt: number;
    chain: BrokeredToken['chain'];
    mode: string;
  };
}

const SYSTEM_PROMPT = `You are the ACME benefits assistant. You can only see data your tools return.
If a tool returns denied:true, tell the user "Okta denied the agent that permission" and name the missing scope(s).
Never speculate about data you could not read.
When presenting employee information, be concise and professional.
Never reveal or discuss token contents, credentials, or internal system details.`;

function mockIntentRouter(query: string, userEmail: string): { tool: ToolName; input: Record<string, unknown> } | null {
  const q = query.toLowerCase();
  if (/pto|vacation|sick|time off/.test(q)) return { tool: 'get_pto', input: {} };
  if (/salary|compens|pay/.test(q)) {
    const emailMatch = q.match(/[\w.-]+@[\w.-]+/);
    if (emailMatch) return { tool: 'get_compensation', input: { email: emailMatch[0] } };
    return { tool: 'get_compensation', input: { email: userEmail } };
  }
  if (/enrollment|enrolled|plan|coverage/.test(q)) return { tool: 'get_enrollments', input: {} };
  if (/audit/.test(q)) return { tool: 'read_audit', input: {} };
  return null;
}

export async function runAgentLoop(
  userMessage: string,
  session: SessionData,
  brokeredToken: BrokeredToken
): Promise<AgentResponse> {
  const toolEvents: ToolEvent[] = [];
  const tokenMeta = {
    scope: brokeredToken.scope,
    expiresAt: brokeredToken.expiresAt,
    chain: brokeredToken.chain,
    mode: process.env.OKTA_AI_MODE ?? 'obo',
  };

  // MOCK_LLM path: deterministic intent routing, still uses real tools + real token
  if (process.env.MOCK_LLM === 'true' || !process.env.ANTHROPIC_API_KEY) {
    const intent = mockIntentRouter(userMessage, session.email);
    if (intent) {
      const { result, event } = await executeTool(intent.tool, intent.input, brokeredToken.accessToken);
      toolEvents.push(event);
      const reply = event.allowed
        ? `Here is the information from the ACME benefits system:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\n*(Mock response — set ANTHROPIC_API_KEY for real AI answers)*`
        : `Okta denied the agent that permission. Missing scope: **${(result as { missingScopes?: string[] }).missingScopes?.join(', ')}**\n\n*(Mock response)*`;
      return { reply, toolEvents, tokenMeta };
    }
    return {
      reply: `Hello ${session.name}! I can help with PTO, benefits, enrollments, and employee information. What would you like to know?\n\n*(Mock mode — set ANTHROPIC_API_KEY for real AI responses)*`,
      toolEvents,
      tokenMeta,
    };
  }

  // Real Claude loop
  const clientOptions: ConstructorParameters<typeof Anthropic>[0] = {
    apiKey: process.env.ANTHROPIC_API_KEY,
  };
  if (process.env.ANTHROPIC_BASE_URL) {
    clientOptions.baseURL = process.env.ANTHROPIC_BASE_URL;
  }
  const client = new Anthropic(clientOptions);
  const tools = TOOL_DEFINITIONS.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema: input_schema as Anthropic.Tool['input_schema'],
  }));

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  let reply = '';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
      reply = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('');
      break;
    }

    // Process tool calls
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
    if (toolUseBlocks.length === 0) {
      reply = response.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('');
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const { result, event } = await executeTool(
        toolUse.name as ToolName,
        toolUse.input as Record<string, unknown>,
        brokeredToken.accessToken
      );
      toolEvents.push(event);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (!reply) {
    reply = 'I was unable to complete the request within the allowed tool iterations.';
  }

  return { reply, toolEvents, tokenMeta };
}
