import test from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkspace} from '../build/tests/workspace-bootstrap.js';

test('workspace metadata is sequential and publishes only real capabilities',async()=>{
  const calls=[];let active=0;
  const response=(name,value)=>async()=>{
    calls.push(name);active++;assert.equal(active,1);
    await Promise.resolve();active--;return value;
  };
  const result=await loadWorkspace({
    capabilities:response('capabilities',{capabilities:['chat'],profile:'configured'}),
    models:response('models',[{id:'local',capabilities:['text']}]),
    preferences:response('preferences',null),
  },new AbortController().signal);
  assert.deepEqual(calls,['capabilities','models','preferences']);
  assert.deepEqual(result.capabilities.capabilities,['chat']);
});

test('failed discovery cannot fall back to enabled capabilities',async()=>{
  const failure=new Error('Discovery unavailable');
  await assert.rejects(loadWorkspace({
    capabilities:async()=>{throw failure;},
    models:async()=>assert.fail('must not run'),
    preferences:async()=>assert.fail('must not run'),
  },new AbortController().signal),failure);
});

test('cancellation between steps stops subsequent metadata requests',async()=>{
  const controller=new AbortController();
  await assert.rejects(loadWorkspace({
    capabilities:async()=>{controller.abort();return {capabilities:[],profile:'configured'};},
    models:async()=>assert.fail('cancelled bootstrap must stop'),
    preferences:async()=>assert.fail('cancelled bootstrap must stop'),
  },controller.signal),/abort/i);
});
