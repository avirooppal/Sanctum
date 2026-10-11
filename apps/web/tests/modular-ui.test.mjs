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
} from '../build/tests/ui/Customization.js';
import { PanelErrorBoundary } from '../build/tests/ui/ErrorBoundary.js';
import { STRINGS } from '../build/tests/ui/strings.js';


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
  assert.ok(STRINGS.onboarding.egressStatement.includes('0 outbound connections'));
  assert.ok(STRINGS.settings.contrastPass);
  assert.ok(STRINGS.errors.engineOfflineTitle);
  assert.ok(STRINGS.commandPalette.searchPlaceholder);
});
