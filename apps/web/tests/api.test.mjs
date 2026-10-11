import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SanctumClient} from '../build/tests/api.js';

test('Knowledge uses authenticated fixed paths and owner-only restricted uploads', async()=>{
  const calls=[];
  const client=new SanctumClient('owner',async(path,options)=>{
    calls.push({path,options});
    if(path==='/v1/workspaces'&&options.method==='GET')return Response.json({data:[{id:'w',name:'Private'}]});
    return Response.json({id:'document'});
  });
  assert.deepEqual(await client.workspaces(),[{id:'w',name:'Private'}]);
  assert.equal(await client.createWorkspace('Private'),'document');
  assert.equal(await client.uploadDocument('w/x','notes.md',new TextEncoder().encode('private')),'document');
  assert.equal(calls[2].path,'/v1/workspaces/w%2Fx/documents');
  const body=JSON.parse(calls[2].options.body);
  assert.deepEqual(body.readers,[]);assert.equal(body.data_class,'restricted');
  assert.equal(atob(body.content_base64),'private');
  assert(calls.every(c=>c.options.credentials==='omit'&&c.options.redirect==='error'));
});

test('Knowledge validates answers and rejects unsupported uploads before sending',async()=>{
  let calls=0;
  const client=new SanctumClient('owner',async()=>{calls++;return Response.json({answer:'x',abstained:false,citations:[{source:42}]});});
  await assert.rejects(client.askKnowledge('w','q'),/Invalid Knowledge/);
  await assert.rejects(client.uploadDocument('w','image.png',new Uint8Array(1)),/Markdown|PDF/);
  await assert.rejects(client.uploadDocument('w','large.md',new Uint8Array(10*1024*1024+1)),/10 MiB/);
  assert.equal(calls,1);
});

test('default fetch retains the Window/global receiver', async () => {
  const previous=globalThis.fetch;
  globalThis.fetch=async function(){
    assert.equal(this,globalThis);return Response.json({data:[]});
  };
  try {assert.deepEqual(await new SanctumClient('owner').models(),[]);}
  finally {globalThis.fetch=previous;}
});

test('fixed same-origin requests omit cookies, reject redirects and never retry', async () => {
  const calls=[];
  const client=new SanctumClient('owner',async (path,options)=>{
    calls.push({path,options}); return new Response('{}',{status:503});
  });
  await assert.rejects(client.models(),/503/);
  assert.equal(calls.length,1);
  assert.equal(calls[0].path,'/v1/models');
  assert.equal(calls[0].options.credentials,'omit');
  assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[0].options.cache,'no-store');
  assert.equal(calls[0].options.headers.Authorization,'Bearer owner');
});
test('models are validated and conversation IDs cannot change origin or path structure', async () => {
  const paths=[];
  const client=new SanctumClient('owner',async path=>{
    paths.push(path); return Response.json({data:[]});
  });
  assert.deepEqual(await client.models(),[]);
  await client.turns('https://foreign.test/a?b');
  assert.equal(paths[1],'/v1/conversations/https%3A%2F%2Fforeign.test%2Fa%3Fb');
  const invalid=new SanctumClient('owner',async()=>Response.json({data:[{id:5}]}));
  await assert.rejects(invalid.models(),/model response/);
});
test('stream decodes split Unicode and SSE lines without fabricated text', async () => {
  const bytes=new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n');
  const client=new SanctumClient('owner',async()=>new Response(new ReadableStream({
    start(controller){for(const byte of bytes)controller.enqueue(Uint8Array.of(byte));controller.close();}
  })));
  const deltas=[];
  for await(const delta of client.chat('model',[], 'conversation'))deltas.push(delta);
  assert.equal(deltas.join(''),'你好');
});
test('consumer cancellation releases stream and ignored fetch abort cannot yield stale text', async () => {
  let canceled=false;
  const client=new SanctumClient('owner',async()=>new Response(new ReadableStream({
    start(c){c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"one"}}]}\n\n'));},
    cancel(){canceled=true;}
  })));
  for await(const delta of client.chat('model',[], 'conversation')) {assert.equal(delta,'one');break;}
  assert(canceled);
  const signal=new AbortController(); signal.abort();
  await assert.rejects(async()=>{for await(const delta of client.chat('model',[],'conversation',signal.signal))assert.fail(delta);},/abort/i);
});
test('ticket is in subprotocol only and abort closes the socket', async () => {
  let request,connection;
  const client=new SanctumClient('owner',async(path,options)=>{
    request={path,options}; return Response.json({ticket:'a'.repeat(64),expires_in:30,protocol:'sanctum.realtime.v1'});
  },'https://sanctum.test');
  const cancel=new AbortController();
  const socket=await client.realtime((url,protocols)=>{
    connection={url,protocols};return {close(){connection.closed=true;},addEventListener(){}};
  },cancel.signal);
  assert(socket);
  assert.equal(request.path,'/v1/realtime/tickets');
  assert.equal(request.options.body,undefined);
  assert.equal(connection.url,'wss://sanctum.test/v1/realtime');
  assert.deepEqual(connection.protocols,['sanctum.realtime.v1','ticket.'+'a'.repeat(64)]);
  cancel.abort();assert(connection.closed);
});
test('invalid ticket and cancellation after ticket never open a socket', async () => {
  const canceled=new AbortController();
  const client=new SanctumClient('owner',async()=>{canceled.abort();return Response.json({ticket:'a'.repeat(64),expires_in:30,protocol:'sanctum.realtime.v1'});});
  await assert.rejects(client.realtime(()=>assert.fail('must not connect'),canceled.signal),/abort/i);
  const invalid=new SanctumClient('owner',async()=>Response.json({ticket:'token?query',protocol:'other'}));
  await assert.rejects(invalid.realtime(()=>assert.fail('must not connect')),/ticket response/);
});
test('abort while waiting for a stalled stream releases the reader', {timeout:2000}, async () => {
  let canceled=false;
  const signal=new AbortController();
  const client=new SanctumClient('owner',async()=>new Response(new ReadableStream({
    cancel(){canceled=true;}
  })));
  const waiting=client.chat('model',[],'conversation',signal.signal).next();
  await new Promise(resolve=>setImmediate(resolve));
  signal.abort();
  await assert.rejects(waiting,/abort/i);
  assert(canceled);
});
