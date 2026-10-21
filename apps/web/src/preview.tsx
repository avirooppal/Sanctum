import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Shell } from './Shell.js';
import {
  SanctumClient,
  type CapabilityReport,
  type Model,
  type PackInfo,
  type SettingEntry,
  type AssistantProfile,
  type McpServer,
  type CloudProvider,
  type LocalApiServerStatus,
  type Skill,
  type Memory,
} from './api.js';

// Clean initial empty state (fresh data directory contract)
let SAMPLE_MODELS: Model[] = [];

let SAMPLE_PROFILES: AssistantProfile[] = [];

let SAMPLE_MCP_SERVERS: McpServer[] = [];

let SAMPLE_PROVIDERS: CloudProvider[] = [
  { id: 'openai', name: 'OpenAI', has_key: false, description: 'GPT-4o, o1, and OpenAI compatible models' },
  { id: 'anthropic', name: 'Anthropic', has_key: false, description: 'Claude 3.5 Sonnet, Haiku, Opus' },
  { id: 'groq', name: 'Groq', has_key: false, description: 'Ultra-low latency Llama 3 models' },
  { id: 'ollama', name: 'Ollama', has_key: false, description: 'Local Ollama instance on port 11434' },
];

let SAMPLE_LOCAL_API: LocalApiServerStatus = {
  running: false,
  port: 1337,
  allowed_origins: '*',
};

let SAMPLE_SKILLS: Skill[] = [];

let SAMPLE_MEMORIES: Memory[] = [];

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
  const method = init?.method?.toUpperCase() || 'GET';

  // Capabilities
  if (url.includes('/api/capability')) {
    const report: CapabilityReport = {
      capabilities: ['chat', 'models', 'history', 'settings', 'packs', 'assistants', 'mcp', 'providers', 'local_api', 'skills', 'memory'],
      platform_assurance: 'not verified',
      profile: 'desktop',
      hardware: { threads: 6, context: 8192 },
      packs: SAMPLE_PACKS,
    };
    return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Assistant profiles
  if (url.includes('/v1/profiles')) {
    if (method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      if (body.operation === 'delete') {
        SAMPLE_PROFILES = SAMPLE_PROFILES.filter(p => p.id !== body.id);
        return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const id = body.id || `prof-${Date.now()}`;
      const profile: AssistantProfile = {
        id,
        name: body.name || 'Assistant',
        system_prompt: body.system_prompt || '',
        scope: body.scope || 'user',
        created_at: body.created_at || Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      };
      const idx = SAMPLE_PROFILES.findIndex(p => p.id === id);
      if (idx >= 0) {
        SAMPLE_PROFILES[idx] = profile;
      } else {
        SAMPLE_PROFILES.push(profile);
      }
      return new Response(JSON.stringify({ id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ data: SAMPLE_PROFILES }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // MCP Servers
  if (url.includes('/api/mcp/servers')) {
    if (method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      if (body.operation === 'remove') {
        SAMPLE_MCP_SERVERS = SAMPLE_MCP_SERVERS.filter(s => s.id !== body.id);
        return new Response(JSON.stringify({ removed: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const newServer: McpServer = {
        id: `mcp-${Date.now()}`,
        name: body.name || 'Server',
        command: body.command || '',
        args: body.args || [],
        status: 'running',
      };
      SAMPLE_MCP_SERVERS.push(newServer);
      return new Response(JSON.stringify(newServer), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(SAMPLE_MCP_SERVERS), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (url.includes('/api/mcp/calls')) {
    return new Response(JSON.stringify({ handled: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Cloud providers
  if (url.includes('/api/providers/key')) {
    const body = JSON.parse((init?.body as string) || '{}');
    if (method === 'DELETE') {
      SAMPLE_PROVIDERS = SAMPLE_PROVIDERS.map(p => p.id === body.id ? { ...p, has_key: false } : p);
      return new Response(JSON.stringify({ removed: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    SAMPLE_PROVIDERS = SAMPLE_PROVIDERS.map(p => p.id === body.id ? { ...p, has_key: true } : p);
    return new Response(JSON.stringify({ saved: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('/api/providers')) {
    return new Response(JSON.stringify(SAMPLE_PROVIDERS), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Local API server
  if (url.includes('/api/local-api/status')) {
    return new Response(JSON.stringify(SAMPLE_LOCAL_API), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('/api/local-api/start')) {
    const body = JSON.parse((init?.body as string) || '{}');
    SAMPLE_LOCAL_API = { running: true, port: body.port || SAMPLE_LOCAL_API.port, allowed_origins: body.allowed_origins || '*' };
    return new Response(JSON.stringify({ ...SAMPLE_LOCAL_API, started: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('/api/local-api/stop')) {
    SAMPLE_LOCAL_API = { ...SAMPLE_LOCAL_API, running: false };
    return new Response(JSON.stringify({ stopped: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('/api/local-api/config')) {
    const body = JSON.parse((init?.body as string) || '{}');
    SAMPLE_LOCAL_API = { ...SAMPLE_LOCAL_API, port: body.port || SAMPLE_LOCAL_API.port, allowed_origins: body.allowed_origins || '*' };
    return new Response(JSON.stringify({ saved: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Skills
  if (url.includes('/api/skills')) {
    if (method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      if (body.operation === 'delete') {
        SAMPLE_SKILLS = SAMPLE_SKILLS.filter(s => s.id !== body.id);
        return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const id = body.id || `skill-${Date.now()}`;
      const skill: Skill = {
        id,
        name: body.name || 'Custom Skill',
        description: body.description || '',
        content: body.content || '',
        enabled: body.enabled ?? true,
        updated_at: Date.now(),
      };
      const idx = SAMPLE_SKILLS.findIndex(s => s.id === id);
      if (idx >= 0) {
        SAMPLE_SKILLS[idx] = skill;
      } else {
        SAMPLE_SKILLS.push(skill);
      }
      return new Response(JSON.stringify({ id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(SAMPLE_SKILLS), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Memories
  if (url.includes('/api/memories')) {
    if (method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      if (body.operation === 'delete') {
        SAMPLE_MEMORIES = SAMPLE_MEMORIES.filter(m => m.id !== body.id);
        return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const id = body.id || `mem-${Date.now()}`;
      const memory: Memory = {
        id,
        assistant_id: body.assistant_id || null,
        fact: body.fact || '',
        category: body.category || 'general',
        updated_at: Date.now(),
      };
      const idx = SAMPLE_MEMORIES.findIndex(m => m.id === id);
      if (idx >= 0) {
        SAMPLE_MEMORIES[idx] = memory;
      } else {
        SAMPLE_MEMORIES.push(memory);
      }
      return new Response(JSON.stringify({ id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(SAMPLE_MEMORIES), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // GGUF Import
  if (url.includes('/api/models/import-gguf')) {
    const importedModel: Model = { id: 'imported-local-model.gguf', capabilities: ['chat'] };
    SAMPLE_MODELS.push(importedModel);
    return new Response(JSON.stringify({ id: importedModel.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
