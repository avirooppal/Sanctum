import test from 'node:test';
import assert from 'node:assert/strict';
import { SanctumClient } from '../build/tests/api.js';

test('SanctumClient manages MCP servers: list, add, remove, and respond to call', async () => {
  const fakeFetcher = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer phase1-token');
    if (url === '/api/mcp/servers' && options.method === 'GET') {
      return {
        ok: true,
        json: async () => [
          {
            id: 'mcp-fs',
            name: 'Filesystem MCP',
            status: 'running',
            tools: [{ name: 'read_file', description: 'Read a file' }],
          },
        ],
      };
    }
    if (url === '/api/mcp/servers' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      if (body.operation === 'add') {
        assert.equal(body.name, 'SQLite MCP');
        return {
          ok: true,
          json: async () => ({
            id: 'mcp-sql',
            name: 'SQLite MCP',
            status: 'stopped',
            tools: [],
          }),
        };
      }
      if (body.operation === 'remove') {
        assert.equal(body.id, 'mcp-sql');
        return { ok: true, json: async () => ({ removed: true }) };
      }
    }
    if (url === '/api/mcp/calls' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.call_id, 'call-123');
      assert.equal(body.approved, true);
      return { ok: true, json: async () => ({ handled: true }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const client = new SanctumClient('phase1-token', fakeFetcher);

  const servers = await client.mcpServers();
  assert.equal(servers.length, 1);
  assert.equal(servers[0].id, 'mcp-fs');
  assert.equal(servers[0].tools[0].name, 'read_file');

  const added = await client.addMcpServer({ name: 'SQLite MCP', command: 'sqlite-mcp', args: [] });
  assert.equal(added.id, 'mcp-sql');

  await client.removeMcpServer('mcp-sql');
  await client.respondMcpCall('call-123', true);
});

test('SanctumClient manages Cloud Providers: list, save key, remove key', async () => {
  const fakeFetcher = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer phase1-token');
    if (url === '/api/providers' && options.method === 'GET') {
      return {
        ok: true,
        json: async () => [
          {
            id: 'openai',
            name: 'OpenAI',
            models: ['gpt-4o'],
            has_key: false,
            base_url: 'https://api.openai.com/v1',
          },
        ],
      };
    }
    if (url === '/api/providers/key' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.id, 'openai');
      assert.equal(body.api_key, 'sk-test');
      return { ok: true, json: async () => ({ saved: true }) };
    }
    if (url === '/api/providers/key' && options.method === 'DELETE') {
      const body = JSON.parse(options.body);
      assert.equal(body.id, 'openai');
      return { ok: true, json: async () => ({ removed: true }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const client = new SanctumClient('phase1-token', fakeFetcher);

  const providers = await client.cloudProviders();
  assert.equal(providers.length, 1);
  assert.equal(providers[0].id, 'openai');
  assert.equal(providers[0].has_key, false);

  await client.saveProviderKey('openai', 'sk-test');
  await client.removeProviderKey('openai');
});

test('SanctumClient manages Local API Server: status, start, stop, config', async () => {
  const fakeFetcher = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer phase1-token');
    if (url === '/api/local-api/status' && options.method === 'GET') {
      return {
        ok: true,
        json: async () => ({
          running: false,
          port: 1337,
          api_key_configured: false,
          allowed_origins: 'http://localhost',
        }),
      };
    }
    if (url === '/api/local-api/start' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.port, 8080);
      assert.equal(body.allowed_origins, '*');
      return {
        ok: true,
        json: async () => ({
          started: true,
          running: true,
          port: 8080,
          api_key_configured: true,
          allowed_origins: '*',
        }),
      };
    }
    if (url === '/api/local-api/stop' && options.method === 'POST') {
      return { ok: true, json: async () => ({ stopped: true }) };
    }
    if (url === '/api/local-api/config' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.port, 9000);
      return { ok: true, json: async () => ({ saved: true }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const client = new SanctumClient('phase1-token', fakeFetcher);

  const status = await client.localApiStatus();
  assert.equal(status.running, false);
  assert.equal(status.port, 1337);

  const started = await client.startLocalApi(8080, '*');
  assert.equal(started.running, true);

  await client.updateLocalApiConfig(9000, '*');
  await client.stopLocalApi();
});

test('SanctumClient manages Skills: list, save, delete', async () => {
  const fakeFetcher = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer phase1-token');
    if (url === '/api/skills' && options.method === 'GET') {
      return {
        ok: true,
        json: async () => [
          {
            id: 'skill-code-review',
            name: 'Code Reviewer',
            description: 'Strict TypeScript and security guidelines',
            content: '# Code Review Guidelines',
            enabled: true,
          },
        ],
      };
    }
    if (url === '/api/skills' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      if (body.operation === 'delete') {
        assert.equal(body.id, 'skill-code-review');
        return { ok: true, json: async () => ({ deleted: true }) };
      }
      assert.equal(body.name, 'Docs Writer');
      return { ok: true, json: async () => ({ id: 'skill-docs' }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const client = new SanctumClient('phase1-token', fakeFetcher);

  const skills = await client.skills();
  assert.equal(skills.length, 1);
  assert.equal(skills[0].id, 'skill-code-review');
  assert.equal(skills[0].enabled, true);

  const saved = await client.saveSkill({
    name: 'Docs Writer',
    description: 'Technical docs writer',
    content: '# Docs Rules',
    enabled: true,
  });
  assert.equal(saved.id, 'skill-docs');

  await client.deleteSkill('skill-code-review');
});

test('SanctumClient manages Memories: list, save, delete', async () => {
  const fakeFetcher = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer phase1-token');
    if (url.startsWith('/api/memories') && options.method === 'GET') {
      return {
        ok: true,
        json: async () => [
          {
            id: 'mem-1',
            assistant_id: null,
            fact: 'User prefers concise responses',
            category: 'preference',
          },
        ],
      };
    }
    if (url === '/api/memories' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      if (body.operation === 'delete') {
        assert.equal(body.id, 'mem-1');
        return { ok: true, json: async () => ({ deleted: true }) };
      }
      assert.equal(body.fact, 'User working on desktop platform');
      return { ok: true, json: async () => ({ id: 'mem-2' }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const client = new SanctumClient('phase1-token', fakeFetcher);

  const memories = await client.memories();
  assert.equal(memories.length, 1);
  assert.equal(memories[0].id, 'mem-1');
  assert.equal(memories[0].category, 'preference');

  const saved = await client.saveMemory({
    fact: 'User working on desktop platform',
    category: 'project',
  });
  assert.equal(saved.id, 'mem-2');

  await client.deleteMemory('mem-1');
});

