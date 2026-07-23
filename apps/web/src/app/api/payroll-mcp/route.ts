import { type NextRequest, NextResponse } from 'next/server';
import { verifyBearer } from '@/lib/rs/auth';
import { callPayrollTool, TOOL_DEFINITIONS } from '@/lib/mcp/tools';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: unknown;
}

const SERVER_INFO = { name: 'meridian-payroll', version: '1.0.0' };
const PROTOCOL_VERSION = '2024-11-05';

async function handleRpc(msg: JsonRpcRequest, authHeader: string | null) {
  const isNotification = msg.id === undefined || msg.id === null;

  if (msg.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    };
  }

  if (msg.method.startsWith('notifications/')) {
    return null; // notifications need no response
  }

  if (msg.method === 'tools/list') {
    return { jsonrpc: '2.0', id: msg.id, result: { tools: TOOL_DEFINITIONS } };
  }

  if (msg.method === 'tools/call') {
    let principal;
    try {
      principal = await verifyBearer(authHeader ?? undefined);
    } catch {
      return { jsonrpc: '2.0', id: msg.id, error: { code: -32001, message: 'unauthorized' } };
    }

    const { name, arguments: args } = (msg.params as { name: string; arguments: Record<string, unknown> }) ?? {};
    if (!name) return { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'missing tool name' } };

    const result = await callPayrollTool(name, args ?? {}, principal);
    return { jsonrpc: '2.0', id: msg.id, result };
  }

  if (!isNotification) {
    return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (Array.isArray(body)) {
    const results = await Promise.all((body as JsonRpcRequest[]).map(msg => handleRpc(msg, authHeader)));
    const responses = results.filter(r => r !== null);
    if (responses.length === 0) return new Response(null, { status: 202 });
    return NextResponse.json(responses);
  }

  const result = await handleRpc(body as JsonRpcRequest, authHeader);
  if (result === null) return new Response(null, { status: 202 });
  return NextResponse.json(result);
}
