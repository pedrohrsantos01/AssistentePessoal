import {useEffect,useState} from 'react';
import {AccessibilityInfo,View} from 'react-native';
import type {RecoveryItem} from '../../core/db/account-store.ts';
import type {Command,Operation} from '../../core/sync/protocol.ts';
import {pt} from '../../i18n/pt-BR.ts';
import {useTheme} from '../../theme/theme.tsx';
import {Back,Banner,Button,Card,Input,Page,Sheet,Touch,Type} from '../../ui/primitives.tsx';
import type {Journey,JourneyState} from './journey.ts';
import {useNavigation} from './navigation.ts';
import {getDayKey} from '../gamification/domain/day-key.ts';
export function operationLabel(operation:Operation,state:JourneyState) {
 const c=operation.command,title=c.type==='habit.create'?c.title:c.type==='habit.patchMetadata'&&c.patch.title!==undefined?c.patch.title:'habitId' in c?state.local?.managementHabits.find(h=>h.habitId===c.habitId)?.title:undefined;
 return pt.operationNames[c.type]+(title?pt.symbols.separator+title:'')+('dayKey' in c?pt.symbols.separator+c.dayKey:'');
}
const uncertain=(item:RecoveryItem)=>!!item.error.identity||item.error.code==='identity_dependency_unresolved';
export function itemStatus(state:JourneyState,habitId:string,day?:string) {
 const rows=state.operations.filter(row=>!row.resolution&&'habitId' in row.operation.command&&row.operation.command.habitId===habitId&&(!day||!('dayKey' in row.operation.command)||row.operation.command.dayKey===day));
 if(state.recoveries.some(item=>!item.resolution&&'habitId' in item.operation.command&&item.operation.command.habitId===habitId&&uncertain(item))) return pt.uncertainTitle;
 const row=rows.find(r=>['rejected','blocked_local'].includes(r.status))??rows.find(r=>r.status==='in_flight')??rows.find(r=>r.status!=='acknowledged');
 return pt.operationStates[row?.status??'acknowledged'];
}
export function SyncPill({state}:{state:JourneyState}) {
 const t=useTheme(),nav=useNavigation();return <Touch accessibilityRole="button" accessibilityLabel={pt.syncPillLabel(state.remote)} onPress={()=>nav.go('sync')} style={{alignSelf:'flex-start',minHeight:t.metrics.touch,justifyContent:'center',borderWidth:t.metrics.border,borderColor:t.border.interactive,paddingHorizontal:t.space.inputInset,borderRadius:t.metrics.pillRadius}}><Type size="status" mono tone="secondary">{state.remote===pt.synced?pt.symbols.check+' ':''}{state.remote}</Type></Touch>;
}
export function SyncNotice({state}:{state:JourneyState}) {
 const message=!state.writable&&state.local?pt.update:state.sync.lastFailure==='rate_limit'?pt.syncRateLimited:state.sync.lastFailure==='unavailable'?pt.syncUnavailable:state.sync.phase==='failed'?pt.syncFailed:state.sync.phase==='blocked'?pt.syncBlocked:null;
 return <>{message&&<Banner message={message}/ >}{state.snapshot&&<Card><Type size="section" semibold>{pt.snapshotTitle}</Type><Type size="label">{pt.snapshotProgress(state.snapshot.staged)}</Type><Type size="label" tone="secondary">{pt.snapshotActiveHelp}</Type></Card>}</>;
}
export function InitialCopy({journey,state}:{journey:Journey;state:JourneyState}) {
 const nav=useNavigation(),t=useTheme();return <Page><Type size="title" semibold header>{pt.initialLoading}</Type><Type tone="secondary">{pt.snapshotHelp}</Type><View accessibilityRole="progressbar" accessibilityLabel={pt.snapshotTitle} style={{height:t.metrics.skeleton,borderRadius:t.radius.card,backgroundColor:t.bg.track}}/>{state.snapshot&&<Type>{pt.snapshotProgress(state.snapshot.staged)}</Type>}<Banner message={state.remote}/>{state.sync.nextAttemptAt!==null&&<Type size="label" tone="secondary">{pt.syncWaiting(state.sync.nextAttemptAt)}</Type>}<Button label={pt.retry} disabled={!state.canRetry} onPress={()=>{void journey.retry();}}/>{state.vaultUnavailable&&<Button label={pt.retryVault} busy={state.busy} onPress={()=>{void journey.retry();}}/>}{state.authenticationRequired&&<Button label={pt.reauth} onPress={()=>nav.go('reauth')}/>}<Button label={pt.logout} secondary onPress={()=>{void journey.logout();}}/></Page>;
}
function RecoverySheet({journey,state,item,close}:{journey:Journey;state:JourneyState;item:RecoveryItem;close:()=>void}) {
 const t=useTheme(),original=item.operation.command;
 const [title,setTitle]=useState(original.type==='habit.create'?original.title:original.type==='habit.patchMetadata'?original.patch.title??'':''),[day,setDay]=useState('dayKey' in original?original.dayKey:original.type==='habit.create'?original.startDayKey:''),[zone,setZone]=useState('timeContext' in original?original.timeContext.timezone:''),[hour,setHour]=useState('timeContext' in original?String(original.timeContext.dayStartHour):''),[order,setOrder]=useState(original.type==='habit.create'?String(original.sortOrder):original.type==='habit.patchMetadata'&&original.patch.sortOrder!==undefined?String(original.patch.sortOrder):'');
 const [selected,setSelected]=useState<string[]>([]),[diagnosis,setDiagnosis]=useState(false),[discarding,setDiscarding]=useState(false),[invalid,setInvalid]=useState(false);
 const current=state.recoveries.find(r=>r.operation.operationId===item.operation.operationId),available=!!current&&!current.resolution,locked=uncertain(current??item),heading=locked?pt.uncertainTitle:item.source==='server'?pt.rejectedTitle:pt.localBlockedTitle;
 useEffect(()=>{AccessibilityInfo.announceForAccessibility(heading);},[heading]);
 const chain=new Set([item.operation.operationId]);let changed=true;
 while(changed) {changed=false;for(const r of state.recoveries) if(!r.resolution&&!chain.has(r.operation.operationId)&&r.operation.dependsOn.some(id=>chain.has(id))) {chain.add(r.operation.operationId);changed=true;}}
 const children=state.recoveries.filter(r=>!r.resolution&&r.operation.operationId!==item.operation.operationId&&chain.has(r.operation.operationId));
 const correct=()=>{
  let command:Command=original;
  if('timeContext' in command) {
   const dayStartHour=Number(hour),timezone=zone.trim();
   try {if(!/^\d+$/.test(hour)||!Number.isInteger(dayStartHour)) throw new Error('invalid');getDayKey(new Date(state.instant),timezone,dayStartHour);} catch {setInvalid(true);return;}
   command={...command,timeContext:{timezone,dayStartHour}};
  }
  if(day&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)) {setInvalid(true);return;}
  if(order&&(!/^-?\d+$/.test(order)||!Number.isSafeInteger(Number(order)))) {setInvalid(true);return;}
  if(command.type==='habit.create') command={...command,title,startDayKey:day,sortOrder:Number(order)};
  if(command.type==='habit.patchMetadata') command={...command,patch:{...command.patch,...(command.patch.title!==undefined?{title}:{}),...(command.patch.sortOrder!==undefined?{sortOrder:Number(order)}:{})}};
  if('dayKey' in command) command={...command,dayKey:day};
  setInvalid(false);if(journey.correct(item.operation.operationId,command,selected)) close();
 };
 const cancel=()=>{journey.clearError();close();};
 return <Sheet onClose={cancel} label={heading}><Type size="section" semibold header>{heading}</Type><Type semibold>{operationLabel(item.operation,state)}</Type>
  <Type tone="secondary">{locked?pt.uncertainBody:item.source==='local'&&item.error.code==='identity_dependency_unresolved'?pt.dependentUncertain:Object.hasOwn(pt.rejectionReasons,item.error.code)?pt.rejectionReasons[item.error.code as keyof typeof pt.rejectionReasons]:pt.rejectionFallback}</Type>
  {item.error.identity&&<Type size="label" tone="warning">{pt.uncertainReason[item.error.identity.reason]}</Type>}
  {!available&&<Banner message={pt.operationUnavailable}/ >}
  {!locked&&available&&<><Type size="label" tone="secondary">{pt.recoveryHelp}</Type>
   {(original.type==='habit.create'||original.type==='habit.patchMetadata'&&original.patch.title!==undefined)&&<Input label={pt.habitName} value={title} onChangeText={setTitle} editable={state.writable}/ >}
   {('dayKey' in original||original.type==='habit.create')&&<Input label={original.type==='habit.create'?pt.correctionStart:pt.correctionDay} value={day} onChangeText={setDay} editable={state.writable}/ >}
   {'timeContext' in original&&<><Input label={pt.timezone} value={zone} onChangeText={setZone} editable={state.writable}/ ><Input label={pt.dayStart} value={hour} onChangeText={setHour} keyboardType="number-pad" editable={state.writable}/ ></>}
   {(original.type==='habit.create'||original.type==='habit.patchMetadata'&&original.patch.sortOrder!==undefined)&&<Input label={pt.correctionOrder} value={order} onChangeText={setOrder} keyboardType="number-pad" editable={state.writable}/ >}
   {item.error.fields.map(field=><Type key={field.path} size="label" tone="warning">{pt.fieldProblem(field.path)}</Type>)}
  </>}
  {children.length>0&&<><Type size="label" semibold>{pt.dependentsTitle}</Type><Type size="label" tone="secondary">{locked?pt.dependentsLockedHelp:pt.dependentsHelp}</Type>{children.map(child=>!locked&&!uncertain(child)?<Touch key={child.operation.operationId} accessibilityRole="checkbox" accessibilityLabel={pt.recoverDependent(operationLabel(child.operation,state))} accessibilityState={{checked:selected.includes(child.operation.operationId),disabled:!state.writable}} disabled={!state.writable} onPress={()=>setSelected(ids=>ids.includes(child.operation.operationId)?ids.filter(id=>id!==child.operation.operationId):[...ids,child.operation.operationId])} style={{minHeight:t.metrics.touch,justifyContent:'center',padding:t.space.small,borderWidth:t.metrics.border,borderColor:t.border.interactive,borderRadius:t.radius.inner}}><Type size="label">{(selected.includes(child.operation.operationId)?pt.symbols.check:pt.plus)+pt.symbols.separator+operationLabel(child.operation,state)}</Type></Touch>:<Type key={child.operation.operationId} size="label">{operationLabel(child.operation,state)}</Type>)}</>}
  {(invalid||state.error)&&<Banner message={invalid?pt.correctionInvalid:state.error!} error/ >}
  <Button label={diagnosis?pt.intentDetailsHide:pt.intentDetails} secondary onPress={()=>setDiagnosis(!diagnosis)}/>{diagnosis&&<><Type size="caption" mono>{pt.operationId(item.operation.operationId)}</Type>{item.error.dependencyIds.map(id=><Type key={id} size="caption" mono>{pt.dependencyId(id)}</Type>)}<Type size="caption" mono>{JSON.stringify({intention:item.operation,diagnosis:item.error},null,2)}</Type></>}
  {!locked&&available&&<><Button label={pt.correctOperation} disabled={!state.writable||item.error.code==='context_limit_reached'} onPress={correct}/>{discarding?<><Type tone="warning">{pt.discardHelp}</Type><Button label={pt.discardConfirm} disabled={!state.writable} onPress={()=>{if(journey.discard(item.operation.operationId)) close();}}/></>:<Button label={pt.discardOperation} secondary disabled={!state.writable} onPress={()=>setDiscarding(true)}/>}</>}
  <Button label={pt.close} secondary onPress={cancel}/>
 </Sheet>;
}
export function SyncPanel({journey,state}:{journey:Journey;state:JourneyState}) {
 const nav=useNavigation(),t=useTheme(),[mode,setMode]=useState<'overview'|'review'|'history'>('overview'),[selected,setSelected]=useState<RecoveryItem|null>(null),[expanded,setExpanded]=useState<string|null>(null);
 const rows=state.operations.slice().reverse(),close=()=>{journey.clearError();nav.go(nav.syncFrom);};
 const groups={confirmed:0,local:0,sending:0,refused:0,uncertain:0,blocked:0};
 for(const row of rows) {
  if(row.resolution) continue;
  const recovery=state.recoveries.find(r=>r.operation.operationId===row.operation.operationId);
  if(recovery&&uncertain(recovery)) groups.uncertain++;
  else if(row.status==='acknowledged') groups.confirmed++;
  else if(row.status==='in_flight') groups.sending++;
  else if(row.status==='rejected') groups.refused++;
  else if(row.status==='blocked_local'&&recovery) groups.blocked++;
  else groups.local++;
 }
 return <><Sheet visible={!selected} onClose={close} label={pt.syncTitle}>{mode!=='overview'&&<Back onPress={close}/ >}<Type size="section" semibold header>{pt.syncTitle}</Type><Type tone="secondary">{state.writable?state.remote:pt.syncTitle}</Type><SyncNotice state={state}/>{state.sync.nextAttemptAt!==null&&<Type size="label" tone="secondary">{pt.syncWaiting(state.sync.nextAttemptAt)}</Type>}<Button label={pt.retry} disabled={!state.canRetry} onPress={()=>{void journey.retry();}}/>
  {mode==='overview'?<><View>{(Object.keys(groups) as (keyof typeof groups)[]).map((group,index)=><View key={group} style={{minHeight:t.metrics.input,flexDirection:'row',gap:t.space.medium,alignItems:'center',paddingVertical:t.space.small,borderTopWidth:index?t.metrics.border:t.space.none,borderTopColor:t.border.decorative}}><Type size="context" tone="secondary" style={{flex:1}}>{pt.syncGroups[group]}</Type><Type size="context" mono>{groups[group]}</Type></View>)}</View>{groups.refused+groups.uncertain+groups.blocked>0&&<Button label={pt.reviewChanges} onPress={()=>setMode('review')}/>}<Button label={pt.syncHistory} secondary onPress={()=>setMode('history')}/></>:<>{!rows.length&&<Type>{pt.syncEmpty}</Type>}{rows.filter(row=>mode==='history'||state.recoveries.some(r=>r.operation.operationId===row.operation.operationId&&!r.resolution)).map(row=>{const item=state.recoveries.find(r=>r.operation.operationId===row.operation.operationId),label=operationLabel(row.operation,state);return <Card key={row.operation.operationId} decorated={false} style={{gap:t.space.small}}><Type semibold>{label}</Type><Type size="label" mono tone={item&&!item.resolution?'warning':'secondary'}>{row.resolution?row.resolution.kind==='discarded'?pt.resolvedDiscard:pt.resolvedCorrection:item&&uncertain(item)?pt.uncertainTitle:pt.operationStates[row.status]}</Type>
   {item&&!item.resolution?<Button compact secondary label={pt.reviewOperation(label)} onPress={()=>{journey.clearError();setSelected(item);}}/>:<><Button compact secondary label={expanded===row.operation.operationId?pt.intentDetailsHide:pt.intentDetails} onPress={()=>setExpanded(expanded===row.operation.operationId?null:row.operation.operationId)}/>{expanded===row.operation.operationId&&<><Type size="caption" mono>{pt.operationId(row.operation.operationId)}</Type>{row.resolution?.kind==='corrected'&&<Type size="caption" mono>{pt.replacementId(row.resolution.replacementOperationId)}</Type>}<Type size="caption" mono>{JSON.stringify(row.operation,null,2)}</Type></>}</>}
  </Card>;})}
 </>}<Button label={pt.close} secondary onPress={close}/ ></Sheet>{selected&&<RecoverySheet key={selected.operation.operationId} journey={journey} state={state} item={selected} close={()=>setSelected(null)}/>}</>;
}
