import type { Entity, Operation, Receipt } from '../../../app/src/core/sync/protocol.ts';
import type { RecoveryItem } from '../../../app/src/core/db/account-store.ts';
export type Control = { singleton: 1; installation_id: string; schema_version: 1; session_state: 'active'|'logging_out'|'locked'; session_generation: number; selected_account_id: string|null; selected_context_id: string|null; owner_tab_id: string|null; owner_epoch: string };
export type Journal = { attempt_id: string; context_id: string|null; installation_id: string; expected_account_id: string|null; account_id: string|null; session_generation: number; owner_epoch: string; owner_tab_id: string; prepare_dispatched: boolean; phase: 'challenging'|'preparing'|'reserved'|'active'|'close_pending'|'recovery_required'|'terminal'; reservation_expires_at: string|null; close_cookie_expires_at: string|null; terminal_proof: 'not_dispatched'|'expired_unbound'|'closed_unbound'|'closed'|'expired'|'recovered'|null };
export type Compatibility = { build_id: string; protocol_version: 'm1.1'; schema_version: 1; state: 'unknown'|'compatible'|'upgrade_required'; checked_at: string|null };
export type Account = { account_id: string; state: 'ready'|'blocked' };
export type Canonical = { account_id: string; kind: Entity['kind']; entity_key: string; revision: string; payload: Entity };
export type Mutation = { account_id: string; operation_id: string; device_id: string; client_sequence: number; envelope: Operation; dependencies: string[]; status: 'pending'|'in_flight'|'retry_wait'|'deferred'|'blocked_local'|'rejected'|'acknowledged'; attempts: number; next_attempt_at: string|null; error: (RecoveryItem['error'] & { resolution?: RecoveryItem['resolution'] })|null; result: Receipt|null };
export type SyncState = { account_id: string; cursor: string|null; next_sequence: number; onboarding_step: 'time_context'|'first_habit'|'complete'; snapshot_id: string|null; snapshot_revision: string|null; snapshot_cursor: string|null; snapshot_expires_at: string|null };
export type Staging = Canonical & { snapshot_id: string };
export type Projection = { account_id: string; kind: 'habit'|'xp'; entity_key: string; payload: {habitId: string;title: string;done: boolean}|{totalXp: number} };
export type Appearance = { version: 1; skin: 'holo'|'cockpit'|'neo'; mode: 'system'|'light'|'dark' };
export type Records = { Control: Control; AuthJournal: Journal; Compatibility: Compatibility; Account: Account; Canonical: Canonical; Mutation: Mutation; SyncState: SyncState; Staging: Staging; Projection: Projection; Appearance: Appearance };
export type Owner = Readonly<{ tab: string; epoch: string }>;
export type Lease = Readonly<Owner & { installation: string; account: string; context: string; generation: number }>;
export function decimal(value: string): bigint {
  if (!/^(0|[1-9][0-9]{0,18})$/.test(value) || BigInt(value)>9223372036854775807n) throw new Error('invalid_decimal');
  return BigInt(value);
}
export function increment(value: string): string {
  const next=decimal(value)+1n;
  if(next>9223372036854775807n) throw new Error('epoch_exhausted');
  return String(next);
}
