import {useEffect,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,View} from 'react-native';
import type {Journey,JourneyState} from './journey.ts';
import {pt} from '../../i18n/pt-BR.ts';
import {useTheme} from '../../theme/theme.tsx';
import {Banner,Button,Card,Input,Link,Page,Type} from '../../ui/primitives.tsx';
export function PasswordRecoveryScreen({journey,state,login}:{journey:Journey;state:JourneyState;login:()=>void}) {
 const recovery=journey.passwordRecovery,form=useSyncExternalStore(recovery.subscribe,recovery.state),t=useTheme();
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false);
 const title=form.view==='confirm'?pt.resetPasswordTitle:form.view==='invalid'?pt.resetInvalidTitle:form.view==='complete'?pt.resetCompleteTitle:pt.recoverPassword;
 useEffect(()=>{AccessibilityInfo.announceForAccessibility(title);},[title]);
 const done=()=>{recovery.close();login();},waiting=form.retryAt!==null;
 return <Page back={()=>recovery.close()}><Type size="title" semibold header>{title}</Type>
  {form.view==='request'?<><Type tone="secondary" style={{lineHeight:t.typeSize.body*t.line.onboarding}}>{pt.passwordRecoveryHelp}</Type><Input label={pt.email} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" maxLength={254} editable={!form.busy} onSubmitEditing={()=>{void recovery.send(email);}}/></>:form.view==='confirm'?<><Type tone="secondary">{pt.resetPasswordHelp}</Type><View style={{gap:t.space.compact}}><Input label={pt.newPassword} value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!form.busy} onSubmitEditing={()=>{void recovery.confirm(password);}} accessory={<Button compact secondary textSize="label" label={show?pt.hide:pt.show} disabled={form.busy} onPress={()=>setShow(!show)} style={{minWidth:t.metrics.passwordToggle,minHeight:t.metrics.input}}/>}/><Type size="status" tone="secondary">{pt.passwordHint}</Type></View></>:form.view==='sent'?<Card decorated={false} style={{backgroundColor:t.bg.welcomeAccentSoft,borderColor:t.accent.line,paddingHorizontal:t.space.large,paddingVertical:t.space.inputInset}}><View accessibilityLiveRegion="polite" style={{flexDirection:'row',alignItems:'flex-start',gap:t.space.controlGap}}><Type>{pt.recoveryEmailSymbol}</Type><Type size="context" style={{flex:1,lineHeight:t.typeSize.context*t.line.onboarding}}>{pt.recoverySent(form.sentEmail)}</Type></View></Card>:form.view==='invalid'?<Banner message={pt.resetInvalidBody} error/>:<Type>{pt.resetCompleteBody}</Type>}
  {form.error&&(state.online||form.error!==pt.recoveryOffline)&&<Banner message={form.error} error/>}{waiting&&<Type size="label" tone="secondary">{pt.syncWaiting(form.retryAt!)}</Type>}{!state.online&&['request','confirm'].includes(form.view??'')&&<Banner message={pt.recoveryOffline}/>}
  {form.view==='request'?<Button label={form.busy?pt.sendingResetLink:pt.sendResetLink} busy={form.busy} disabled={waiting} onPress={()=>{void recovery.send(email);}}/>:form.view==='confirm'?<Button label={form.busy?pt.saving:pt.saveNewPassword} busy={form.busy} disabled={waiting} onPress={()=>{void recovery.confirm(password);}}/>:form.view==='invalid'?<Button label={pt.anotherResetLink} onPress={()=>recovery.request()}/>:<Button label={pt.backToLogin} onPress={done}/>}
  {form.view==='sent'&&<Link center label={pt.otherRecoveryEmail} onPress={()=>recovery.request()}/ >}
 </Page>;
}
