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

test('docs site is offline, branded Sanctum, with local navigation and zero scripts/images',()=>{
  const html=readFileSync(new URL('../docs.html',import.meta.url),'utf8');
  assert.match(html,/<title>Sanctum Documentation/);
  assert.match(html,/href="\/website\.html"/);
  assert.match(html,/href="\/"/);
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    assert.match(match[1],/^(?:\/(?!\/)|#)/,'every docs asset and link is local');
  }
  assert.doesNotMatch(html,/<script|<iframe|<img|<form|onclick=|Hermes|Nous Portal/);
});

