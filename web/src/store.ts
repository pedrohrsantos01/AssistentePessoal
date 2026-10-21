import Dexie, { type Table } from 'dexie';
import { project } from '../../app/src/features/habits/domain/project.ts';
import { entityKey, type Entity, type Operation } from '../../app/src/core/sync/protocol.ts';

export const day = '2026-10-21';
export const timeContext = { timezone: 'America/Sao_Paulo', dayStartHour: 4 };
export const fixtures = {
  a: { account: '019abf00-0000-7000-8000-000000000001', habit: '019abf00-0000-7000-8000-000000000011', title: 'Beber água' },
  b: { account: '019abf00-0000-7000-8000-000000000002', habit: '019abf00-0000-7000-8000-000000000012', title: 'Ler um capítulo' },
} as const;
export const deviceId = '019abf00-0000-7000-8000-000000000099';
type Projection = ReturnType<typeof project>;
type Control = { singleton: number; device_id: string; selected_account_id: string | null; session_generation: number };
type State = { account_id: string; next_sequence: number };
type Canonical = { account_id: string; kind: Entity['kind']; entity_key: string; revision: string; payload: Entity };
type Mutation = { account_id: string; operation_id: string; device_id: string; client_sequence: number; envelope: Operation; status: 'pending' };
type View = { account_id: string; kind: 'habit' | 'xp'; entity_key: string; payload: Projection['habits'][number] | { totalXp: number } };
export type Lease = { account: string; generation: number };
export type Failure = 'none' | 'quota';

export class ProbeDatabase extends Dexie {
  declare installation_control: Table<Control, number>;
  declare sync_state: Table<State, string>;
  declare canonical_entities: Table<Canonical, [string, string, string]>;
  declare sync_mutations: Table<Mutation, [string, string]>;
  declare projected_views: Table<View, [string, string, string]>;

  constructor(name = 'ritmo-synthetic-probe', version: 1 | 2 = 2, failMigration = false) {
    super(name);
    this.version(1).stores({
      installation_control: 'singleton', sync_state: 'account_id',
      canonical_entities: '[account_id+kind+entity_key],account_id',
      sync_mutations: '[account_id+operation_id],&[account_id+device_id+client_sequence],account_id',
    });
    if (version === 2) this.version(2).stores({
      projected_views: '[account_id+kind+entity_key],account_id',
    }).upgrade(async tx => {
      for (const state of await tx.table<State>('sync_state').toArray()) {
        const entities = await tx.table<Canonical>('canonical_entities').where('account_id').equals(state.account_id).toArray();
        const pending = await tx.table<Mutation>('sync_mutations').where('account_id').equals(state.account_id).toArray();
        await saveViews(tx.table<View>('projected_views'), state.account_id, project(entities.map(e => e.payload), ordered(pending), day));
      }
      if (failMigration) throw new Error('synthetic_migration_failure');
    });
  }

  async initialize() {
    // Idempotent seed, including concurrent tab startup. Never resets existing rows.
    await this.transaction('rw', this.tables, async () => {
      if (await this.installation_control.get(1)) return;
      await this.installation_control.add({ singleton: 1, device_id: deviceId, selected_account_id: null, session_generation: 0 });
      for (const fixture of Object.values(fixtures)) {
        const entity: Entity = { kind: 'habit', value: {
          habitId: fixture.habit, title: fixture.title, habitType: 'binary', scheduleKind: 'daily',
          startDayKey: day, iconKey: 'habits', colorToken: 'accent', sortOrder: 0,
          creationTimeContext: timeContext, createdAt: `${day}T12:00:00Z`, updatedAt: `${day}T12:00:00Z`, deletedAt: null, revision: '1',
        } };
        await this.canonical_entities.add({ account_id: fixture.account, kind: entity.kind, entity_key: entityKey(entity), revision: '1', payload: entity });
        await this.sync_state.add({ account_id: fixture.account, next_sequence: 1 });
        if (this.verno === 2) await saveViews(this.projected_views, fixture.account, project([entity], [], day));
      }
    });
  }

  async claim(account: string): Promise<Lease> {
    requireFixture(account);
    return this.transaction('rw', this.installation_control, async () => {
      const current = await this.installation_control.get(1);
      if (!current || !Number.isSafeInteger(current.session_generation + 1)) throw new Error('control_unavailable');
      const generation = current.session_generation + 1;
      await this.installation_control.put({ ...current, selected_account_id: account, session_generation: generation });
      return { account, generation };
    });
  }

  async toggle(lease: Lease, habitId: string, failure: Failure = 'none') {
    requireFixture(lease.account);
    // Crypto and the clock are evaluated before entering the IndexedDB transaction.
    const operationId = uuid7(), occurredAt = new Date().toISOString();
    return this.transaction('rw', this.tables, async () => {
      const control = await this.installation_control.get(1);
      if (control?.session_generation !== lease.generation || control.selected_account_id !== lease.account) throw new Error('stale_writer');
      const state = await this.sync_state.get(lease.account);
      if (!state || !Number.isSafeInteger(state.next_sequence + 1)) throw new Error('sequence_unavailable');
      const entities = await this.canonical_entities.where('account_id').equals(lease.account).toArray();
      const pending = await this.sync_mutations.where('account_id').equals(lease.account).toArray();
      const operations = ordered(pending);
      const current = project(entities.map(e => e.payload), operations, day);
      const habit = current.habits.find(h => h.habitId === habitId);
      if (!habit) throw new Error('habit_unavailable');
      const operation: Operation = {
        operationId, deviceId: control.device_id, clientSequence: state.next_sequence, occurredAt, dependsOn: [],
        command: habit.done ? { type: 'habit.unmark', habitId, dayKey: day, timeContext }
          : { type: 'habit.mark', habitId, dayKey: day, timeContext, observedUndoIds: operations.filter(o => o.command.type === 'habit.unmark' && o.command.habitId === habitId).map(o => o.operationId) },
      };
      await this.sync_mutations.add({ account_id: lease.account, operation_id: operationId, device_id: control.device_id, client_sequence: state.next_sequence, envelope: operation, status: 'pending' });
      if (failure === 'quota') throw new DOMException('synthetic_quota_failure', 'QuotaExceededError');
      await this.sync_state.put({ ...state, next_sequence: state.next_sequence + 1 });
      await saveViews(this.projected_views, lease.account, project(entities.map(e => e.payload), [...operations, operation], day));
      return operation;
    });
  }

  async read(account: string) {
    requireFixture(account);
    return this.transaction('r', this.tables, async () => {
      const rows = await this.projected_views.where('account_id').equals(account).toArray();
      const pending = ordered(await this.sync_mutations.where('account_id').equals(account).toArray());
      const projection: Projection = { habits: [], totalXp: 0 };
      for (const row of rows) {
        if ('habitId' in row.payload) projection.habits.push(row.payload);
        else projection.totalXp = row.payload.totalXp;
      }
      return { projection, pending, nextSequence: (await this.sync_state.get(account))?.next_sequence, control: await this.installation_control.get(1) };
    });
  }
}

function ordered(rows: Mutation[]) { return rows.sort((a, b) => a.client_sequence - b.client_sequence).map(r => r.envelope); }
function requireFixture(account: string) {
  if (!Object.values(fixtures).some(f => f.account === account)) throw new Error('synthetic_account_required');
}
async function saveViews(table: Table<View>, account: string, projection: Projection) {
  await table.where('account_id').equals(account).delete();
  await table.bulkPut([
    ...projection.habits.map(h => ({ account_id: account, kind: 'habit' as const, entity_key: h.habitId, payload: h })),
    { account_id: account, kind: 'xp', entity_key: 'total', payload: { totalXp: projection.totalXp } },
  ]);
}
function uuid7() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let timestamp = Date.now();
  for (let i = 5; i >= 0; i--) { bytes[i] = timestamp % 256; timestamp = Math.floor(timestamp / 256); }
  bytes[6] = (bytes[6]! & 15) | 112;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
