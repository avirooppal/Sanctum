import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChatRun} from '../build/tests/chat-run.js';

test('stop aborts the admitted run, suppresses late output and never retries', async()=>{
  const run=new ChatRun();let signal,release,calls=0;const output=[];
  const pending=run.start(async function*(s){calls++;signal=s;yield 'first';
    await new Promise(resolve=>{release=resolve;});yield 'late';},x=>output.push(x));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(run.active,true);run.stop();run.stop();assert.equal(signal.aborted,true);
  release();assert.equal(await pending,'stopped');assert.deepEqual(output,['first']);
  assert.equal(calls,1);assert.equal(run.active,false);
});

test('overlapping starts are refused; an explicit next run has a fresh signal', async()=>{
  const run=new ChatRun();let release;
  const pending=run.start(async function*(){await new Promise(resolve=>{release=resolve;});yield 'old';},()=>{});
  await assert.rejects(run.start(async function*(){yield 'overlap';},()=>{}),/already active/);
  run.stop();release();await pending;
  const output=[];
  assert.equal(await run.start(async function*(signal){assert.equal(signal.aborted,false);yield 'new';},x=>output.push(x)),'complete');
  assert.deepEqual(output,['new']);
});

test('abort rejection is stopped but real engine failures are preserved', async()=>{
  const run=new ChatRun();
  const pending=run.start(async function*(signal){await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));yield 'unreachable';},()=>{});
  run.stop();assert.equal(await pending,'stopped');
  await assert.rejects(run.start(async function*(){throw Error('engine failed');},()=>{}),/engine failed/);
  assert.equal(run.active,false);
});
