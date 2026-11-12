import assert from 'node:assert/strict';
import { test } from 'node:test';
import { streamWorkspaceChat, executeWorkspaceToolCall, globalPermissionGate } from '../core/ai/tools/workspace_chat.ts';
import { parseModelToolCalls } from '../core/ai/tools/parse_calls.ts';
import { ToolScheduler } from '../core/ai/tools/scheduler.ts';
import { RequestStatusTracker } from '../core/ai/request_status.ts';

function records(items: unknown[]) {
  const bytes = new TextEncoder().encode(items.map(item => JSON.stringify(item)).join('\n') + '\n');
  return new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7)); c.close(); } }));
}

test('workspace chat executes structured calls and returns real tool results to the model', async () => {
  const original = globalThis.fetch;
  const requests: any[] = [], activities: any[] = [];
  let rounds = 0;
  globalThis.fetch = async (url, init) => {
    if (url === '/api/workspace') return Response.json({ root: 'workspace', id: 'workspace-token' });
    const body = JSON.parse(String(init?.body)); requests.push({ url, body });
    if (url === '/api/tools/execute') return Response.json({ content: 'Hello 🌍' });
    rounds++;
    if (rounds === 1) return records([{ message: { tool_calls: [{ function: { name: 'read_file', arguments: { action: 'read', path: 'hello.txt' } } }] } }, { done: true }]);
    assert.equal(body.messages.at(-1).role, 'tool');
    assert.equal(JSON.parse(body.messages.at(-1).content).content, 'Hello 🌍');
    assert.equal(body.messages.at(-2).tool_calls[0].function.name, 'read_file');
    return records([{ message: { content: 'Read Hello 🌍' } }, { done: true }]);
  };
  try {
    const chunks = [];
    for await (const chunk of streamWorkspaceChat('real-selected-model', [{ role: 'user', content: 'Read hello.txt' }], { signal: new AbortController().signal, onActivity: a => activities.push(a) })) chunks.push(chunk);
    assert.equal(chunks.at(-1)?.isFinished, true);
    assert.match(chunks.at(-1)!.text, /Read Hello 🌍/);
    assert.deepEqual(activities.map(a => a.status), ['running', 'success']);
    assert.equal(requests.find(r => r.url === '/api/tools/execute').body.workspaceId, 'workspace-token');
    assert.ok(requests.filter(r => r.url === '/api/chat').every(r => r.body.model === 'real-selected-model'));
  } finally { globalThis.fetch = original; }
});

test('failed tools are fed back as errors and never marked successful', async () => {
  const original = globalThis.fetch;
  const activities: any[] = [];
  let rounds = 0;
  globalThis.fetch = async (url, init) => {
    if (url === '/api/workspace') return Response.json({ root: 'workspace', id: 'id' });
    if (url === '/api/tools/execute') return Response.json({ error: 'Outside workspace' }, { status: 400 });
    if (++rounds === 1) return records([{ message: { tool_calls: [{ function: { name: 'read_file', arguments: { action: 'read', path: '../secret' } } }] }, done: true }]);
    assert.match(JSON.parse(String(init?.body)).messages.at(-1).content, /Outside workspace/);
    return records([{ message: { content: 'Access denied.' }, done: true }]);
  };
  try {
    for await (const _ of streamWorkspaceChat('model', [], { signal: new AbortController().signal, onActivity: a => activities.push(a) })) { /* drain */ }
    assert.equal(activities.at(-1).status, 'error');
  } finally { globalThis.fetch = original; }
});

test('tool loop rejects truncated streams and honors cancellation before executing', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let executes = 0;
  globalThis.fetch = async url => {
    if (url === '/api/workspace') return Response.json({ root: 'workspace', id: 'id' });
    if (url === '/api/tools/execute') executes++;
    return records([{ message: { tool_calls: [{ function: { name: 'read_file', arguments: { action: 'delete', path: 'a' } } }] } }]);
  };
  try {
    await assert.rejects(async () => { for await (const _ of streamWorkspaceChat('model', [], { signal: controller.signal, onActivity() {} })) {} }, /before completion/);
    assert.equal(executes, 0);
    controller.abort();
    await assert.rejects(async () => { for await (const _ of streamWorkspaceChat('model', [], { signal: controller.signal, onActivity() {} })) {} });
    assert.equal(executes, 0);
  } finally { globalThis.fetch = original; }
});

test('status tracker supports answer/tool cycles and stopping tools', () => {
  const tracker = new RequestStatusTracker({ requestId: 'r', threadId: 't', messageId: 'm' });
  for (const phase of ['reading_message', 'writing_answer', 'using_tool', 'writing_answer', 'using_tool', 'stopped'] as const) tracker.transition(phase);
  assert.equal(tracker.getCurrentPhase(), 'stopped');
  tracker.destroy();
});

test('SEC-06: write and shell tools require always_ask and fail closed without approval handler', async () => {
  for (const name of ['create_file', 'edit_file', 'delete_path', 'run_command', 'start_background']) {
    assert.equal(globalPermissionGate.getTool(name)?.permissionLevel, 'always_ask', `${name} must be always_ask`);
  }
  assert.equal(globalPermissionGate.getTool('read_file')?.permissionLevel, 'auto_allow');

  const original = globalThis.fetch;
  let executed = 0;
  globalThis.fetch = async () => { executed++; return Response.json({ ok: true }); };
  try {
    const res = await executeWorkspaceToolCall(
      { name: 'run_command', arguments: { command: 'whoami' } },
      { root: 'ws', id: 'sec06-fail-closed' },
      new AbortController().signal,
      () => {}
    );
    assert.equal(res.ok, false);
    assert.equal(executed, 0);
    assert.match(res.output, /denied|approval/i);
  } finally {
    globalThis.fetch = original;
  }
});

test('SEC-06: denied tool returns refusal to model without executing; approve once vs session scopes work', async () => {
  const original = globalThis.fetch;
  let execCalls = 0;
  let prompts = 0;
  globalPermissionGate.clearSession('sec06-ws');
  globalThis.fetch = async (url) => {
    if (url === '/api/tools/execute' || url === '/api/terminal/execute') {
      execCalls++;
      return Response.json({ created: 'a.txt' });
    }
    return Response.json({});
  };
  try {
    const denied = await executeWorkspaceToolCall(
      { name: 'create_file', arguments: { path: 'a.txt', content: 'hi' } },
      { root: 'ws', id: 'sec06-ws' },
      new AbortController().signal,
      () => {},
      { onApprovalRequest: async () => { prompts++; return { decision: 'denied', scope: 'once' }; } }
    );
    assert.equal(denied.ok, false);
    assert.equal(execCalls, 0);
    assert.equal(prompts, 1);

    const once = await executeWorkspaceToolCall(
      { name: 'create_file', arguments: { path: 'a.txt', content: 'hi' } },
      { root: 'ws', id: 'sec06-ws' },
      new AbortController().signal,
      () => {},
      { onApprovalRequest: async () => { prompts++; return { decision: 'approved', scope: 'once' }; } }
    );
    assert.equal(once.ok, true);
    assert.equal(execCalls, 1);
    assert.equal(prompts, 2);

    const sess1 = await executeWorkspaceToolCall(
      { name: 'create_file', arguments: { path: 'b.txt', content: 'hi' } },
      { root: 'ws', id: 'sec06-ws' },
      new AbortController().signal,
      () => {},
      { onApprovalRequest: async () => { prompts++; return { decision: 'approved', scope: 'session' }; } }
    );
    assert.equal(sess1.ok, true);
    assert.equal(prompts, 3);

    const sess2 = await executeWorkspaceToolCall(
      { name: 'create_file', arguments: { path: 'c.txt', content: 'hi' } },
      { root: 'ws', id: 'sec06-ws' },
      new AbortController().signal,
      () => {},
      { onApprovalRequest: async () => { prompts++; return { decision: 'denied', scope: 'once' }; } }
    );
    assert.equal(sess2.ok, true);
    assert.equal(execCalls, 3);
    assert.equal(prompts, 3);
  } finally {
    globalPermissionGate.clearSession('sec06-ws');
    globalThis.fetch = original;
  }
});

test('BUG-03: parseModelToolCalls maps shell aliases to run_command and ToolScheduler extracts proc:shell', () => {
  for (const alias of ['execute_command', 'run_shell', 'shell', 'runcommand', 'run_command']) {
    const calls = parseModelToolCalls({
      tool_calls: [{ function: { name: alias, arguments: { command: 'git status' } } }],
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'run_command', `Alias ${alias} must normalize to run_command`);
  }

  for (const name of ['run_command', 'start_background', 'stop_background']) {
    const resources = ToolScheduler.extractResources({ id: '1', name, arguments: { command: 'echo 1' } });
    assert.ok(resources.includes('proc:shell'), `${name} must extract proc:shell resource`);
  }
});
