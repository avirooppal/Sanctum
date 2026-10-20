import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, t } from '../build/tests/strings.js';

test('String table declares all required UI microcopy keys', () => {
  assert.equal(typeof STRINGS.nav_chat, 'string');
  assert.equal(typeof STRINGS.tier_verified_containment, 'string');
  assert.equal(typeof STRINGS.tier_not_verified, 'string');
  assert.equal(typeof STRINGS.composer_placeholder, 'string');
});

test('t() helper retrieves correct string value and falls back to key if unknown', () => {
  assert.equal(t('nav_chat'), 'Chat');
  assert.equal(t('action_send'), 'Send');
  assert.equal(t('tier_verified_containment'), 'verified kernel containment');
  // @ts-expect-error test unknown key
  assert.equal(t('nonexistent_key'), 'nonexistent_key');
});
