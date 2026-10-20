import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DARK_THEME,
  LIGHT_THEME,
  DENSITY_MULTIPLIERS,
  getContrastRatio,
  verifyWcagAA,
  resolvePalette,
} from '../build/tests/tokens.js';

test('Theme palettes declare all required semantic color tokens', () => {
  const requiredTokens = [
    'surface',
    'surfaceRaised',
    'surfaceHover',
    'border',
    'borderSubtle',
    'textPrimary',
    'textSecondary',
    'textTertiary',
    'textDisabled',
    'accent',
    'accentHover',
    'accentMuted',
    'danger',
    'success',
    'warning',
  ];

  for (const token of requiredTokens) {
    assert.ok(DARK_THEME[token], `DARK_THEME missing token: ${token}`);
    assert.ok(LIGHT_THEME[token], `LIGHT_THEME missing token: ${token}`);
  }
});

test('Contrast calculation satisfies WCAG 2.1 AA specifications', () => {
  // Black on white is approximately 21:1
  const blackWhite = getContrastRatio('#000000', '#ffffff');
  assert.ok(blackWhite >= 20.9 && blackWhite <= 21.1, `Expected ~21:1, got ${blackWhite}`);

  // Dark theme textPrimary on surface must exceed 4.5:1
  const darkContrast = getContrastRatio(DARK_THEME.textPrimary, DARK_THEME.surface);
  assert.ok(darkContrast >= 10.0, `Dark theme contrast too low: ${darkContrast}`);
  assert.equal(verifyWcagAA(DARK_THEME.textPrimary, DARK_THEME.surface), true);

  // Light theme textPrimary on surface must exceed 4.5:1
  const lightContrast = getContrastRatio(LIGHT_THEME.textPrimary, LIGHT_THEME.surface);
  assert.ok(lightContrast >= 10.0, `Light theme contrast too low: ${lightContrast}`);
  assert.equal(verifyWcagAA(LIGHT_THEME.textPrimary, LIGHT_THEME.surface), true);

  // Low contrast (e.g. #777777 on #666666) must fail
  assert.equal(verifyWcagAA('#777777', '#666666'), false);
});

test('Density multipliers match specification', () => {
  assert.equal(DENSITY_MULTIPLIERS.compact, 0.85);
  assert.equal(DENSITY_MULTIPLIERS.comfortable, 1.0);
  assert.equal(DENSITY_MULTIPLIERS.spacious, 1.15);
});

test('resolvePalette applies valid accent colors and rejects failing contrast', () => {
  const configWithGoodAccent = {
    mode: 'dark',
    density: 'comfortable',
    scaleFactor: 1.0,
    reducedMotion: false,
    accentColor: '#38bdf8', // high contrast on dark surface
  };
  const resolved = resolvePalette(configWithGoodAccent, true);
  assert.equal(resolved.accent, '#38bdf8');

  // Low contrast accent color on dark surface (e.g. dark navy #0a192f) must be rejected/ignored
  const configWithBadAccent = {
    mode: 'dark',
    density: 'comfortable',
    scaleFactor: 1.0,
    reducedMotion: false,
    accentColor: '#0a192f',
  };
  const fallbackResolved = resolvePalette(configWithBadAccent, true);
  assert.notEqual(fallbackResolved.accent, '#0a192f');
  assert.equal(fallbackResolved.accent, DARK_THEME.accent);
});
