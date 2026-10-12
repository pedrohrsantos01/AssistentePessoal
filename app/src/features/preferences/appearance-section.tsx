import {useSyncExternalStore} from 'react';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppearancePreferences,useTheme} from '../../theme/theme.tsx';
import {Banner,Button,Card,Touch,Type} from '../../ui/primitives.tsx';
import {pt} from '../../i18n/pt-BR.ts';
import type {AppearancePreferences} from '../../core/preferences/appearance.ts';
function Toggle({label,description,checked,disabled,index,onPress}:{label:string;description:string;checked:boolean;disabled:boolean;index:number;onPress:()=>void}){
 const t=useTheme();return <Touch accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={description} accessibilityState={{checked,disabled}} disabled={disabled} dimWhenDisabled={false} onPress={onPress} style={{minHeight:t.metrics.preferenceRow,paddingVertical:t.space.small,gap:t.space.medium,flexDirection:'row',alignItems:'center',borderTopWidth:index?t.metrics.border:t.space.none,borderTopColor:t.border.decorative}}>
  <View style={{flex:1,gap:t.space.tiny}}><Type>{label}</Type><Type size="status" tone="secondary" style={{lineHeight:t.typeSize.status*t.line.context}}>{description}</Type></View>
  <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width:t.metrics.switchWidth,height:t.metrics.switchHeight,borderRadius:t.metrics.switchRadius,backgroundColor:checked?t.accent.fill:t.bg.track,borderWidth:t.metrics.border,borderColor:checked?t.accent.fill:t.border.switchTrack,opacity:disabled?t.metrics.disabledOpacity:1}}><View style={{position:'absolute',top:t.metrics.switchInset-t.metrics.border,left:(checked?t.metrics.switchOnInset:t.metrics.switchInset)-t.metrics.border,width:t.metrics.switchKnob,height:t.metrics.switchKnob,borderRadius:t.metrics.switchRadius,backgroundColor:checked?t.text.onAccent:t.switchOffKnob}}/></View>
 </Touch>;
}
function Selection({preferences}:{preferences:AppearancePreferences}){
 const state=useSyncExternalStore(preferences.subscribe,preferences.state),t=useTheme(),disabled=!state.available||state.busy;
 return <View style={{gap:t.space.small}}><Type size="caption" mono medium header tone="secondary" style={{letterSpacing:t.metrics.sectionLetter,marginHorizontal:t.space.micro}}>{pt.appearance}</Type>
  <Card decorated={false} style={{paddingHorizontal:t.space.inputInset,paddingVertical:t.space.tiny,gap:t.space.none}}>
   {(['holo','cockpit','neo'] as const).map((skin,index)=><Touch key={skin} accessibilityRole="radio" accessibilityLabel={pt.appearanceNames[skin]} accessibilityHint={skin==='holo'?pt.appearanceDefault:undefined} accessibilityState={{checked:state.appearance.skin===skin,disabled,busy:state.busy}} disabled={disabled} dimWhenDisabled={false} onPress={()=>{void preferences.choose({skin});}} style={{minHeight:t.metrics.preferenceRow,paddingVertical:t.space.small,flexDirection:'row',alignItems:'center',gap:t.space.medium,borderTopWidth:index?t.metrics.border:t.space.none,borderTopColor:t.border.decorative}}>
    <View style={{flex:1,gap:t.space.tiny}}><Type>{pt.appearanceNames[skin]}</Type>{skin==='holo'&&<Type size="status" tone="secondary" style={{lineHeight:t.typeSize.status*t.line.context}}>{pt.appearanceDefault}</Type>}</View><Type size="status" tone="secondary">{state.appearance.skin===skin?pt.appearanceActive+' '+pt.symbols.chevron:pt.symbols.chevron}</Type>
   </Touch>)}
   <Toggle label={pt.darkMode} description={pt.darkModeHelp} checked={t.mode==='dark'} disabled={disabled} index={3} onPress={()=>{void preferences.choose({mode:t.mode==='dark'?'light':'dark'});}}/>
   <Toggle label={pt.followSystem} description={pt.followSystemHelp} checked={state.appearance.mode==='system'} disabled={disabled} index={4} onPress={()=>{void preferences.choose({mode:state.appearance.mode==='system'?t.mode:'system'});}}/>
  </Card>
  {state.error==='write'&&<><Banner message={pt.preferenceWriteFailure} error/><Button secondary compact label={pt.retryAppearance} busy={state.busy} onPress={()=>{void preferences.retry();}}/></>}
 </View>;
}
export function AppearanceSection(){const preferences=useAppearancePreferences();return preferences?<Selection preferences={preferences}/>:null;}
export function AppearanceReadNotice({preferences}:{preferences:AppearancePreferences}){
 const state=useSyncExternalStore(preferences.subscribe,preferences.state),t=useTheme();return state.error==='read'?<SafeAreaView edges={['top']} style={{backgroundColor:t.bg.base,paddingHorizontal:t.space.briefing,gap:t.space.small}}><Banner message={pt.preferenceReadFailure}/><Button secondary compact label={pt.retryAppearanceRead} busy={state.busy} onPress={()=>{void preferences.retry();}}/></SafeAreaView>:null;
}
