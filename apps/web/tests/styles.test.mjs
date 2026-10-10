import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildStyles} from '../tools/build-css.mjs';

test('core compiler preserves responsive and arbitrary-value application utilities', async () => {
  const css = await buildStyles('bg-[#163e32] md:grid-cols-[250px_1fr] tracking-[.18em] hover:bg-[#24513f]');
  assert(css.includes('#163e32'));
  assert(css.includes('250px 1fr'));
  assert(css.includes('.18em'));
  assert(css.includes('#24513f'));
  assert(css.includes('@media'));
});
