import {test} from 'node:test';
import assert from 'node:assert/strict';
import {logicalDays} from './support/logical-days.ts';
import {getDayKey,nextLogicalDayAt} from '../src/features/gamification/domain/day-key.ts';

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

test('interleaved timezones, day-start changes and backward clock movement never reuse a current day',()=>{
  const instant=new Date('2026-09-25T05:00:00Z');
  for(let round=0;round<3;round++) {
    assert.equal(getDayKey(instant,'UTC',4),'2026-09-25');
    assert.equal(getDayKey(instant,'America/Sao_Paulo',4),'2026-09-24');
    assert.equal(getDayKey(instant,'UTC',6),'2026-09-24');
    assert.equal(getDayKey(instant,'UTC',4),'2026-09-25');
    assert.equal(getDayKey(new Date('2026-09-26T03:59:59.999Z'),'UTC',4),'2026-09-25');
    assert.equal(getDayKey(new Date('2026-09-26T04:00:00Z'),'UTC',4),'2026-09-26');
    assert.equal(getDayKey(new Date('2026-09-25T03:59:59.999Z'),'UTC',4),'2026-09-24');
  }
});

test('repeated and skipped boundaries remain exact after neighboring resolutions and clock jumps',()=>{
  const examples=[
    ['2026-11-01T04:59:59.999Z','America/New_York',1,'2026-10-31','2026-11-01T05:00:00Z'],
    ['2026-11-01T06:30:00Z','America/New_York',1,'2026-11-01','2026-11-02T06:00:00Z'],
    ['2026-03-08T06:59:59.999Z','America/New_York',2,'2026-03-07','2026-03-08T07:00:00Z'],
    ['2026-03-08T07:00:00Z','America/New_York',2,'2026-03-08','2026-03-09T06:00:00Z'],
    ['2011-12-30T09:59:59.999Z','Pacific/Apia',4,'2011-12-29','2011-12-30T10:00:00Z'],
    ['2011-12-30T10:00:00Z','Pacific/Apia',4,'2011-12-30','2011-12-30T14:00:00Z'],
    ['2011-12-30T14:00:00Z','Pacific/Apia',4,'2011-12-31','2011-12-31T14:00:00Z'],
    ['1970-01-01T00:00:00Z','UTC',0,'1970-01-01','1970-01-02T00:00:00Z'],
  ] as const;
  for(const example of [...examples,...[...examples].reverse(),...examples]) {
    const [at,zone,hour,day,next]=example;
    assert.equal(getDayKey(new Date(at),zone,hour),day);
    assert.equal(nextLogicalDayAt(new Date(at),zone,hour),Date.parse(next));
    assert.equal(getDayKey(new Date(at),zone,hour),day);
  }
});
