import test from 'node:test';
import assert from 'node:assert/strict';
import { SanctumClient } from '../build/tests/api.js';

test('SanctumClient calls /api/capability and returns structured report', async () => {
  const fakeFetcher = async (url, options) => {
    assert.equal(url, '/api/capability');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return {
      ok: true,
      json: async () => ({
        capabilities: ['chat', 'models', 'settings', 'packs'],
        platform_assurance: 'not verified',
        profile: 'desktop-core-v1',
        hardware: { threads: 8, context: 8192 },
        packs: [
          {
            id: 'knowledge',
            name: 'Knowledge',
            version: '0.1.0',
            state: 'installed',
            disk_bytes: 1048576,
            ram_budget_mb: 512,
            capabilities: ['rag'],
          },
        ],
      }),
    };
  };

  const client = new SanctumClient('test-token', fakeFetcher);
  const report = await client.getCapabilityReport();

  assert.equal(report.platform_assurance, 'not verified');
  assert.equal(report.hardware.threads, 8);
  assert.equal(report.packs.length, 1);
  assert.equal(report.packs[0].id, 'knowledge');
});

test('SanctumClient manages settings via GET, POST, export, and import', async () => {
  const settingsState = {
    'ui.theme': {
      value: 'dark',
      default: 'dark',
      type: 'enum',
      scope: 'global',
      risk: 'low',
      description: 'Interface color theme',
    },
  };

  const fakeFetcher = async (url, options) => {
    if (url === '/api/settings' && options.method === 'GET') {
      return { ok: true, json: async () => settingsState };
    }
    if (url === '/api/settings' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.key, 'ui.theme');
      assert.equal(body.value, 'light');
      return { ok: true, json: async () => ({ saved: true, key: body.key, restart_required: false }) };
    }
    if (url === '/api/settings/export') {
      return { ok: true, json: async () => ({ schema_version: '1.0', settings: { 'ui.theme': 'light' } }) };
    }
    if (url === '/api/settings/import') {
      const body = JSON.parse(options.body);
      assert.ok(body.settings);
      return { ok: true, json: async () => ({ imported: 1 }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const client = new SanctumClient('test-token', fakeFetcher);

  const settings = await client.getSettings();
  assert.equal(settings['ui.theme'].value, 'dark');

  const setResult = await client.setSetting('ui.theme', 'light');
  assert.equal(setResult.saved, true);

  const exported = await client.exportSettings();
  assert.equal(exported.schema_version, '1.0');

  const imported = await client.importSettings({ 'ui.theme': 'dark' });
  assert.equal(imported.imported, 1);
});

test('SanctumClient manages packs via list, load, and unload', async () => {
  const fakeFetcher = async (url, options) => {
    if (url === '/api/pack/list') {
      return {
        ok: true,
        json: async () => [
          {
            id: 'voice_conversation',
            name: 'Voice Conversation',
            version: '0.1.0',
            state: 'installed',
            disk_bytes: 45000000,
            ram_budget_mb: 256,
            capabilities: ['voice'],
          },
        ],
      };
    }
    if (url === '/api/pack/load') {
      const body = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: body.id,
          name: 'Voice Conversation',
          version: '0.1.0',
          state: 'loaded',
          disk_bytes: 45000000,
          ram_budget_mb: 256,
          capabilities: ['voice'],
        }),
      };
    }
    if (url === '/api/pack/unload') {
      const body = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: body.id,
          name: 'Voice Conversation',
          version: '0.1.0',
          state: 'installed',
          disk_bytes: 45000000,
          ram_budget_mb: 256,
          capabilities: ['voice'],
        }),
      };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const client = new SanctumClient('test-token', fakeFetcher);

  const packs = await client.listPacks();
  assert.equal(packs.length, 1);
  assert.equal(packs[0].state, 'installed');

  const loaded = await client.loadPack('voice_conversation');
  assert.equal(loaded.state, 'loaded');

  const unloaded = await client.unloadPack('voice_conversation');
  assert.equal(unloaded.state, 'installed');
});
