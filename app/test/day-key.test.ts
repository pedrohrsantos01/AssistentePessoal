import {test} from 'node:test';
import assert from 'node:assert/strict';
import {logicalDays} from './support/logical-days.ts';
import {getDayKey} from '../src/features/gamification/domain/day-key.ts';

test('the configured logical boundary preserves midnight and advances at exactly four in Sao Paulo',()=>{
  assert.equal(getDayKey(new Date('2026-09-25T03:00:00Z'),'America/Sao_Paulo',4),'2026-09-24');
  assert.equal(getDayKey(new Date('2026-09-25T06:59:59.999Z'),'America/Sao_Paulo',4),'2026-09-24');
  assert.equal(getDayKey(new Date('2026-09-25T07:00:00Z'),'America/Sao_Paulo',4),'2026-09-25');
});


test('a repeated Chatham hour cannot move the logical day back after its first boundary',()=>{
  assert.equal(getDayKey(new Date('2026-04-04T13:14:59.999Z'),'Pacific/Chatham',3),'2026-04-04');
  assert.equal(getDayKey(new Date('2026-04-04T13:15:00Z'),'Pacific/Chatham',3),'2026-04-05');
  assert.equal(getDayKey(new Date('2026-04-04T14:05:00Z'),'Pacific/Chatham',3),'2026-04-05');
});


test('a missing Chatham boundary begins at the first valid instant, not one shifted hour later',()=>{
  assert.equal(getDayKey(new Date('2026-09-26T13:59:59.999Z'),'Pacific/Chatham',3),'2026-09-26');
  assert.equal(getDayKey(new Date('2026-09-26T14:00:00Z'),'Pacific/Chatham',3),'2026-09-27');
  assert.equal(getDayKey(new Date('2026-09-26T14:05:00Z'),'Pacific/Chatham',3),'2026-09-27');
});


for(const example of logicalDays) test('logical day: '+example.name,()=>{
  assert.equal(getDayKey(new Date(example.at),example.timezone,example.hour),example.expected);
});

test('invalid date, timezone and configured hour cannot produce a day key',()=>{
  assert.throws(()=>getDayKey(new Date(NaN),'UTC',4),RangeError);
  assert.throws(()=>getDayKey(new Date('2026-09-25T13:00:00Z'),'Invalid/Zone',4),RangeError);
  for(const hour of [-1,24,1.5,NaN]) assert.throws(()=>getDayKey(new Date('2026-09-25T13:00:00Z'),'UTC',hour),RangeError);
});
