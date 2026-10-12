import { existsSync, readFileSync, statSync, createReadStream } from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = 4173;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = parsedUrl.pathname;

  // CORS headers for local loopback
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Route Handlers matching Sanctum Gateway Schemas
  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      cloud_connectors: 'disabled',
      isolation: 'linux-user-netns-seccomp',
      checks: ['no_network_egress', 'loopback_only']
    }));
    return;
  }

  if (pathname === '/healthz/dispatch') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ queued: [0, 0, 0, 0], active: [0, 0, 0, 0] }));
    return;
  }

  if (pathname === '/v1/capabilities') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      capabilities: ['chat', 'models', 'history', 'dashboard', 'preferences', 'knowledge', 'speech', 'profiles']
    }));
    return;
  }

  if (pathname === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: [
        { id: 'chat-tiny-q8', capabilities: ['text', 'chat'], context_length: 2048, license: 'Apache-2.0' },
        { id: 'embed-small-q8', capabilities: ['embedding'], context_length: 2048, license: 'Apache-2.0' }
      ]
    }));
    return;
  }

  if (pathname === '/v1/preferences') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ preferences: {} }));
    return;
  }

  if (pathname === '/v1/sessions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: [
        { id: 'sess-default', title: 'Private Research Session', pinned: true, updated_at: Date.now() },
        { id: 'sess-code', title: 'Rust Gateway Refactoring', pinned: false, updated_at: Date.now() - 3600000 },
        { id: 'sess-notes', title: 'Local-first Architecture Review', pinned: false, updated_at: Date.now() - 86400000 }
      ],
      has_more: false,
      changed: true
    }));
    return;
  }

  if (pathname === '/v1/conversations') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: ['sess-default', 'sess-code', 'sess-notes'] }));
    return;
  }

  if (pathname.startsWith('/v1/conversations/') && pathname.endsWith('/usage')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      prompt_tokens: 142,
      completion_tokens: 288,
      total_tokens: 430,
      context_length: 2048
    }));
    return;
  }

  if (pathname.startsWith('/v1/conversations/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      history: [
        {
          role: 'user',
          prompt: 'How does Sanctum ensure 100% private local operation?',
          created_at: Date.now() - 60000
        },
        {
          role: 'assistant',
          response: JSON.stringify({
            choices: [{
              message: {
                content: 'Sanctum runs purely on loopback IPC within isolated seccomp and network namespaces. No data leaves your machine.'
              }
            }]
          }),
          created_at: Date.now() - 30000
        }
      ]
    }));
    return;
  }

  if (pathname === '/v1/profiles') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: [
        { id: 'prof-assistant', name: 'General Assistant', system_prompt: 'You are a calm, concise on-device assistant.', model: 'chat-tiny-q8', temperature: 0.7 },
        { id: 'prof-code', name: 'Code Expert', system_prompt: 'You write safe, minimal, verified code.', model: 'chat-tiny-q8', temperature: 0.2 }
      ]
    }));
    return;
  }

  if (pathname === '/v1/purge') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ purged: true }));
    return;
  }

  if (pathname === '/v1/chat/completions') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: {"choices":[{"delta":{"content":"Welcome to **Sanctum** — a calm, private place to think.\\n\\nAll models run locally on your device with verified zero external egress."}}]}\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  if (pathname === '/v1/audio/transcriptions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text: 'Speech transcribed completely on device.' }));
    return;
  }

  // Static Asset Serving from apps/web/dist
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(path.resolve('apps/web/dist'), reqPath.replace(/^\//, ''));
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  } else {
    const indexPath = path.resolve('apps/web/dist/index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    createReadStream(indexPath).pipe(res);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Sanctum UI server running at http://127.0.0.1:${PORT}`);
});
