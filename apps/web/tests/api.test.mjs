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
  await assert.rejects(client.models(),error=>error.status===503&&/local engine is busy/.test(error.message));
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

test('session management uses owner-authenticated fixed paths and validates pages',async()=>{
 const calls=[];const client=new SanctumClient('owner',async(path,options)=>{calls.push({path,options});return Response.json(JSON.parse(options.body).operation==='list'?{data:[{id:'one',title:'<img src=x>',pinned:false}],has_more:false}:{changed:true});});
 assert.deepEqual(await client.sessions('query',0),{data:[{id:'one',title:'<img src=x>',pinned:false}],has_more:false});
 await client.renameSession('one','Renamed');await client.deleteSession('one');await client.pinSession('one',true);
 assert(calls.every(c=>c.path==='/v1/sessions'&&c.options.method==='POST'&&c.options.headers.Authorization==='Bearer owner'));
 assert.deepEqual(calls.map(c=>JSON.parse(c.options.body).operation),['list','rename','delete','pin']);
});
test('session mutations never retry and malformed lists are rejected',async()=>{
 let calls=0;const client=new SanctumClient('owner',async()=>{calls++;return new Response('{}',{status:503});});
 await assert.rejects(client.deleteSession('one'),error=>error.status===503&&/local engine is busy/.test(error.message));assert.equal(calls,1);
 const malformed=new SanctumClient('owner',async()=>Response.json({data:[{id:'one',title:12}],has_more:false}));
 await assert.rejects(malformed.sessions('',0),/Invalid session/);
});

test('capabilities and preferences endpoints validate payload and authenticate owner', async () => {
  const calls = [];
  const client = new SanctumClient('owner-token', async (path, options) => {
    calls.push({ path, options });
    if (path === '/v1/capabilities') {
      return Response.json({ capabilities: ['chat', 'knowledge', 'speech'], profile: 'default' });
    }
    if (path === '/v1/preferences' && options.method === 'GET') {
      return Response.json({ preferences: { theme: 'sanctum', density: 'compact' } });
    }
    if (path === '/v1/preferences' && options.method === 'POST') {
      return Response.json({ status: 'saved' });
    }
    return new Response('{}', { status: 404 });
  });

  const caps = await client.capabilities();
  assert.deepEqual(caps.capabilities, ['chat', 'knowledge', 'speech']);

  const prefs = await client.preferences();
  assert.equal(prefs?.theme, 'sanctum');

  await client.savePreferences({ theme: 'github', density: 'spacious' });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].path, '/v1/preferences');
  assert.equal(calls[2].options.method, 'POST');
  assert.equal(calls[2].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[2].options.headers['Authorization'], 'Bearer owner-token');
});

test('profiles and full purge endpoints authenticate owner and reject invalid payloads', async () => {
  const calls = [];
  const client = new SanctumClient('owner-token', async (path, options) => {
    calls.push({ path, options });
    if (path === '/v1/profiles' && options.method === 'GET') {
      return Response.json({ data: [{ id: 'p1', name: 'Researcher', system_prompt: 'Be concise', scope: 'global' }] });
    }
    if (path === '/v1/profiles' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      if (body.operation === 'delete') {
        return Response.json({ deleted: true });
      }
      return Response.json({ saved: true, id: body.id || 'p2' });
    }
    if (path === '/v1/purge' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      if (body.confirm === 'PURGE ALL SANCTUM DATA') {
        return Response.json({ purged: true });
      }
      return new Response('{"error": "Invalid confirm"}', { status: 400 });
    }
    return new Response('{}', { status: 404 });
  });

  const profs = await client.profiles();
  assert.equal(profs.length, 1);
  assert.equal(profs[0].name, 'Researcher');

  const savedId = await client.saveProfile({ name: 'Writer', system_prompt: 'Draft well', scope: 'session' });
  assert.equal(savedId, 'p2');

  await client.deleteProfile('p1');
  assert.equal(calls[2].path, '/v1/profiles');
  assert.equal(JSON.parse(calls[2].options.body).operation, 'delete');

  await client.fullPurge('PURGE ALL SANCTUM DATA');
  assert.equal(calls[3].path, '/v1/purge');

  await assert.rejects(client.fullPurge('wrong'), error => error.status === 400 && error.message === 'This request could not be accepted. Review the highlighted fields.');
});
