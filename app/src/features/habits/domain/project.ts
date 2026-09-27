import type { Entity, Operation } from '../../../core/sync/protocol.ts';

export function project(base: Entity[], pending: Operation[], day: string) {
  const habits = new Map(base.filter(e=>e.kind==='habit').map(e=>[e.value.habitId,e.value]));
  const canonicalDays = base.filter(e=>e.kind==='habitDay').map(e=>e.value);
  const days = new Map(canonicalDays.map(d=>[d.habitId+':'+d.dayKey,{...d,undos:new Set(d.knownUndoIds),marks:[] as string[][],localUndo:false}]));
  for (const op of pending) {
    const c = op.command;
    if(c.type==='habit.create') habits.set(c.habitId,{
      habitId:c.habitId,title:c.title.normalize('NFC').trim(),habitType:'binary',scheduleKind:'daily',
      startDayKey:c.startDayKey,creationTimeContext:c.timeContext,iconKey:c.iconKey,colorToken:c.colorToken,
      sortOrder:c.sortOrder,createdAt:op.occurredAt,updatedAt:op.occurredAt,deletedAt:null,revision:'0',
    });
    if(c.type==='habit.patchMetadata') {
      const habit = habits.get(c.habitId);
      if(habit) habits.set(c.habitId,{...habit,...c.patch});
    }
    if(c.type==='habit.mark'||c.type==='habit.unmark') {
      const key=c.habitId+':'+c.dayKey;
      const state=days.get(key)??{habitDayId:key,habitId:c.habitId,dayKey:c.dayKey,done:false,knownUndoIds:[],revision:'0',undos:new Set<string>(),marks:[] as string[][],localUndo:false};
      if(c.type==='habit.unmark') {state.undos.add(op.operationId);state.localUndo=true;}
      else state.marks.push(c.observedUndoIds);
      days.set(key,state);
    }
  }
  const done = new Map([...days].map(([k,s])=>[k,(!s.localUndo&&s.done)||s.marks.some(m=>[...s.undos].every(id=>m.includes(id)))]));
  let totalXp=base.filter(e=>e.kind==='xpGrant'&&e.value.active).reduce((sum,e)=>sum+(e.kind==='xpGrant'?e.value.amount:0),0);
  for(const [key,state] of days) {
    const grant=base.find(e=>e.kind==='xpGrant'&&e.value.habitDayId===state.habitDayId);
    const denied=base.some(e=>e.kind==='xpDecision'&&e.value.habitDayId===state.habitDayId&&e.value.outcome==='limit_reached');
    const current=grant?.kind==='xpGrant'&&grant.value.active?grant.value.amount:0;
    totalXp+=(done.get(key)&&!denied?10:0)-current;
  }
  return {habits:[...habits.values()].filter(h=>!h.deletedAt&&h.startDayKey<=day)
    .sort((a,b)=>a.sortOrder-b.sortOrder||a.habitId.localeCompare(b.habitId))
    .map(h=>({habitId:h.habitId,title:h.title,done:done.get(h.habitId+':'+day)??false})),totalXp};
}
