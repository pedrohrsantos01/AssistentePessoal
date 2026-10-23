import { MainDatabase } from '../src/local/database.ts';
import { Coordinator } from '../src/local/coordinator.ts';
import { LocalRepository } from '../src/local/repository.ts';
import type { Owner } from '../src/local/records.ts';
export const id=()=>{const hex=crypto.randomUUID().replaceAll('-','');return `${hex.slice(0,8)}-${hex.slice(8,12)}-7${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20)}`;};
export const at='2026-10-22T12:00:00Z',day='2026-10-22';
export const timeContext={timezone:'America/Sao_Paulo',dayStartHour:4};
export const create=(habit=id(),title='Fixture')=>({type:'habit.create' as const,habitId:habit,title,habitType:'binary' as const,scheduleKind:'daily' as const,startDayKey:day,timeContext,iconKey:null,colorToken:null,sortOrder:0});
export function locksFixture():LockManager {
  const held=new Set<string>(),queues=new Map<string,(()=>void)[]>();
  return {async request(name:string,options:LockOptions|((lock:Lock|null)=>Promise<unknown>),callback?:(lock:Lock|null)=>Promise<unknown>) {
    const opts=typeof options==='function'?{}:options,fn=typeof options==='function'?options:callback!;
    if(opts.steal) throw new Error('steal_forbidden');
    if(held.has(name)&&opts.ifAvailable) return fn(null);
    if(held.has(name)) await new Promise<void>(resolve=>{const queue=queues.get(name)??[];queue.push(resolve);queues.set(name,queue);});
    held.add(name);
    try{return await fn({name,mode:'exclusive'} as Lock);} finally {const next=queues.get(name)?.shift();if(next) next();else held.delete(name);}
  }} as unknown as LockManager;
}
export async function setup(build='fixture-1',locks=locksFixture(),name=`test-${id()}`) {
  const coordinator=new Coordinator(id(),locks);await coordinator.start();
  const db=new MainDatabase(name),repo=new LocalRepository(db,coordinator,build);await repo.open(id());
  const owner=(await coordinator.acquire(db))!;await repo.setCompatibility(owner,'compatible',at);
  return {repo,db,coordinator,owner,locks,name,async close(){db.close();await coordinator.stop();await db.delete();}};
}
export async function login(repo:LocalRepository,owner:Owner,account=id()) {
  const attempt=id(),context=id(),installation=(await repo.db.installation_control.get(1))!.installation_id;
  await repo.startAuth(owner,attempt,account);await repo.recordChallenge(owner,attempt,context,at,at);await repo.prepareDispatched(owner,attempt);await repo.confirmReservation(owner,attempt);
  const session={contextId:context,installationId:installation,accountId:account,ownerEpoch:owner.epoch,ownerTabId:owner.tab,profile:{accountId:account,displayName:'Fixture',timeContext,plan:'free' as const,onboardedAt:null,analyticsConsentAt:null,revision:'1'}};
  return repo.activate(owner,attempt,session);
}
