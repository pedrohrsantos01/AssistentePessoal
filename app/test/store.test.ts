import SQLite from 'better-sqlite3';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openTestStore } from './support/store.ts';

test('an offline habit and its marking survive closing and reopening the account store', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ritmo-'));
  const path = join(directory, 'account.db');
  const account = '01996300-0000-7000-8000-000000000001';
  const device = '01996300-0000-7000-8000-000000000002';
  const habit = '01996300-0000-7000-8000-000000000003';
  let store = openTestStore(path, account, device);
  try {
    store.enqueue({type:'habit.create', habitId:habit, title:'Caminhar', habitType:'binary',
      scheduleKind:'daily', startDayKey:'2026-09-25',
      timeContext:{timezone:'America/Sao_Paulo',dayStartHour:4},iconKey:null,colorToken:null,sortOrder:0},
      '01996300-0000-7000-8000-000000000004', '2026-09-25T13:00:00Z');
    store.enqueue({type:'habit.mark',habitId:habit,dayKey:'2026-09-25',
      timeContext:{timezone:'America/Sao_Paulo',dayStartHour:4},observedUndoIds:[]},
      '01996300-0000-7000-8000-000000000005', '2026-09-25T13:01:00Z');
    store.close();
    store = openTestStore(path, account, device);
    assert.deepEqual(store.view('2026-09-25'), {
      habits:[{habitId:habit,title:'Caminhar',done:true}],totalXp:10,pendingCount:2,rejectedCount:0,
    });
  } finally {
    store.close();
    rmSync(directory, {recursive:true,force:true});
  }
});

test('opening an existing account database as another account is refused without deleting pending work', () => {
  const directory=mkdtempSync(join(tmpdir(),'ritmo-isolation-'));
  const path=join(directory,'account.db');
  const a='01996300-0000-7000-8000-000000000001';
  const b='01996300-0000-7000-8000-000000000099';
  const device='01996300-0000-7000-8000-000000000002';
  const store=openTestStore(path,a,device);
  store.close();
  try { assert.throws(()=>openTestStore(path,b,device),/account_store_mismatch/); }
  finally { rmSync(directory,{recursive:true,force:true}); }
});


test('a failed projection write rolls back the offline intent and its allocated sequence',()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-rollback-'));
  const path=join(directory,'account.db');
  const store=openTestStore(path,'01996300-0000-7000-8000-000000000001','01996300-0000-7000-8000-000000000002');
  const fault=new SQLite(path);
  const command={type:'habit.create',habitId:'01996300-0000-7000-8000-000000000003',title:'Caminhar',habitType:'binary',scheduleKind:'daily',startDayKey:'2026-09-25',timeContext:{timezone:'America/Sao_Paulo',dayStartHour:4},iconKey:null,colorToken:null,sortOrder:0} as const;
  try {
    fault.exec("CREATE TRIGGER fail_projection BEFORE INSERT ON projected_views BEGIN SELECT RAISE(ABORT,'test_projection_failure'); END");
    assert.throws(()=>store.enqueue(command,'01996300-0000-7000-8000-000000000004','2026-09-25T13:00:00Z'));
    assert.deepEqual(store.view('2026-09-25'),{habits:[],totalXp:0,pendingCount:0,rejectedCount:0});
    fault.exec('DROP TRIGGER fail_projection');
    const retry=store.enqueue(command,'01996300-0000-7000-8000-000000000004','2026-09-25T13:00:00Z');
    assert.equal(retry.clientSequence,1);
    assert.equal(store.view('2026-09-25').pendingCount,1);
  } finally {fault.close();store.close();rmSync(directory,{recursive:true,force:true});}
});
