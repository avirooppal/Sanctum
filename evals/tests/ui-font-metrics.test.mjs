import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changedPixelFraction} from '../ui_font_metrics.mjs';

test('identical raster is zero and multiple changed channels count one pixel', () => {
  assert.equal(changedPixelFraction([0,0,0,255,0,0,0,255], [0,0,0,255,0,0,0,255]), 0);
  assert.equal(changedPixelFraction([0,0,0,255,0,0,0,255], [255,255,0,255,0,0,0,255]), 0.5);
});
test('unequal, empty and malformed raster inputs fail', () => {
  assert.throws(() => changedPixelFraction([], []));
  assert.throws(() => changedPixelFraction([0,0,0], [0,0,0]));
  assert.throws(() => changedPixelFraction([0,0,0,255], [0,0,0,255,0,0,0,255]));
  assert.throws(() => changedPixelFraction([NaN,0,0,255], [0,0,0,255]));
  assert.throws(() => changedPixelFraction([256,0,0,255], [0,0,0,255]));
  assert.throws(() => changedPixelFraction([-1,0,0,255], [0,0,0,255]));
  assert.throws(() => changedPixelFraction(['0',0,0,255], [0,0,0,255]));
});
