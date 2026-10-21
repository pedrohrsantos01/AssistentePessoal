import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProbeDatabase, fixtures } from '../src/store.ts';

test('commit, rollback/quota, undo/remark, isolation and stale owner preserve the same queue', async () => {
  const db = new ProbeDatabase(`atomic-${crypto.randomUUID()}`);
  try {
    await db.initialize();
    const lease = await db.claim(fixtures.a.account);
    const first = await db.toggle(lease, fixtures.a.habit);
    assert.match(first.operationId, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const committed = await db.read(lease.account);
    assert.equal(committed.projection.totalXp, 10);
    assert.equal(committed.projection.habits[0]?.done, true);
    assert.equal(committed.nextSequence, 2);
    await assert.rejects(db.toggle(lease, fixtures.a.habit, 'quota'), { name: 'QuotaExceededError' });
    assert.deepEqual(await db.read(lease.account), committed);
    const undo = await db.toggle(lease, fixtures.a.habit);
    assert.equal(undo.clientSequence, 2);
    assert.equal((await db.read(lease.account)).projection.totalXp, 0);
    const remark = await db.toggle(lease, fixtures.a.habit);
    assert.equal(remark.command.type, 'habit.mark');
    if (remark.command.type === 'habit.mark') assert.deepEqual(remark.command.observedUndoIds, [undo.operationId]);
    assert.equal((await db.read(lease.account)).projection.totalXp, 10);
    const other = await db.read(fixtures.b.account);
    assert.equal(other.pending.length, 0);
    assert.equal(other.projection.habits[0]?.habitId, fixtures.b.habit);
    const newOwner = await db.claim(fixtures.b.account);
    const beforeStale = await db.read(fixtures.a.account);
    await assert.rejects(db.toggle(lease, fixtures.a.habit), /stale_writer/);
    assert.deepEqual(await db.read(fixtures.a.account), beforeStale);
    await assert.rejects(db.toggle(newOwner, fixtures.a.habit), /habit_unavailable/);
    await db.toggle(newOwner, fixtures.b.habit);
    db.close();
    await db.open();
    assert.deepEqual((await db.read(fixtures.a.account)).pending.map(o => o.operationId), [first.operationId, undo.operationId, remark.operationId]);
  } finally { await db.delete(); }
});

test('failed V1→V2 migration preserves V1, then rebuilding projection preserves intentions', async () => {
  const name = `migration-${crypto.randomUUID()}`;
  const old = new ProbeDatabase(name, 1);
  await old.initialize();
  const legacyOperation = {
    operationId: '019abf00-0000-7000-8000-000000000077', deviceId: '019abf00-0000-7000-8000-000000000099',
    clientSequence: 1, occurredAt: '2026-10-21T12:00:00Z', dependsOn: [],
    command: { type: 'habit.mark' as const, habitId: fixtures.a.habit, dayKey: '2026-10-21', timeContext: { timezone: 'America/Sao_Paulo', dayStartHour: 4 }, observedUndoIds: [] },
  };
  await old.sync_mutations.add({ account_id: fixtures.a.account, operation_id: legacyOperation.operationId, device_id: legacyOperation.deviceId, client_sequence: 1, envelope: legacyOperation, status: 'pending' });
  await old.sync_state.put({ account_id: fixtures.a.account, next_sequence: 2 });
  const original = await old.canonical_entities.toArray();
  const originalPending = await old.sync_mutations.toArray();
  old.close();
  const failed = new ProbeDatabase(name, 2, true);
  await assert.rejects(failed.open(), /synthetic_migration_failure/);
  failed.close();
  await old.open();
  assert.equal(old.verno, 1);
  assert.deepEqual(await old.canonical_entities.toArray(), original);
  assert.deepEqual(await old.sync_mutations.toArray(), originalPending);
  assert.equal((await old.sync_state.get(fixtures.a.account))?.next_sequence, 2);
  old.close();
  const upgraded = new ProbeDatabase(name);
  try {
    await upgraded.open();
    assert.equal((await upgraded.read(fixtures.a.account)).projection.habits[0]?.title, fixtures.a.title);
    const migrated = await upgraded.read(fixtures.a.account);
    assert.equal(migrated.nextSequence, 2);
    assert.deepEqual(migrated.pending, [legacyOperation]);
    assert.equal(migrated.projection.habits[0]?.done, true);
    assert.equal(migrated.projection.totalXp, 10);
  } finally { await upgraded.delete(); }
});
