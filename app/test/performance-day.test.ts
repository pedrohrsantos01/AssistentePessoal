import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performanceDayContext} from './support/performance-day.ts';
import {getDayKey} from '../src/features/gamification/domain/day-key.ts';
test('performance fixture chooses an onboarding boundary shared by the frozen API and the whole device run',()=>{
 for(const [server,device] of [['2026-10-21T03:51:00Z','2026-10-21T04:01:00Z'],['2026-10-21T23:55:00Z','2026-10-22T00:01:00Z']]){
  const value=performanceDayContext(server!,device!);
  assert.equal(getDayKey(new Date(server!),value.timezone,value.dayStartHour),value.dayKey);
  for(const at of [Date.parse(device!),Date.parse(device!)+30*60*1000])assert.equal(getDayKey(new Date(at),value.timezone,value.dayStartHour),value.dayKey,'device_and_API_must_observe_the_same_logical_day');
 }
});
test('an incompatible or missing fixture clock is rejected before creating domain data',()=>{
 for(const clocks of [['invalid','2026-10-21T04:00:00Z'],['2026-10-20T04:00:00Z','2026-10-22T04:00:00Z']])assert.throws(()=>performanceDayContext(clocks[0]!,clocks[1]!));
});
