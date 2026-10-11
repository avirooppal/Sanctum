import {test} from 'node:test';
import assert from 'node:assert/strict';
import {THEMES,themeTokens} from '../build/tests/ui/themes.js';

test('all pinned desktop and dashboard-only presets are available without upstream branding',()=>{
  for(const id of ['sanctum','github','catppuccin','everforest','solarized','sanctum-blue','classic',
    'midnight','ember','mono','slate','cyberpunk','teal','teal-large','rose','cream-blue']) assert(THEMES.some(t=>t.id===id));
  assert.equal(THEMES.length,16);
  for(const theme of THEMES)assert(!/hermes|nous/i.test(theme.label));
});
test('pinned canonical palette values and mode pairs are retained',()=>{
  const light=themeTokens('sanctum','light');const dark=themeTokens('sanctum','dark');
  assert.equal(light['--ui-background'],'#ffffff');
  assert.equal(light['--ui-accent'],'#0053fd');
  assert.equal(dark['--ui-background'],'#0d1117');
  assert.equal(themeTokens('teal','dark')['--ui-background'],'#041c1c');
  assert.equal(themeTokens('classic','light')['--ui-background'],'#F5F5F5');
  assert.equal(themeTokens('classic','dark')['--ui-background'],'#1a1a2e');
});
test('invalid IDs fail, tokens do not leak mutable palette references or remote URLs',()=>{
  assert.throws(()=>themeTokens('unregistered','light'));
  const before=themeTokens('sanctum','light');before['--ui-accent']='changed';
  assert.equal(themeTokens('sanctum','light')['--ui-accent'],'#0053fd');
  for(const theme of THEMES)for(const mode of ['light','dark']){
    const tokens=themeTokens(theme.id,mode);
    for(const key of ['primary','secondary','tertiary','disabled','on-accent'])assert(tokens[`--ui-text-${key}`]);
    assert(!/https?:|url\(/.test(JSON.stringify(tokens)));
  }
});
