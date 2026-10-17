import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {privacyMessage,userError,GatewayError} from '../build/tests/runtime-truth.js';
import {SetupWizard} from '../build/tests/SetupWizard.js';
import {sanitizePreferences,DEFAULT_PREFERENCES} from '../build/tests/ui/Customization.js';

test('privacy badge cannot turn absent or partial health into egress-history proof',()=>{
  const unknown='Startup checks: unknown. Ledger unavailable.';
  assert.equal(privacyMessage(null),unknown);
  assert.equal(privacyMessage({status:'ok',checks:{ipv4_tcp:'denied'}}),unknown);
  const checks=Object.fromEntries(['host_fd_import','host_unix_socket','io_uring','ipv4_tcp',
    'ipv4_udp','ipv6_tcp','ipv6_udp','namespace_change'].map(key=>[key,'denied']));
  const health={status:'ok',cloud_connectors:'disabled',isolation:'linux-user-netns-seccomp',checks};
  assert.equal(privacyMessage(health),'Startup denial checks passed. Ledger unavailable.');
  assert.equal(privacyMessage({...health,checks:{...checks,ipv4_tcp:'allowed'}}),unknown);
  assert.equal(privacyMessage({...health,status:'offline'}),unknown);
});

test('unknown provider errors cannot leak raw content and busy errors retain metadata',()=>{
  const credential='sk-'+'or-v1-'+'b'.repeat(64);
  assert.equal(userError(new Error('Provider stack '+credential)),
    'Sanctum could not finish this operation. Your request was not retried automatically.');
  const error=new GatewayError(503,'1');
  assert.equal(error.status,503);assert.equal(error.retryAfter,1);
  assert.match(userError(error),/local engine is busy/);
  assert.match(userError(error),/Retry after 1 seconds/);
  assert.equal(new GatewayError(503,'not-a-number').retryAfter,null);
});

test('setup cannot fabricate hardware, model verification or an owner key',()=>{
  const html=renderToStaticMarkup(React.createElement(SetupWizard,{onComplete:()=>assert.fail()}));
  assert(!html.includes('Tier 1'));assert(!html.includes('Fits 7B'));
  assert(!html.includes('sanctum-local-owner'));assert(!html.includes('Auto-Detect Available'));
  assert(html.includes('Local access key'));assert(html.includes('Check local runtime'));
  assert(html.includes('Unknown'));
});

test('unregistered preference themes recover to an admitted local preset',()=>{
  const result=sanitizePreferences({...DEFAULT_PREFERENCES,theme:'not-an-admitted-preset'});
  assert.equal(result.preferences.theme,DEFAULT_PREFERENCES.theme);
  assert.equal(result.wasRecovered,true);
});
