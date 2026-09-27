export type TimeContext = { timezone: string; dayStartHour: number };
export type CreateHabit = {
  type: 'habit.create'; habitId: string; title: string; habitType: 'binary'; scheduleKind: 'daily';
  startDayKey: string; timeContext: TimeContext; iconKey: string | null; colorToken: string | null; sortOrder: number;
};
export type Command = CreateHabit
  | {type:'habit.mark';habitId:string;dayKey:string;timeContext:TimeContext;observedUndoIds:string[]}
  | {type:'habit.unmark';habitId:string;dayKey:string;timeContext:TimeContext}
  | {type:'habit.patchMetadata';habitId:string;patch:{title?:string;iconKey?:string|null;colorToken?:string|null;sortOrder?:number}}
  | {type:'profile.setOnboarding';timeContext:TimeContext;completed:boolean;analyticsConsent:boolean};
export type Operation = {
  operationId:string;deviceId:string;clientSequence:number;occurredAt:string;dependsOn:string[];
  command:Command;supersedesOperationId?:string|null;
};
export type Habit = Omit<CreateHabit,'type'|'timeContext'> & {
  creationTimeContext:TimeContext;createdAt:string;updatedAt:string;deletedAt:string|null;revision:string;
};
export type Entity =
  | {kind:'habit';value:Habit}
  | {kind:'habitDay';value:{habitDayId:string;habitId:string;dayKey:string;done:boolean;knownUndoIds:string[];revision:string}}
  | {kind:'xpGrant';value:{grantId:string;habitDayId:string;amount:10;dayKey:string;module:'habits';budgetCost:10;active:boolean;revision:string}}
  | {kind:'xpDecision';value:{habitDayId:string;outcome:'granted'|'limit_reached';grantId:string|null;revision:string}}
  | {kind:'xpBudget';value:{dayKey:string;module:'habits';consumed:number;dueHabitCount:number;limit:number;revision:string}}
  | {kind:'xpTransition';value:{operationId:string;grantId:string;kind:'grant'|'reverse'|'restore';acceptedAt:string;revision:string}}
  | {kind:'profile';value:{accountId:string;displayName:string;timeContext:TimeContext;plan:'free';onboardedAt:string|null;analyticsConsentAt:string|null;revision:string}}
  | {kind:'tombstone';value:{entityKind:'habit';entityId:string;deletedAt:string;revision:string}};
export type Receipt = {operationId:string;status:'accepted'|'reconciled';acceptedRevision:string}
  | {operationId:string;status:'rejected';error:{code:string;fields:{path:string;code:string}[];dependencyIds:string[]}};
export type PushResult = {receipt:Receipt;replayed:boolean;projections?:Entity[]}
  | {operationId:string;status:'deferred';missingDependencyIds:string[]};
export type Change = {revision:string;operationResults:Receipt[];entities:Entity[]};
export type Pull = {changes:Change[];nextCursor:string;hasMore:boolean;highWaterRevision:string;serverTime:string};
export function entityKey(entity:Entity):string {
  const {kind,value} = entity;
  switch(kind) {
    case 'profile': return value.accountId;
    case 'habit': return value.habitId;
    case 'habitDay': case 'xpDecision': return value.habitDayId;
    case 'xpGrant': return value.grantId;
    case 'xpBudget': return value.dayKey;
    case 'xpTransition': return value.operationId + ':' + value.grantId;
    case 'tombstone': return value.entityId;
  }
}
