import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Shell } from './Shell.js';
import { SanctumClient, type CapabilityReport, type Model, type PackInfo, type SettingEntry } from './api.js';

// Clean initial empty state (fresh data directory contract)
const SAMPLE_MODELS: Model[] = [];

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
];

// Mock fetch interceptor for local browser preview harness
const realFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  // Capabilities
  if (url.includes('/api/capability')) {
    const report: CapabilityReport = {
      capabilities: ['chat', 'models', 'history', 'settings', 'packs'],
      platform_assurance: 'not verified',
      profile: 'desktop',
      hardware: { threads: 6, context: 8192 },
      packs: SAMPLE_PACKS,
    };
    return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Models
  if (url.includes('/models') || url.includes('/api/models')) {
    return new Response(JSON.stringify({ data: SAMPLE_MODELS }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Settings
  if (url.includes('/api/settings')) {
    const settings: Record<string, SettingEntry> = {
      'ui.theme': { value: 'dark', default: 'dark', type: 'string', scope: 'user', risk: 'low', description: 'Application color theme' },
      'ui.scale_factor': { value: 1.0, default: 1.0, type: 'number', scope: 'user', risk: 'low', description: 'Display zoom factor' },
      'ui.reduced_motion': { value: false, default: false, type: 'boolean', scope: 'user', risk: 'low', description: 'Disable animated transitions' },
      'inference.threads': { value: 6, default: 4, type: 'number', scope: 'engine', risk: 'low', description: 'CPU inference threads' },
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

  // Sessions list (fresh-data empty state)
  if (url.includes('/sessions')) {
    return new Response(JSON.stringify({
      data: [],
      has_more: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Chat completions (SSE stream echo)
  if (url.includes('/chat/completions')) {
    const stream = new ReadableStream({
      async start(controller) {
        const textParts = [
          'Local inference loopback active. Ready for instructions.\n',
        ];

        for (const part of textParts) {
          const payload = JSON.stringify({
            choices: [{ delta: { content: part } }],
          });
          controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
          await new Promise((r) => setTimeout(r, 40));
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
    return new Response(JSON.stringify({ status: 'ok', platform_assurance: 'not verified' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return realFetch(input, init);
};

const client = new SanctumClient('preview-token', window.fetch.bind(window), window.location.origin);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Shell client={client} />);
}
