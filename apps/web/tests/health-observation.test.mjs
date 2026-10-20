import test from 'node:test';import assert from 'node:assert/strict';
import {observeHealth} from '../build/tests/health-observation.js';
const checks=Object.fromEntries(['host_fd_import','host_unix_socket','io_uring','ipv4_tcp','ipv4_udp','ipv6_tcp','ipv6_udp','namespace_change'].map(key=>[key,'denied']));
const health={status:'ok',cloud_connectors:'disabled',isolation:'linux-user-netns-seccomp',checks};
test('bounded same-origin read omits credentials and retains only parsed health',async()=>{
 let options;const data=await observeHealth(async(path,init)=>{assert.equal(path,'/healthz');options=init;return new Response(JSON.stringify(health),{headers:{'Content-Type':'application/json'}});});
 assert.deepEqual(data.health,health);assert(Number.isFinite(data.receivedAt));
 assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert(!options.headers);
});
test('failed,invalid,redirected and oversized responses become unknown',async()=>{
 for(const response of [new Response('{}',{status:503}),Response.redirect('https://foreign.invalid',302),new Response('broken',{headers:{'Content-Type':'application/json'}}),new Response('{}',{headers:{'Content-Type':'text/html'}}),new Response('x'.repeat(65537),{headers:{'Content-Type':'application/json'}})]){
  const value=await observeHealth(async()=>response);assert.deepEqual(value,{health:null,receivedAt:null});
 }
});
test('real observer deadline aborts a stalled transport',{timeout:7000},async()=>{
 let signal;const value=await observeHealth((_,options)=>new Promise((resolve,reject)=>{signal=options.signal;signal.addEventListener('abort',()=>reject(signal.reason),{once:true});}));
 assert(signal.aborted);assert.deepEqual(value,{health:null,receivedAt:null});
});
