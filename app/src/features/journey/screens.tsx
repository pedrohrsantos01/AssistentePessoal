import {useEffect,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,BackHandler,Modal,View} from 'react-native';
import {pt} from '../../i18n/pt-BR.ts';
import {useTheme} from '../../theme/theme.tsx';
import type {HabitColor} from '../../theme/tokens.ts';
import {Back,Banner,Button,Card,Input,Link,Loading,Page,Touch,Type} from '../../ui/primitives.tsx';
import {habitGlyph,habitIcons,type HabitIcon} from '../habits/catalog.ts';
import {BriefingCards,type BriefingCardProvider} from '../briefing/providers.tsx';
import {useNavigation,type Surface} from './navigation.ts';
import type {Journey,JourneyState,HabitDraft} from './journey.ts';
import {DeleteConfirmation,HabitManagement} from '../habits/management.tsx';
function AccountForm({journey,kind}:{journey:Journey;kind:'login'|'register'}) {
 const state=useSyncExternalStore(journey.subscribe,journey.state),nav=useNavigation(),t=useTheme();
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false);
 const submit=()=>{void journey.authenticate(kind,email,password,name);};
 return <Page><Back onPress={()=>{journey.clearError();nav.go(state.key?'briefing':'welcome');}}/><Type size="title" bold header>{kind==='register'?pt.register:pt.login}</Type>
  {kind==='register'&&<Input label={pt.name} value={name} onChangeText={setName} autoComplete="name" editable={!state.busy}/>}
  <Input label={pt.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} editable={!state.busy}/>
  <Input label={pt.password} value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete={kind==='register'?'new-password':'current-password'} autoCapitalize="none" autoCorrect={false} editable={!state.busy} onSubmitEditing={submit}/>
  <Link label={show?pt.hide:pt.show} onPress={()=>setShow(!show)}/>
  {kind==='register'&&<><Type size="label" tone="secondary">{pt.passwordHint}</Type><Type size="label" tone={Array.from(password).length>=12?'accent':'secondary'}>{Array.from(password).length>=16?pt.passwordStrong:Array.from(password).length>=12?pt.passwordMedium:pt.passwordWeak}</Type><Type size="label" tone="secondary">{pt.adults}</Type><Link label={pt.privacy} onPress={()=>nav.setPrivacy(true)}/></>}
  {state.error&&<Banner message={state.error} error/>}
  {!state.online&&<Banner message={pt.offlineAuth}/>}
  <View style={{marginTop:t.space.small}}><Button label={state.busy?(kind==='register'?pt.creating:pt.loggingIn):(kind==='register'?pt.register:pt.login)} onPress={submit} busy={state.busy}/></View>
 </Page>;
}
function TimeForm({journey,state}:{journey:Journey;state:JourneyState}) {
 const t=useTheme(),nav=useNavigation(),[timezone,setTimezone]=useState(()=>Intl.DateTimeFormat().resolvedOptions().timeZone),[hour,setHour]=useState(state.local!.profile.timeContext.dayStartHour);
 return <Page><Type size="caption" mono tone="accent">{pt.brand}</Type><Type size="title" bold header>{pt.onboarding}</Type><Type tone="secondary">{pt.timeExplanation}</Type>
  <Input label={pt.timezone} value={timezone} onChangeText={setTimezone} autoCapitalize="none" autoCorrect={false}/><Type size="label" tone="secondary">{pt.timezoneHelp}</Type>
  <Card><Type size="label" bold>{pt.dayStart}</Type><View style={{flexDirection:'row',gap:t.space.small,alignItems:'center',justifyContent:'space-between'}}>
   <Button label={pt.earlier} displayLabel={pt.minus} compact secondary disabled={hour===0} onPress={()=>setHour(hour-1)}/>
   <Type size="section" mono tone="accent">{pt.hour(hour)}</Type>
   <Button label={pt.later} displayLabel={pt.plus} compact secondary disabled={hour===23} onPress={()=>setHour(hour+1)}/>
  </View><Type size="label" tone="secondary">{pt.dayHint}</Type></Card>
  {state.error&&<Banner message={state.error} error/>}<Button label={pt.continue} disabled={!state.writable} onPress={()=>journey.confirmTime({timezone:timezone.trim(),dayStartHour:hour})}/><Link label={pt.logout} onPress={()=>nav.setLogout(true)}/>
 </Page>;
}
function HabitEditor({journey,state,habitId}:{journey:Journey;state:JourneyState;habitId:string|null}) {
 const nav=useNavigation(),[initial]=useState(()=>state.local?.managementHabits.find(habit=>habit.habitId===habitId));
 if(!initial) return <Page><Back onPress={()=>{journey.clearError();nav.go('habits');}}/><Banner message={pt.habitUnavailable} error/></Page>;
 return <HabitForm journey={journey} state={state} onboarding={false} initial={{habitId:initial.habitId,title:initial.title,iconKey:initial.iconKey??null,colorToken:initial.colorToken??null}}/>;
}
function HabitForm({journey,state,onboarding,initial}:{journey:Journey;state:JourneyState;onboarding:boolean;initial?:HabitDraft&{habitId:string}}) {
 const nav=useNavigation(),t=useTheme(),[baseline]=useState(initial),[title,setTitle]=useState(initial?.title??nav.draft),[icon,setIcon]=useState<string|null>(initial?initial.iconKey:'meditation'),[color,setColor]=useState<string|null>(initial?initial.colorToken:'accent'),[confirmDelete,setConfirmDelete]=useState(false);
 const available=!baseline||state.local!.managementHabits.some(habit=>habit.habitId===baseline.habitId),writable=state.writable&&available;
 const back=()=>{journey.clearError();nav.go(baseline?'habits':nav.formFrom);};
 const save=()=>{const saved=baseline?journey.edit(baseline.habitId,baseline,{title,iconKey:icon,colorToken:color}):journey.create(title,icon!,color!,onboarding);if(saved) {nav.setDraft('');nav.go(baseline?'habits':onboarding?'briefing':nav.formFrom);}};
 const previewColor=color&&Object.hasOwn(t.habitColors,color)?t.habitColors[color as HabitColor]:t.accent.text;
 return confirmDelete&&baseline?<DeleteConfirmation journey={journey} state={state} habit={baseline} close={()=>setConfirmDelete(false)} deleted={()=>{setConfirmDelete(false);nav.go('habits');}}/>:<Page>{!onboarding&&<Back onPress={back}/>}<Type size="title" bold header>{baseline?pt.editHabit:onboarding?pt.firstHabit:pt.newHabit}</Type><Type tone="secondary">{baseline?pt.editExplanation:pt.habitExplanation}</Type>
  <Input label={pt.habitName} placeholder={pt.habitExample} value={title} onChangeText={setTitle} onSubmitEditing={save} editable={writable}/>
  <Type size="label" bold>{pt.icon}</Type><View style={{flexDirection:'row',flexWrap:'wrap',gap:t.space.small}}>{(Object.keys(habitIcons) as HabitIcon[]).map(key=><Touch key={key} accessibilityRole="radio" accessibilityLabel={pt.icons[key]} disabled={!writable} accessibilityState={{checked:icon===key,disabled:!writable}} onPress={()=>setIcon(key)} style={{width:t.metrics.swatch,minHeight:t.metrics.swatch,borderRadius:t.radius.inner,borderWidth:t.metrics.controlBorder,borderColor:icon===key?t.accent.text:t.border.interactive,backgroundColor:icon===key?t.bg.accentSoft:t.bg.elevated,alignItems:'center',justifyContent:'center'}}><Type size="section">{habitIcons[key]}</Type></Touch>)}</View>
  <Type size="label" bold>{pt.color}</Type><View style={{flexDirection:'row',flexWrap:'wrap',gap:t.space.small}}>{(Object.keys(t.habitColors) as HabitColor[]).map(key=><Touch key={key} accessibilityRole="radio" accessibilityLabel={pt.colors[key]} disabled={!writable} accessibilityState={{checked:color===key,disabled:!writable}} onPress={()=>setColor(key)} style={{minWidth:t.metrics.swatch,minHeight:t.metrics.swatch,padding:t.space.small,borderRadius:t.radius.inner,borderWidth:t.metrics.controlBorder,borderColor:color===key?t.accent.text:t.border.interactive,backgroundColor:t.bg.elevated}}><Type style={{color:t.habitColors[key]}}>{color===key?'✓ ':''}{pt.colors[key]}</Type></Touch>)}</View>
  {baseline&&((icon!==null&&!Object.hasOwn(habitIcons,icon))||(color!==null&&!Object.hasOwn(t.habitColors,color)))&&<Type size="label" tone="secondary">{pt.metadataPreserved}</Type>}
  <Card><Type style={{color:previewColor}}>{habitGlyph(icon)} {title.trim()||pt.habitExample}</Type><Type size="caption" mono tone="secondary">{pt.daily}</Type></Card>
  {!available&&<Banner message={pt.habitUnavailable} error/>}{state.error&&<Banner message={state.error} error/>}<Button label={baseline?pt.saveHabit:pt.createHabit} disabled={!writable||!title.trim()} onPress={save}/>
  {baseline&&<Button label={pt.deleteHabit} secondary disabled={!writable} onPress={()=>{journey.clearError();setConfirmDelete(true);}}/>}
  {onboarding&&<Button label={pt.skip} secondary disabled={!state.writable} onPress={()=>journey.skip()}/>}
  {onboarding&&<Link label={pt.logout} onPress={()=>nav.setLogout(true)}/>}
 </Page>;
}
function HabitRow({habit,state,journey}:{habit:NonNullable<JourneyState['local']>['habits'][number];state:JourneyState;journey:Journey}) {
 const t=useTheme(),color=habit.colorToken&&Object.hasOwn(t.habitColors,habit.colorToken)?t.habitColors[habit.colorToken as HabitColor]:t.accent.fill;return <Touch accessibilityRole="checkbox" accessibilityLabel={pt.habitLabel(habit.title,habit.done)} accessibilityHint={pt.toggleHint(habit.done)} accessibilityState={{checked:habit.done,disabled:!state.writable}} disabled={!state.writable} onPress={()=>journey.toggle(habit.habitId,habit.done)} style={{minHeight:t.metrics.habitRow,paddingVertical:t.space.medium,gap:t.space.medium,flexDirection:'row',alignItems:'center'}}>
  <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width:t.metrics.check,height:t.metrics.check,borderRadius:t.radius.check,borderWidth:t.metrics.controlBorder,borderColor:habit.done?color:t.border.interactive,backgroundColor:habit.done?color:t.bg.elevated,alignItems:'center',justifyContent:'center'}}>{habit.done&&<Type bold style={{color:t.text.onAccent}}>✓</Type>}</View>
  <View style={{flex:1,gap:t.space.micro}}><Type>{habitGlyph(habit.iconKey)} {habit.title}</Type><Type size="caption" tone="secondary">{habit.limitReached&&habit.done?pt.xpLimit:pt.daily}</Type></View>
 </Touch>;
}
function HabitsCard({state,journey,create}:{state:JourneyState;journey:Journey;create:()=>void}) {
 const local=state.local!;
 return <Card><Type size="section" bold header>{pt.todayHabits}</Type><Type size="caption" mono tone="accent">{pt.progress(local.habits.filter(habit=>habit.done).length,local.habits.length)}</Type>
  {local.habits.map(habit=><HabitRow key={habit.habitId} habit={habit} state={state} journey={journey}/>)}<Link label={pt.newHabit} onPress={create}/>
 </Card>;
}
function NoDue() {
 return <Card><Type size="section" bold header>{pt.noDueTitle}</Type><Type tone="secondary">{pt.noDueBody}</Type></Card>;
}
function Empty({create}:{create:()=>void}) {
 const nav=useNavigation();return <Card><Type size="number">🌱</Type><Type size="section" bold header>{pt.emptyTitle}</Type><Type tone="secondary">{pt.emptyBody}</Type><Button label={pt.createHabit} onPress={create}/>
  {pt.suggestions.map(suggestion=><Link key={suggestion} label={suggestion} onPress={()=>{nav.setDraft(suggestion);create();}}/>)}
 </Card>;
}
function Footer({surface,go}:{surface:Surface;go:(surface:Surface)=>void}) {
 const t=useTheme();return <View style={{flexDirection:'row',backgroundColor:t.bg.elevated,borderTopWidth:t.metrics.border,borderTopColor:t.border.decorative,paddingHorizontal:t.space.small}}>{(['briefing','habits','settings'] as const).map(tab=><Touch accessibilityRole="tab" accessibilityLabel={pt[tab]} accessibilityState={{selected:tab===surface}} onPress={()=>go(tab)} key={tab} style={{flex:1,minHeight:t.metrics.habitRow,minWidth:t.metrics.touch,paddingVertical:t.space.medium,paddingHorizontal:t.space.micro,alignItems:'center',justifyContent:'center'}}><Type size="label" bold tone={tab===surface?'accent':'secondary'}>{pt[tab]}</Type></Touch>)}</View>;
}
function Dashboard({state,journey,surface}:{state:JourneyState;journey:Journey;surface:Surface}) {
 const nav=useNavigation(),t=useTheme(),local=state.local!,create=()=>{journey.clearError();nav.create();};
 const provider:BriefingCardProvider={id:'habits.today',module:'habits',priority:()=>100,load:async context=>context,render:data=>data.state.local!.habits.length?<HabitsCard state={data.state} journey={journey} create={data.create}/>:data.state.local!.managementHabits.length?<NoDue/>:<Empty create={data.create}/>};
 const xpProvider:BriefingCardProvider={id:'gamification.xp',module:'gamification',priority:()=>surface==='habits'?null:50,load:async context=>context,render:data=><Card><Type size="caption" mono tone="secondary">{pt.xp}</Type><Type size="number" mono bold tone="accent">{data.state.local!.totalXp.toLocaleString('pt-BR')}</Type><Type mono>{pt.todayXp}: {data.state.local!.todayXp.toLocaleString('pt-BR')}</Type><Type size="label" tone="secondary">{data.state.local!.pendingCount?pt.xpProvisional:pt.xpRule}</Type></Card>};
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:local.profile.timeContext.timezone,hour:'numeric',hourCycle:'h23'}).format(new Date(state.instant)));
 const greeting=pt.greeting(hour<12?'morning':hour<18?'afternoon':'evening',local.profile.displayName);
 const date=new Intl.DateTimeFormat('pt-BR',{timeZone:local.profile.timeContext.timezone,weekday:'long',day:'numeric',month:'long'}).format(new Date(state.instant));
 return <Page briefing footer={<Footer surface={surface} go={nav.go}/>}>
  <Type size="caption" mono tone="accent">{pt.brand} · {pt[surface==='habits'?'habits':surface==='settings'?'settings':'briefing']}</Type>
  {surface==='settings'?<><Type size="title" bold header>{pt.settings}</Type><Card><Type size="section" bold>{local.profile.displayName}</Type><Type tone="secondary">{local.profile.timeContext.timezone}</Type><Type mono>{pt.dayStart} {pt.hour(local.profile.timeContext.dayStartHour)}</Type></Card><Banner message={state.remote}/><Button label={pt.retry} secondary onPress={()=>{void journey.retry();}}/><Link label={pt.privacy} onPress={()=>nav.setPrivacy(true)}/><Button label={pt.logout} secondary onPress={()=>nav.setLogout(true)}/></>:
  <><Type size="caption" tone="secondary">{date}</Type><Type size="title" bold header>{surface==='habits'?pt.habits:greeting}</Type><Type size="caption" mono tone="secondary">{pt.logicalDay(state.day!)}</Type>
   <View style={{alignSelf:'flex-start',borderWidth:t.metrics.border,borderColor:t.border.interactive,paddingVertical:t.space.compact,paddingHorizontal:t.space.controlGap,borderRadius:t.radius.inner}}><Type size="caption" mono>{state.remote}</Type></View>
   <BriefingCards providers={[provider,xpProvider]} context={{state,create,toggle:(id,done)=>journey.toggle(id,done)}}/>

  </>}
  {state.error&&<Banner message={state.error} error/>}
  {state.remote===pt.remoteLogin&&<Button label={pt.reauth} secondary onPress={()=>nav.go('reauth')}/>}
  {state.remote===pt.vault&&<Button label={pt.retry} secondary onPress={()=>{void journey.retry();}}/>}
 </Page>;
}
function Sheets({journey}:{journey:Journey}) {
 const nav=useNavigation(),open=nav.privacy||nav.logout;
 useEffect(()=>{if(open) AccessibilityInfo.announceForAccessibility(nav.privacy?pt.privacyTitle:pt.logoutTitle);},[open,nav.privacy]);
 return <Modal visible={open} animationType="none" onRequestClose={()=>{nav.setPrivacy(false);nav.setLogout(false);}}><Page><Type size="title" bold header>{nav.privacy?pt.privacyTitle:pt.logoutTitle}</Type><Type tone="secondary">{nav.privacy?pt.privacyBody:pt.logoutBody}</Type>
  {nav.privacy?<Button label={pt.close} onPress={()=>nav.setPrivacy(false)}/>:<><Button label={pt.logout} onPress={()=>{nav.setLogout(false);void journey.logout();}}/><Button label={pt.cancel} secondary onPress={()=>nav.setLogout(false)}/></>}
 </Page></Modal>;
}
export function JourneyView({journey}:{journey:Journey}) {
 const state=useSyncExternalStore(journey.subscribe,journey.state),nav=useNavigation();
 useEffect(()=>nav.bind(state.key),[state.key,nav.bind]);
 const surface=nav.key===state.key?nav.surface:state.key?'briefing':'welcome';
 useEffect(()=>{const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
  if(['register','login','create','reauth','edit'].includes(surface)) {journey.clearError();nav.go(state.key?(surface==='edit'?'habits':surface==='create'?nav.formFrom:'briefing'):'welcome');return true;}return false;
 });return ()=>subscription.remove();},[surface,state.key,journey,nav.go]);
 let content;
 if(state.gate==='database'||state.gate==='logout') content=<Page><Type size="title" bold header>{state.gate==='database'?pt.databaseTitle:pt.logoutIncomplete}</Type><Type tone="secondary">{state.gate==='database'?pt.databaseBody:pt.logoutLocked}</Type>{state.error&&<Banner message={state.error} error/>}<Button label={state.gate==='database'?pt.retry:pt.finishLogout} busy={state.busy} onPress={()=>{void journey.retry();}}/></Page>;
 else if(state.gate==='initial') content=<Page><Type size="title" header>{pt.initialLoading}</Type><Type tone="secondary">{pt.initialHelp}</Type><Banner message={state.remote}/><Button label={pt.retry} secondary onPress={()=>{void journey.retry();}}/></Page>;
 else if(surface==='register'||surface==='login'||surface==='reauth') content=<AccountForm key={state.key} journey={journey} kind={surface==='register'?'register':'login'}/>;
 else if(state.gate==='entry') content=<Page><View style={{flex:1,justifyContent:'center'}}><Card><Type size="brand" bold header>{pt.brand}</Type><Type size="lead">{pt.welcome}</Type><Type tone="secondary">{pt.promise}</Type></Card></View><Button label={pt.register} onPress={()=>nav.go('register')}/><Button label={pt.hasAccount} secondary onPress={()=>nav.go('login')}/><Link label={pt.privacy} onPress={()=>nav.setPrivacy(true)}/></Page>;
 else if(state.local?.step==='time_context') content=<TimeForm key={state.key} journey={journey} state={state}/>;
 else if(state.local?.step==='first_habit'||surface==='create') content=<HabitForm key={state.key} journey={journey} state={state} onboarding={state.local?.step==='first_habit'}/>;
 else if(state.local&&surface==='edit') content=<HabitEditor key={state.key+':'+nav.editingId} journey={journey} state={state} habitId={nav.editingId}/>;
 else if(state.local&&surface==='habits') content=<HabitManagement key={state.key} journey={journey} state={state} footer={<Footer surface={surface} go={nav.go}/>} create={()=>{journey.clearError();nav.create();}} edit={id=>{journey.clearError();nav.edit(id);}}/>;
 else if(state.local) content=<Dashboard key={state.key} state={state} journey={journey} surface={surface}/>;
 else content=<Loading message={pt.loading}/>;
 return <>{content}<Sheets journey={journey}/></>;
}
