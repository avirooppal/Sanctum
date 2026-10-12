import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Button,Input,Card,Dialog} from '../build/tests/ui/primitives.js';
import {AppShell} from '../build/tests/ui/AppShell.js';

test('native button defaults to non-submit, preserves explicit submit and disabled',()=>{
  assert.match(renderToStaticMarkup(React.createElement(Button,{},'Open')),/type="button"/);
  const submit=renderToStaticMarkup(React.createElement(Button,{type:'submit',disabled:true},'Send'));
  assert.match(submit,/type="submit"/);assert.match(submit,/disabled=""/);
});
test('untrusted titles and field text remain escaped React text',()=>{
  const payload='<img src="https://foreign.test" onerror="alert(1)">';
  const card=renderToStaticMarkup(React.createElement(Card,{title:payload},payload));
  assert(!card.includes('<img'));assert(card.includes('&lt;img'));
  const field=renderToStaticMarkup(React.createElement(Input,{'aria-label':'Owner key',type:'password',value:payload,onChange:()=>{}}));
  assert.match(field,/aria-label="Owner key"/);assert(!field.includes('<img'));
});
test('dialog has a named native modal and escaped children without an injected close link',()=>{
  const dialog=renderToStaticMarkup(React.createElement(Dialog,{open:false,title:'Licenses',onClose:()=>{}},'<script>run()</script>'));
  assert.match(dialog,/<dialog/);assert.match(dialog,/aria-labelledby=/);
  assert.match(dialog,/Close Licenses/);assert(!dialog.includes('<script>'));
});
test('shell has one sidebar and main with explicitly connected native navigation control',()=>{
  const shell=renderToStaticMarkup(React.createElement(AppShell,{sidebar:'History',header:'Chat'},'Owner content'));
  assert.equal((shell.match(/<aside/g)||[]).length,1);
  assert.equal((shell.match(/<main/g)||[]).length,1);
  assert.match(shell,/aria-controls="sanctum-navigation"/);
  assert(shell.includes('Owner content'));
  assert(!/portal|electron|iframe/i.test(shell));
});

test('primitives CSS enforces 180ms motion and 44px coarse pointer touch target', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const css = fs.readFileSync(path.resolve('src/ui/primitives.css'), 'utf8');
  assert.ok(css.includes('180ms ease-out'), 'Must use 150-200ms ease-out motion');
  assert.ok(css.includes('pointer: coarse'), 'Must define touch target styles for coarse pointers');
  assert.ok(css.includes('min-height: 44px'), 'Must meet 44px touch target minimum');
  assert.ok(css.includes('prefers-reduced-motion'), 'Must honor prefers-reduced-motion');
});
