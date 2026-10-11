import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('public website is offline, branded Sanctum, with honest setup links',()=>{
  const html=readFileSync(new URL('../website.html',import.meta.url),'utf8');
  assert.match(html,/<title>Sanctum/);
  assert.match(html,/Native Windows.*not yet available/s);
  assert.match(html,/Linux packages.*not yet available/s);
  assert.match(html,/href="\/"/);
  assert.match(html,/<details>/);
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    assert.match(match[1],/^(?:\/(?!\/)|#)/,'every asset and navigation is local');
  }
  assert.doesNotMatch(html,/<script|<iframe|<img|<form|onclick=|Hermes|Nous Portal/);
});
