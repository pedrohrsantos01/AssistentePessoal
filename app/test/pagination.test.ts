import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestStore} from './support/store.ts';
import {HttpSync,synchronize} from '../src/core/sync/synchronize.ts';
import {id,at,day,command} from './support/scheduler.ts';

for(const fault of ['changed cut','cursor cycle'] as const) test('pull refuses '+fault+' and retains the last committed page and pending work',async t=>{
  const store=openTestStore(':memory:',id(1),id(2));const pending=store.enqueue(command,id(4),at);let pages=0;
  store.applyPull({changes:[],nextCursor:'initial-pull-cursor',hasMore:false,highWaterRevision:'0',serverTime:at});
  t.mock.method(globalThis,'fetch',async()=>{
    if(++pages>2) throw new Error('unbounded_or_unexpected_request');
    const revision=pages===1?'1':'2';
    return Response.json({changes:[{revision,operationResults:[{operationId:id(80+pages),status:'accepted',acceptedRevision:revision}],entities:[]}],
      highWaterRevision:pages===2&&fault==='changed cut'?'3':'2',hasMore:pages===1||fault==='cursor cycle',
      nextCursor:pages===1||fault==='cursor cycle'?'first-pull-cursor':'second-pull-cursor',serverTime:at});
  });
  try {
    await assert.rejects(synchronize(store,new HttpSync('https://sync.test',id(1),()=> 'fixture-token',()=>id(99))),/pull_mismatch/);
    assert.equal(store.cursor(),'first-pull-cursor');assert.deepEqual(store.operations(),[pending]);
    assert.equal(store.view(day).habits[0]?.title,'Caminhar');
  } finally {store.close();}
});
