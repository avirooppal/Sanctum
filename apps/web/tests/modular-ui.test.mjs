import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  registerPanel,
  unregisterPanel,
  getPanel,
  getRegisteredPanels,
  filterPanelsByCapabilities,
  clearRegistry,
} from '../build/tests/ui/PanelRegistry.js';
import {
  validateThemeTokens,
  enforceContrastGuard,
  sanitizePreferences,
  DEFAULT_PREFERENCES,
  DEFAULT_SHORTCUTS,
} from '../build/tests/ui/Customization.js';
import { PanelErrorBoundary } from '../build/tests/ui/ErrorBoundary.js';
import { STRINGS } from '../build/tests/ui/strings.js';
import { SettingsModal } from '../build/tests/ui/SettingsModal.js';
import { DashboardPage } from '../build/tests/ui/DashboardPage.js';

test('PanelRegistry registers dummy panel and enforces capabilities filter', () => {
  clearRegistry();

  function DummyPanel() {
    return React.createElement('div', { id: 'dummy-panel' }, 'Dummy Content');
  }

  // Register dummy panel requiring "custom_hardware" capability
  registerPanel({
    id: 'dummy',
    title: 'Dummy Tool',
    icon: 'tool',
    allowedSlots: ['center', 'right'],
    requiredCapabilities: ['custom_hardware'],
    defaultVisibility: true,
    defaultSlot: 'center',
    component: DummyPanel,
  });

  const registered = getPanel('dummy');
  assert.ok(registered, 'Dummy panel should be registered');
  assert.equal(registered.title, 'Dummy Tool');

  // Verify capability gating
  const panelsWithoutCap = filterPanelsByCapabilities(['chat', 'knowledge']);
  assert.equal(panelsWithoutCap.some(p => p.id === 'dummy'), false, 'Dummy panel must be hidden when capability is missing');

  const panelsWithCap = filterPanelsByCapabilities(['chat', 'custom_hardware']);
  assert.equal(panelsWithCap.some(p => p.id === 'dummy'), true, 'Dummy panel must be visible when capability is present');

  // Clean up
  assert.equal(unregisterPanel('dummy'), true);
  assert.equal(getPanel('dummy'), undefined);
});

test('Custom theme validation accepts compliant JSON and rejects hostile or malformed tokens', () => {
  // Compliant theme
  const validTheme = {
    id: 'cyber_forest',
    name: 'Cyber Forest',
    colors: {
      background: '#0a100d',
      foreground: '#d6f5e3',
      card: '#121f19',
      primary: '#2dd4bf',
      border: '#1f382c',
    },
  };
  const validRes = validateThemeTokens(validTheme);
  assert.equal(validRes.valid, true, `Valid theme should pass: ${validRes.error}`);

  // Hostile: remote URL injection
  const hostileUrl = {
    id: 'evil_theme',
    name: 'Evil',
    colors: {
      background: 'url(https://malicious.origin/track.css)',
      foreground: '#ffffff',
      card: '#000000',
      primary: '#ff0000',
      border: '#222222',
    },
  };
  const hostileUrlRes = validateThemeTokens(hostileUrl);
  assert.equal(hostileUrlRes.valid, false, 'Theme with url() must be rejected');

  // Hostile: @import injection
  const hostileImport = {
    id: 'import_theme',
    name: 'Import',
    colors: {
      background: '@import "http://evil.com/font.css"',
      foreground: '#ffffff',
      card: '#000000',
      primary: '#ff0000',
      border: '#222222',
    },
  };
  assert.equal(validateThemeTokens(hostileImport).valid, false, 'Theme with @import must be rejected');

  // Hostile: script injection
  const hostileScript = {
    id: 'xss_theme',
    name: 'XSS',
    colors: {
      background: '#000000<script>alert(1)</script>',
      foreground: '#ffffff',
      card: '#000000',
      primary: '#ff0000',
      border: '#222222',
    },
  };
  assert.equal(validateThemeTokens(hostileScript).valid, false, 'Theme with script tag must be rejected');

  // Unknown property
  const unknownProp = {
    id: 'extra_keys',
    name: 'Extra',
    customCss: 'body { display: none; }',
    colors: { ...validTheme.colors },
  };
  assert.equal(validateThemeTokens(unknownProp).valid, false, 'Unknown top-level property must be rejected');
});

test('Contrast guard enforces WCAG AA contrast ratio and auto-adjusts failing colors', () => {
  // High contrast combination (white text on dark background)
  const highCheck = enforceContrastGuard('#ffffff', '#0f1412', 4.5);
  assert.equal(highCheck.compliant, true);
  assert.equal(highCheck.effectiveHex, '#ffffff');

  // Failing contrast: low contrast gray on dark background
  const lowCheck = enforceContrastGuard('#1e2924', '#0f1412', 4.5);
  assert.equal(lowCheck.compliant, false, 'Low contrast color must fail compliance check');
  assert.ok(lowCheck.effectiveHex !== '#1e2924', 'Effective color should be adjusted toward white');
  assert.ok(lowCheck.ratio >= 4.5, `Adjusted ratio (${lowCheck.ratio}) must satisfy WCAG AA >= 4.5:1`);
});

test('Preferences sanitizer migrates valid settings and recovers safely from corrupted data', () => {
  // Safe recovery on null/malformed input
  const { preferences: defaultRecovered, wasRecovered: wasNullRecovered } = sanitizePreferences(null);
  assert.equal(wasNullRecovered, true);
  assert.equal(defaultRecovered.theme, DEFAULT_PREFERENCES.theme);

  // Partial corrupted input
  const corrupted = {
    theme: 'sanctum',
    mode: 'invalid_mode_value',
    fontSizeScale: 999, // exceeds 125 limit
    density: 'super_compact', // invalid density
    accentColor: 'not_a_color',
  };
  const { preferences: fixed, wasRecovered } = sanitizePreferences(corrupted);
  assert.equal(wasRecovered, true);
  assert.equal(fixed.mode, DEFAULT_PREFERENCES.mode);
  assert.equal(fixed.fontSizeScale, 125, 'Out of bounds font scale clamped to 125');
  assert.equal(fixed.density, DEFAULT_PREFERENCES.density);
  assert.equal(fixed.accentColor, DEFAULT_PREFERENCES.accentColor);
});

test('PanelErrorBoundary catches render failures and renders accessible alert', () => {
  const boundary = new PanelErrorBoundary({
    panelId: 'test_crash_panel',
    panelTitle: 'Test Crash Panel',
    children: null,
  });
  boundary.state = { hasError: true, error: new Error('Simulated panel failure in test') };
  const rendered = boundary.render();
  const html = renderToString(rendered);

  assert.ok(html.includes('role="alert"'), 'Must render role="alert"');
  assert.ok(html.includes('Test Crash Panel'));
  assert.ok(html.includes('encountered an unexpected issue'));
  assert.ok(html.includes('Simulated panel failure in test'));
  assert.ok(html.includes('Reload'));

});


test('Centralized string table contains required top-level categories and non-empty strings', () => {
  assert.ok(STRINGS.app.name);
  assert.ok(STRINGS.onboarding.egressStatement.includes('Privacy Ledger unavailable'));
  assert.ok(!STRINGS.onboarding.egressStatement.includes('0 outbound connections'));
  assert.ok(STRINGS.settings.contrastPass);
  assert.ok(STRINGS.settings.profiles);
  assert.ok(STRINGS.settings.fullPurge);
  assert.ok(STRINGS.shell.presetQuad);
  assert.ok(STRINGS.tabs.quadPane);
  assert.ok(STRINGS.rightRail.artifacts);
  assert.ok(STRINGS.statusBar.offlineBadge);
  assert.ok(STRINGS.dashboard.status);
  assert.ok(STRINGS.errors.engineOfflineTitle);
  assert.ok(STRINGS.commandPalette.searchPlaceholder);
});

test('Layout engine presets and keyboard shortcuts match ADR 0069 specification', () => {
  assert.equal(DEFAULT_SHORTCUTS.toggle_sidebar, 'Ctrl+B');
  assert.equal(DEFAULT_SHORTCUTS.toggle_right_rail, 'Ctrl+J');
  assert.equal(DEFAULT_SHORTCUTS.cycle_tabs, 'Ctrl+Tab');
  assert.equal(DEFAULT_SHORTCUTS.close_tab, 'Ctrl+W');

  const layoutIds = DEFAULT_PREFERENCES.savedLayouts.map(l => l.id);
  assert.ok(layoutIds.includes('default'), 'Must register default layout');
  assert.ok(layoutIds.includes('focus'), 'Must register focus layout');
  assert.ok(layoutIds.includes('quad'), 'Must register quad layout');
  assert.ok(layoutIds.includes('console'), 'Must register console layout');

  assert.ok(DEFAULT_PREFERENCES.modelRoles, 'Must define modelRoles');
  assert.ok(DEFAULT_PREFERENCES.modelRoles.embeddings, 'Must allocate embeddings role');
  assert.ok(DEFAULT_PREFERENCES.modelRoles.reranker, 'Must allocate reranker role');
});

test('SettingsModal renders with all A7 specification tabs without throwing', () => {
  const el = React.createElement(SettingsModal, {
    isOpen: true,
    onClose: () => {},
    preferences: DEFAULT_PREFERENCES,
    onUpdatePreferences: () => {},
    onResetPreferences: () => {},
    conversationId: 'c-test',
    messages: [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ],
    capabilities: ['layouts', 'shortcut_customization'],
    models: [{ id: 'qwen2.5-coder-7b-instruct', context_length: 32768 }],
    thirdPartyNoticesText: 'MIT License',
  });
  const html = renderToString(el);
  assert.ok(html.includes(STRINGS.settings.title), 'Must render settings title');
  assert.ok(html.includes(STRINGS.settings.appearance.replace(/&/g, '&amp;')), 'Must render appearance tab');
  assert.ok(html.includes(STRINGS.settings.layouts), 'Must render layouts tab');
  assert.ok(html.includes(STRINGS.settings.shortcuts), 'Must render shortcuts tab');
  assert.ok(html.includes(STRINGS.settings.profiles), 'Must render profiles tab');
  assert.ok(html.includes(STRINGS.settings.models.replace(/&/g, '&amp;')), 'Must render models tab');
  assert.ok(html.includes(STRINGS.settings.data), 'Must render data tab');
  assert.ok(html.includes(STRINGS.settings.licenses.replace(/&/g, '&amp;')), 'Must render licenses tab');
  assert.ok(html.includes('WCAG AA'), 'Must render WCAG AA contrast guard info');
  const gated = renderToString(React.cloneElement(el, {capabilities: []}));
  assert.ok(!gated.includes(STRINGS.settings.layouts), 'Unbacked layout control must be hidden');
  assert.ok(!gated.includes(STRINGS.settings.shortcuts), 'Unbacked shortcut editor must be hidden');
});

test('DashboardPage renders routed Hermes-mirrored pages without throwing', () => {
  const dummyApi = {
    models: async () => [{ id: 'qwen3-0.6b', name: 'Qwen 3', capabilities: ['text'], context_length: 2048, license: 'Apache-2.0' }],
    sessions: async () => [{ id: 's-123', title: 'Test Session', pinned: true, updated_at: 1728000000 }],
  };

  // Status subpage
  const statusEl = React.createElement(DashboardPage, {
    token: 'tok-test',
    activeSubpage: 'status',
    onNavigateSubpage: () => {},
    onBackToWorkspace: () => {},
    api: dummyApi,
    activeModel: 'qwen3-0.6b',
  });
  const statusHtml = renderToString(statusEl);
  assert.ok(statusHtml.includes('Runtime Overview &amp; Status') || statusHtml.includes('Runtime Overview & Status'));
  assert.ok(statusHtml.includes('Active Model'));
  assert.ok(statusHtml.includes('Network Egress'));
  assert.ok(statusHtml.includes('Startup checks: unknown. Ledger unavailable.'));
  assert.ok(!statusHtml.includes('self-test passed'));
  assert.ok(!statusHtml.includes('Healthy · Localhost'));
  assert.ok(statusHtml.includes('Engine Dispatch Queues'));

  // Models subpage
  const modelsEl = React.createElement(DashboardPage, {
    token: 'tok-test',
    activeSubpage: 'models',
    onNavigateSubpage: () => {},
    onBackToWorkspace: () => {},
    api: dummyApi,
  });
  const modelsHtml = renderToString(modelsEl);
  assert.ok(modelsHtml.includes('Registered Local Models'));
  assert.ok(modelsHtml.includes('Discovered Models'));

  // Sessions subpage
  const sessionsEl = React.createElement(DashboardPage, {
    token: 'tok-test',
    activeSubpage: 'sessions',
    onNavigateSubpage: () => {},
    onBackToWorkspace: () => {},
    api: dummyApi,
  });
  const sessionsHtml = renderToString(sessionsEl);
  assert.ok(sessionsHtml.includes('Conversation Sessions'));
  assert.ok(sessionsHtml.includes('Saved Sessions'));

  // Resources subpage
  const resEl = React.createElement(DashboardPage, {
    token: 'tok-test',
    activeSubpage: 'resources',
    onNavigateSubpage: () => {},
    onBackToWorkspace: () => {},
    api: dummyApi,
  });
  const resHtml = renderToString(resEl);
  assert.ok(resHtml.includes('Engine Resources &amp; Queue Lanes') || resHtml.includes('Engine Resources & Queue Lanes'));
  assert.ok(resHtml.includes('Resident Engine RAM'));
  assert.ok(resHtml.includes('Unknown'));
  assert.ok(!resHtml.includes('Tier 1 CPU'));

  // Config subpage
  const cfgEl = React.createElement(DashboardPage, {
    token: 'tok-test',
    activeSubpage: 'config',
    onNavigateSubpage: () => {},
    onBackToWorkspace: () => {},
    api: dummyApi,
  });
  const cfgHtml = renderToString(cfgEl);
  assert.ok(cfgHtml.includes('Gateway Configuration'));
  assert.ok(cfgHtml.includes('127.0.0.1'));
  assert.ok(cfgHtml.includes('Startup checks: unknown. Ledger unavailable.'));
  assert.ok(!cfgHtml.includes('Default-Deny (Loopback Bound)'));

  // Licenses subpage
  const licEl = React.createElement(DashboardPage, {
    token: 'tok-test',
    activeSubpage: 'licenses',
    onNavigateSubpage: () => {},
    onBackToWorkspace: () => {},
    api: dummyApi,
    thirdPartyNoticesText: 'Permission is hereby granted, free of charge...',
  });
  const licHtml = renderToString(licEl);
  assert.ok(licHtml.includes('Third-Party Notices &amp; Licenses') || licHtml.includes('Third-Party Notices & Licenses'));
  assert.ok(licHtml.includes('Permission is hereby granted'));
});
