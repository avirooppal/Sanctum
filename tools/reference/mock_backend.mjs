/**
 * Reference Mock Backend for Jan UI Reference Runs
 *
 * Implements the minimal contract needed by Jan's web-app to render all views
 * and states offline with zero external network connectivity.
 */

import http from 'node:http';

const PORT = 39281;

const mockModels = [
  {
    id: 'local-model-q4',
    object: 'model',
    name: 'Local Llama 3.2 3B Q4',
    owned_by: 'local',
    context_length: 8192,
    capabilities: ['text', 'tools'],
    format: 'gguf',
    size: 2147483648,
  },
];

const mockThreads = [
  {
    id: 'th-ref-1',
    title: 'Reference Chat Conversation',
    created: 1729500000,
    updated: 1729500000,
    assistants: [{ id: 'jan', model: { id: 'local-model-q4', engine: 'llamacpp' } }],
  },
];

const mockMessages = [
  {
    id: 'msg-ref-1',
    thread_id: 'th-ref-1',
    role: 'user',
    content: [{ type: 'text', text: { value: 'Hello Sanctum reference run' } }],
    created_at: 1729500000,
  },
  {
    id: 'msg-ref-2',
    thread_id: 'th-ref-1',
    role: 'assistant',
    content: [{ type: 'text', text: { value: 'This is an exact reference rendering from the pinned Jan upstream commit.' } }],
    created_at: 1729500001,
  },
];

const mockHardware = {
  cpu: {
    model: 'AMD/Intel x86_64 Reference',
    threads: 8,
    physical_cores: 4,
  },
  ram: {
    total: 17179869184,
    free: 8589934592,
  },
  gpus: [
    {
      name: 'Vulkan/DirectX Reference GPU',
      vram_total: 8589934592,
      vram_free: 6442450944,
    },
  ],
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  if (path === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: mockModels }));
    return;
  }

  if (path === '/v1/threads') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockThreads));
    return;
  }

  if (path === '/v1/threads/th-ref-1/messages') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: mockMessages }));
    return;
  }

  if (path === '/v1/hardware') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockHardware));
    return;
  }

  if (path === '/v1/chat/completions') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Reference ' } }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'stream ' } }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'chunk.' } }] })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Reference mock backend listening on http://127.0.0.1:${PORT}`);
});
