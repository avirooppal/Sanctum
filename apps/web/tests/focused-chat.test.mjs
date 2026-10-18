import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChatComposer} from '../build/tests/ui/ChatComposer.js';
import {StatusBar} from '../build/tests/ui/StatusBar.js';
const props={prompt:'Hello',setPrompt:()=>{},onSend:()=>{},onStop:()=>{},busy:false,sendOnEnter:true};
test('focused-chat-composer keeps a compact writing surface',()=>{
 const html=renderToStaticMarkup(React.createElement(ChatComposer,props));
 assert.match(html,/chat-compose-surface/);assert.match(html,/aria-label="Message"/);
 assert(!html.includes('Enter to send (Shift+Enter for newline)</span>'));
 assert.match(html,/Send ↑/);
});
test('focused-chat-stop replaces send during a request',()=>{
 const html=renderToStaticMarkup(React.createElement(ChatComposer,{...props,busy:true}));
 assert.match(html,/Stop generation/);assert(!html.includes('Generating…'));
 assert(!html.includes('Send ↑'));
});
test('focused-chat-status discloses detailed diagnostics on demand',()=>{
 const html=renderToStaticMarkup(React.createElement(StatusBar,{conversation:'test',activeModel:'',models:[],onSelectModel:()=>{}}));
 assert.match(html,/<details class="runtime-details">/);
 assert.match(html,/aria-label="Runtime details"/);
 assert(!html.includes('<details class="runtime-details" open'));
});
