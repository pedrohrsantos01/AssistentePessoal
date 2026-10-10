import {useState} from 'react';
import {SyncNotice} from './sync-state.tsx';
import {pt} from '../../i18n/pt-BR.ts';
import {Banner,Button,Card,Page,Type} from '../../ui/primitives.tsx';
import {useNavigation} from './navigation.ts';
import type {Journey,JourneyState} from './journey.ts';
export function SessionNotice({journey,state,showAuthentication=true}:{journey:Journey;state:JourneyState;showAuthentication?:boolean}) {
 const nav=useNavigation();
 return <><SyncNotice state={state}/ >{state.vaultUnavailable?<Card decorated={false}><Type size="context" semibold header>{pt.vaultTitle}</Type><Type size="label" tone="secondary">{state.local?pt.vault:pt.vaultLocked}</Type><Button compact secondary label={pt.retryVault} busy={state.busy} onPress={()=>{void journey.retry();}}/></Card>:state.authenticationRequired&&showAuthentication?<Card decorated={false}><Type size="context" semibold header>{pt.remoteLoginTitle}</Type><Type size="label" tone="secondary">{pt.remoteLogin}</Type><Button compact secondary label={pt.reauth} onPress={()=>{journey.clearError();nav.go('reauth');}}/></Card>:null}</>;
}
export function OpeningFailure({journey,state}:{journey:Journey;state:JourneyState}) {
 const [details,setDetails]=useState(false),recovery=state.recovery!;
 return <Page><Type size="title" semibold header>{recovery.scope==='installation'?pt.databaseInstallationTitle:pt.databaseAccountTitle}</Type><Type tone="secondary">{recovery.scope==='installation'?pt.databaseInstallationBody:pt.databaseBody}</Type><Type size="label" tone="secondary">{pt.databaseReason[recovery.reason]}</Type>
  <Button label={pt.retryDatabase} busy={state.busy} onPress={()=>{void journey.retry();}}/>{state.busy&&<Type size="label" mono>{pt.retryDatabaseBusy}</Type>}{state.error&&<Banner message={state.error} error/>}
  <Button compact secondary label={details?pt.hideDiagnosis:pt.showDiagnosis} onPress={()=>setDetails(!details)}/>{details&&<Card decorated={false}><Type size="label">{pt.databaseScope[recovery.scope]}</Type><Type size="label">{pt.databaseStage[recovery.stage]}</Type><Type size="caption" mono>{pt.databaseCode(recovery.code)}</Type></Card>}
 </Page>;
}
