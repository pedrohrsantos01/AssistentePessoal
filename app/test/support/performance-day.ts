import assert from 'node:assert/strict';
import {getDayKey} from '../../src/features/gamification/domain/day-key.ts';
export function performanceDayContext(serverTime:string,deviceTime:string){
 const server=new Date(serverTime),device=new Date(deviceTime);
 assert.ok(Number.isFinite(server.getTime())&&Number.isFinite(device.getTime()),'fixture_clock_invalid');
 // The API's injected clock stays frozen. Select the synthetic account's
 // onboarding hour so it agrees with the device throughout the 30-minute run.
 const first=(server.getUTCHours()+23)%24;
 for(let offset=0;offset<24;offset++){
  const hour=(first+offset)%24,day=getDayKey(server,'UTC',hour);
  if([device,new Date(device.getTime()+30*60*1000)].every(at=>getDayKey(at,'UTC',hour)===day))return {timezone:'UTC',dayStartHour:hour,dayKey:day};
 }
 throw new Error('fixture_clocks_have_no_shared_logical_day');
}
