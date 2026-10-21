import React from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './Shell.js';
import { SanctumClient, type CapabilityReport, type Model, type PackInfo, type SettingEntry } from './api.js';

// Pre-seeded models
const SAMPLE_MODELS: Model[] = [
  { id: 'qwen2.5-coder-7b', capabilities: ['chat', 'code'], context_length: 32768, license: 'Apache-2.0' },
  { id: 'llama-3.2-3b-instruct', capabilities: ['chat'], context_length: 8192, license: 'Llama-3.2' },
  { id: 'mistral-7b-instruct-v0.3', capabilities: ['chat', 'function_calling'], context_length: 32768, license: 'Apache-2.0' },
];

// Pre-seeded packs
let SAMPLE_PACKS: PackInfo[] = [
  {
    id: 'knowledge',
    name: 'Knowledge & Vector Retrieval',
    version: '0.1.0',
    state: 'installed',
    disk_bytes: 42000000,
    ram_budget_mb: 256,
    capabilities: ['knowledge', 'citations'],
    description: 'Local vector database and semantic chunking for private document search.',
  },
  {
    id: 'speech',
    name: 'Speech Synthesis & Dictation',
    version: '0.1.0',
    state: 'absent',
    disk_bytes: 140000000,
    ram_budget_mb: 512,
    capabilities: ['speech_asr', 'speech_tts'],
    description: 'On-device Whisper.cpp transcription and Silero TTS synthesis.',
  },
  {
    id: 'vision',
    name: 'Vision & Visual Reasoning',
    version: '0.1.0',
    state: 'absent',
    disk_bytes: 650000000,
    ram_budget_mb: 1024,
    capabilities: ['vision'],
    description: 'Local vision-language multimodal encoder for image comprehension.',
  },
];

// Mock Fetcher implementing same-origin gateway contracts
const mockFetcher: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input as Request).url;
  const method = init?.method || 'GET';

  // Capability report
  if (url.endsWith('/api/capability')) {
    const report: CapabilityReport = {
      capabilities: ['chat', 'models', 'history', 'settings', 'packs', 'knowledge'],
      platform_assurance: navigator.userAgent.includes('Linux')
        ? 'verified kernel containment'
        : 'not verified (unconfined host process)',
      profile: 'standard-desktop',
      hardware: { threads: 6, context: 8192 },
      packs: SAMPLE_PACKS,
    };
    return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Models list
  if (url.includes('/models')) {
    return new Response(JSON.stringify({ data: SAMPLE_MODELS }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Settings GET / POST
  if (url.includes('/api/settings')) {
    if (method === 'POST') {
      return new Response(JSON.stringify({ updated: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const settings: Record<string, SettingEntry> = {
      'appearance.theme': { value: 'dark', default: 'dark', type: 'string', scope: 'user', risk: 'low', description: 'Application theme' },
      'appearance.density': { value: 'comfortable', default: 'comfortable', type: 'string', scope: 'user', risk: 'low', description: 'Layout density' },
      'inference.context_length': { value: 8192, default: 4096, type: 'number', scope: 'model', risk: 'low', description: 'Context window tokens' },
      'inference.threads': { value: 6, default: 4, type: 'number', scope: 'engine', risk: 'low', description: 'CPU inference threads' },
      'privacy.egress_broker': { value: true, default: true, type: 'boolean', scope: 'system', risk: 'high', description: 'Block all external network calls' },
    };
    return new Response(JSON.stringify(settings), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Pack management
  if (url.includes('/api/pack/load')) {
    const body = JSON.parse((init?.body as string) || '{}');
    SAMPLE_PACKS = SAMPLE_PACKS.map(p => p.id === body.id ? { ...p, state: 'loaded' } : p);
    const updated = SAMPLE_PACKS.find(p => p.id === body.id);
    return new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('/api/pack/unload')) {
    const body = JSON.parse((init?.body as string) || '{}');
    SAMPLE_PACKS = SAMPLE_PACKS.map(p => p.id === body.id ? { ...p, state: 'installed' } : p);
    const updated = SAMPLE_PACKS.find(p => p.id === body.id);
    return new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Sessions list
  if (url.includes('/sessions')) {
    return new Response(JSON.stringify({
      data: [
        { id: 'sess-1', title: 'Local Architecture Discussion', pinned: true },
        { id: 'sess-2', title: 'Knowledge Vector Search Test', pinned: false },
        { id: 'sess-3', title: 'Desktop Performance Budgets', pinned: false },
      ],
      has_more: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Chat completions (SSE stream simulation)
  if (url.includes('/chat/completions')) {
    const stream = new ReadableStream({
      async start(controller) {
        const textParts = [
          'Sanctum is designed as an uncompromising **local-first private desktop** interface.\n\n',
          '### Architecture Overview\n\n',
          '1. **Local-First Core**: Rust gateway process supervising local `llama.cpp` inference workers.\n',
          '2. **Zero Telemetry**: All network egress is blocked by the egress broker.\n',
          '3. **Ultralight UI**: Preact/React modular component library compiled to just ~11 KB gzip.\n\n',
          'Here is an example configuration:\n',
          '```json\n{\n  "engine": "llama.cpp",\n  "context": 8192,\n  "threads": 6,\n  "containment": "enforced"\n}\n```\n\n',
          'All parameters are customizable in the **Models** and **Settings** panels! [ADR-0093: Core Contracts](docs/adr/0093-b4-core-contracts.md)',
        ];

        for (const part of textParts) {
          const payload = JSON.stringify({
            choices: [{ delta: { content: part } }],
          });
          controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
          await new Promise((r) => setTimeout(r, 60));
        }

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Health
  if (url.endsWith('/api/health') || url.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', egress_blocked: true, memory_used_mb: 412 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
};

// Initialize Sanctum Client with the mock fetcher
const client = new SanctumClient('preview-owner-token-12345', mockFetcher, window.location.origin);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <Shell
        client={client}
        initialCapabilities={['chat', 'models', 'history', 'settings', 'packs', 'knowledge']}
        initialPlatformAssurance={navigator.userAgent.includes('Linux') ? 'verified kernel containment' : 'not verified (unconfined host process)'}
      />
    </React.StrictMode>
  );
}
