import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {UnlockScreen} from '../build/tests/ui/UnlockScreen.js';
import {contrastRatio} from '../build/tests/ui/color.js';
import {themeTokens,accentTokens} from '../build/tests/ui/themes.js';

const props={value:'',busy:false,error:'',onChange:()=>{},onUnlock:()=>{},onReview:()=>{}};
test('locked screen has one primary action and no workspace chrome',()=>{
 const html=renderToStaticMarkup(React.createElement(UnlockScreen,props));
 assert.equal((html.match(/data-ui-button="primary"/g)||[]).length,1);
 assert.match(html,/>Unlock</);assert.match(html,/Local access key/);
 assert.match(html,/Where do I find my key/);assert.match(html,/Review local setup/);
 assert(!/app-shell|Your conversations|Preferences|Hermes|Nous|100%|zero.*telemetry|Paste local.token/i.test(html));
 assert.match(html,/<details/);assert.match(html,/type="password"/);
});
test('busy and blank keys disable submission;untrusted errors remain text',()=>{
 for(const value of ['', '   ']){
  const html=renderToStaticMarkup(React.createElement(UnlockScreen,{...props,value}));
  assert.match(html,/<button[^>]*disabled=""[^>]*type="submit"/);
 }
 const html=renderToStaticMarkup(React.createElement(UnlockScreen,{...props,value:'test',busy:true,error:'<img src=x onerror=alert(1)>'}));
 assert.match(html,/Unlocking/);assert.match(html,/role="alert"/);
 assert(!html.includes('<img'));assert.match(html,/&lt;img/);
});
test('setup review is isolated from workspace and has a secondary back action',()=>{
 const html=renderToStaticMarkup(React.createElement(UnlockScreen,{...props,wizard:React.createElement('p',{},'Actual setup slot'),onBack:()=>{}}));
 assert.match(html,/Actual setup slot/);assert.match(html,/Back to unlock/);
 assert(!html.includes('app-shell'));
});
test('custom accent recomputes foreground instead of inheriting white label ink',()=>{
 for(const id of ['sanctum','catppuccin','everforest'])for(const mode of ['light','dark']){
  const tokens=accentTokens(themeTokens(id,mode),'#48a87b');
  assert(contrastRatio(tokens['--ui-accent'],tokens['--ui-text-on-accent'])>=4.5);
  assert(contrastRatio(tokens['--ui-accent'],tokens['--ui-background'])>=4.5);
 }
});
