import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveMeeting} from '../build/tests/meeting.js';

const workspace = 'a'.repeat(32);
test('meeting save uses restricted same-origin authenticated request', async () => {
  let captured;
  const result = await saveMeeting('secret', workspace, 'Review', 'Alice will review it.', async (url, options) => {
    captured = {url, options};
    return Response.json({document:{id:'doc'},notes:{summary:'Review planned',action_items:[]}});
  });
  assert.equal(captured.url, `/v1/workspaces/${workspace}/meetings`);
  assert.equal(captured.options.headers.Authorization, 'Bearer secret');
  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.data_class, 'restricted');
  assert.deepEqual(payload.readers, []);
  assert.equal(payload.transcript, 'Alice will review it.');
  assert.equal(result.document.id, 'doc');
});
test('invalid workspace and oversized or blank input never send requests', async () => {
  const fetcher = () => { throw Error('unexpected network'); };
  for (const args of [['../escape','title','words'],[workspace,' ','words'],[workspace,'title','x'.repeat(6001)]]) {
    await assert.rejects(saveMeeting('key', ...args, fetcher), /workspace|title|transcript/i);
  }
});
test('failed writes are surfaced without retrying', async () => {
  let calls=0;
  await assert.rejects(saveMeeting('key',workspace,'title','words',async()=>{calls++;return Response.json({error:{message:'access denied'}},{status:403});}), /access denied/);
  assert.equal(calls,1);
});
