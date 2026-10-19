import {SyncHttpError} from '../../src/core/sync/synchronize.ts';
import {IdentityHttpError} from '../../src/core/identity/http-identity.ts';
import {useEffect} from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import SQLite from 'better-sqlite3';
import {AccessibilityInfo,Dimensions,StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider} from '../../src/theme/theme.tsx';
import {tokens} from '../../src/theme/tokens.ts';
import {BriefingCards,type BriefingCardProvider} from '../../src/features/briefing/providers.tsx';
import {Type,Touch} from '../../src/ui/primitives.tsx';
import {JourneyView} from '../../src/features/journey/screens.tsx';
import {useNavigation} from '../../src/features/journey/navigation.ts';
import {pt} from '../../src/i18n/pt-BR.ts';
import {fixture,openingFixture} from './fixture.ts';
import type {Journey} from '../../src/features/journey/journey.ts';
const mount=(f:{journey:Journey})=>render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:0,left:0,right:0,bottom:0}}}><ThemeProvider value={tokens('dark')}><JourneyView journey={f.journey}/></ThemeProvider></SafeAreaProvider>);
beforeEach(()=>{jest.useFakeTimers();useNavigation.setState({key:null,gate:null,surface:'welcome',privacy:false,logout:false,draft:'',editingId:null,formFrom:'briefing'});});
afterEach(()=>{jest.useRealTimers();});
test('offline login preserves typed values and exposes a useful connection error',async()=>{
 const f=fixture();try {
  await mount(f);await fireEvent.press(screen.getByRole('button',{name:pt.hasAccount}));
  await fireEvent.changeText(screen.getByLabelText(pt.email),'a@example.test');await fireEvent.changeText(screen.getByLabelText(pt.password),'password');
  await fireEvent.press(screen.getByRole('button',{name:pt.login}));
  expect(screen.getByLabelText(pt.email)).toHaveDisplayValue('a@example.test');expect(screen.getByLabelText(pt.password)).toHaveDisplayValue('password');
  expect(screen.getAllByText(pt.offlineAuth).length).toBeGreaterThan(0);expect(f.journey.state().local).toBeNull();
 } finally {f.close();}
});
test.each(['persisted','http'] as const)('login explains the %s update requirement without exposing the closed account',async source=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Conta preservada','reading','blue',false);
  if(source==='persisted') f.requireUpdate();
  await f.session.logout();
  if(source==='http') f.identity.login=async()=>{throw new IdentityHttpError(426,'unsupported_version');};
  const login=jest.spyOn(f.identity,'login');
  await act(()=>f.scheduler.update({active:true,online:true}));await mount(f);
  await fireEvent.press(screen.getByRole('button',{name:pt.hasAccount}));await fireEvent.changeText(screen.getByLabelText(pt.email),'a@example.test');await fireEvent.changeText(screen.getByLabelText(pt.password),'password');await fireEvent.press(screen.getByRole('button',{name:pt.login}));
  expect(screen.getByText(pt.update)).toBeOnTheScreen();expect(screen.queryByText('Conta preservada')).toBeNull();expect(f.journey.state().local).toBeNull();
  expect(screen.getByLabelText(pt.email)).toHaveDisplayValue('a@example.test');expect(screen.getByLabelText(pt.password)).toHaveDisplayValue('password');
  if(source==='persisted') expect(login).not.toHaveBeenCalled();else expect(login).toHaveBeenCalledTimes(1);
 } finally {f.close();}
});

test('the native components go through onboarding, skip, create and mark/undo using SQLite',async()=>{
 const f=fixture();try {
  await act(async()=>{await f.session.login('a@example.test','password');});await mount(f);
  await fireEvent.press(screen.getByRole('button',{name:pt.continue}));
  expect(screen.getByRole('header',{name:pt.firstHabit})).toBeOnTheScreen();await fireEvent.press(screen.getByRole('button',{name:pt.skip}));
  expect(screen.getByRole('header',{name:pt.emptyTitle})).toBeOnTheScreen();await fireEvent.press(screen.getByRole('button',{name:pt.firstHabitCreate}));
  await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Ler um capítulo');await fireEvent.press(screen.getByRole('radio',{name:pt.icons.reading}));await fireEvent.press(screen.getByRole('radio',{name:pt.colors.blue}));await fireEvent.press(screen.getByRole('button',{name:pt.createHabit}));
  await fireEvent.press(screen.getByRole('checkbox',{name:pt.habitLabel('Ler um capítulo',false)}));
  expect(screen.getByRole('checkbox',{checked:true})).toBeOnTheScreen();expect(f.journey.state().local?.totalXp).toBe(10);
  await fireEvent.press(screen.getByRole('checkbox',{checked:true}));expect(f.journey.state().local?.totalXp).toBe(0);
  await fireEvent.press(screen.getByRole('checkbox',{checked:false}));expect(f.journey.state().local?.totalXp).toBe(10);
  expect(screen.getByText(pt.totalXp(10))).toBeOnTheScreen();const creations=f.session.account().operations().filter(op=>op.command.type==='habit.create');expect(creations).toHaveLength(1);expect(creations[0]?.command).toMatchObject({iconKey:'reading',colorToken:'blue'});
 } finally {f.close();}
});
test('a durable write failure keeps the form and step and never renders a successful habit',async()=>{
 const f=fixture();let fault:SQLite.Database|undefined;try {
  await f.session.login('a@example.test','password');f.journey.confirmTime({timezone:'UTC',dayStartHour:4});await mount(f);
  fault=new SQLite(f.path());fault.exec("CREATE TRIGGER fail_component BEFORE INSERT ON projected_views BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Meditar');await fireEvent.press(screen.getByRole('button',{name:pt.firstHabitAction}));
  expect(screen.getByLabelText(pt.habitName)).toHaveDisplayValue('Meditar');expect(screen.getByText(pt.localFailure)).toBeOnTheScreen();expect(f.journey.state().local?.step).toBe('first_habit');expect(f.journey.state().local?.habits).toHaveLength(0);
  fault.exec('DROP TRIGGER fail_component');await fireEvent.press(screen.getByRole('button',{name:pt.firstHabitAction}));expect(screen.getByRole('checkbox',{checked:false})).toBeOnTheScreen();
 } finally {fault?.close();f.close();}
});
test('logout fences the rendered account immediately; login B never renders A data',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.confirmTime({timezone:'UTC',dayStartHour:4});f.journey.create('Hábito de A','reading','blue',true);await mount(f);
  expect(screen.getByRole('checkbox',{name:pt.habitLabel('Hábito de A',false)})).toBeOnTheScreen();
  await act(()=>f.session.logout());expect(screen.queryByText('Hábito de A')).toBeNull();
  await act(()=>f.session.login('b@example.test','password'));await act(()=>{f.journey.confirmTime({timezone:'UTC',dayStartHour:4});f.journey.skip();});
  await waitFor(()=>expect(screen.getByRole('header',{name:pt.emptyTitle})).toBeOnTheScreen());expect(screen.queryByText(/Hábito de A/)).toBeNull();expect(f.journey.state().local?.totalXp).toBe(0);
 } finally {f.close();}
});
test('privacy is a full accessible action before registration and its sheet closes',async()=>{
 const announcement=jest.spyOn(AccessibilityInfo,'announceForAccessibility'),f=fixture();try {
  await mount(f);await fireEvent.press(screen.getByRole('button',{name:pt.register}));
  await fireEvent.press(screen.getByRole('button',{name:pt.registrationNoticeLabel}));expect(screen.getAllByRole('header',{name:pt.privacyTitle})).toHaveLength(1);expect(announcement).not.toHaveBeenCalledWith(pt.privacyTitle);
  await fireEvent.press(screen.getByRole('button',{name:pt.close}));expect(screen.queryByRole('header',{name:pt.privacyTitle})).toBeNull();expect(screen.getByLabelText(pt.name)).toBeOnTheScreen();
 } finally {announcement.mockRestore();f.close();}
});

test('a confirmed daily XP limit keeps the checkbox done and shows no partial prize',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.confirmTime({timezone:'UTC',dayStartHour:4});f.journey.create('Ler','reading','blue',true);
  const habit=f.journey.state().local!.habits[0]!,day=f.journey.state().day!;
  f.session.account().applyPull({changes:[{revision:'1',operationResults:[],entities:[
   {kind:'habitDay',value:{habitDayId:'01996300-0000-7000-8000-000000000300',habitId:habit.habitId,dayKey:day,done:true,knownUndoIds:[],revision:'1'}},
   {kind:'xpDecision',value:{habitDayId:'01996300-0000-7000-8000-000000000300',outcome:'limit_reached',grantId:null,revision:'1'}},
  ]}],nextCursor:'cursor',hasMore:false,highWaterRevision:'1',serverTime:'2026-10-09T13:00:00Z'});
  await mount(f);expect(screen.getByRole('checkbox',{checked:true})).toBeOnTheScreen();expect(screen.getByText(pt.xpLimit)).toBeOnTheScreen();expect(f.journey.state().local?.totalXp).toBe(0);
 } finally {f.close();}
});

test('a committed local projection updates controls without a loading swap or lost native identity',async()=>{
 const f=fixture();let unmounts=0;try {
  function Control({writable}:{writable:boolean}) {
   useEffect(()=>()=>{unmounts++;},[]);
   return <Touch style={{minHeight:tokens('dark').metrics.touch}} accessibilityRole="checkbox" accessibilityLabel={pt.habitName} accessibilityState={{disabled:!writable,checked:false}} disabled={!writable}><Type>{pt.habitName}</Type></Touch>;
  }
  const provider:BriefingCardProvider={id:'local',module:'habits',priority:()=>100,render:ctx=><Control writable={ctx.state.writable}/>};
  const context={state:{...f.journey.state(),writable:true},create:()=>{},toggle:()=>{}};
  const view=(state:typeof context.state)=><ThemeProvider value={tokens('dark')}><BriefingCards providers={[provider]} context={{...context,state}}/></ThemeProvider>;
  const result=await render(view(context.state));
  expect(screen.getByRole('checkbox')).not.toBeDisabled();
  await result.rerender(view({...context.state,writable:false,instant:context.state.instant+1}));
  expect(screen.getByRole('checkbox')).toBeDisabled();expect(screen.queryByText(pt.loading)).toBeNull();expect(unmounts).toBe(0);
 } finally {f.close();}
});

test('failing local rendering and async loading stay inside their own Briefing cards',async()=>{
 const f=fixture(),expectedError=jest.spyOn(console,'error').mockImplementation(()=>{});try {
  const providers:BriefingCardProvider[]=[
   {id:'broken',module:'habits',priority:()=>100,load:async()=>{throw new Error('fixture_provider_failure');},render:()=>null},
   {id:'broken-local',module:'habits',priority:()=>75,render:()=>{throw new Error('fixture_render_failure');}},
   {id:'xp',module:'gamification',priority:()=>50,render:()=> <Type>{pt.xp}</Type>},
  ];
  await render(<ThemeProvider value={tokens('dark')}><BriefingCards providers={providers} context={{state:f.journey.state(),create:()=>{},toggle:()=>{}}}/></ThemeProvider>);
  expect(await screen.findByText(pt.xp)).toBeOnTheScreen();expect(screen.getAllByText(pt.genericError)).toHaveLength(2);
 } finally {expectedError.mockRestore();f.close();}
});

test('management edits only changed fields; failed save preserves the draft and delete cancellation never writes',async()=>{
 const f=fixture();let fault:SQLite.Database|undefined;try {
  await f.session.login('a@example.test','password');f.journey.confirmTime({timezone:'UTC',dayStartHour:4});f.journey.create('Ler','reading','blue',true);const id=f.journey.state().local!.habits[0]!.habitId;f.journey.toggle(id,false);await mount(f);
  await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));await fireEvent.press(screen.getByRole('button',{name:pt.editLabel('Ler')}));
  await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Ler mais');
  fault=new SQLite(f.path());fault.exec("CREATE TRIGGER fail_edit BEFORE INSERT ON projected_views BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await fireEvent.press(screen.getByRole('button',{name:pt.saveHabit}));expect(screen.getByLabelText(pt.habitName)).toHaveDisplayValue('Ler mais');expect(screen.getByText(pt.localFailure)).toBeOnTheScreen();expect(f.journey.state().local?.habits[0]?.title).toBe('Ler');
  fault.exec('DROP TRIGGER fail_edit');await fireEvent.press(screen.getByRole('button',{name:pt.saveHabit}));expect(screen.getByRole('button',{name:pt.editLabel('Ler mais')})).toBeOnTheScreen();expect(f.session.account().operations().at(-1)?.command).toMatchObject({type:'habit.patchMetadata',patch:{title:'Ler mais'}});
  await fireEvent.press(screen.getByRole('button',{name:pt.editLabel('Ler mais')}));await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Ler depois');await fireEvent.press(screen.getByRole('button',{name:pt.deleteHabit}));expect(screen.getByText(pt.deleteBody)).toBeOnTheScreen();expect(screen.queryByLabelText(pt.habitName)).toBeNull();const before=f.session.account().operations();await fireEvent.press(screen.getByRole('button',{name:pt.cancel}));expect(screen.getByLabelText(pt.habitName)).toHaveDisplayValue('Ler depois');expect(f.session.account().operations()).toEqual(before);expect(f.journey.state().local?.totalXp).toBe(10);
 } finally {fault?.close();f.close();}
});
test('delete failure retains confirmation and data; retry deletes durably and returns useful management empty state',async()=>{
 const f=fixture();let fault:SQLite.Database|undefined;try {
  await f.session.login('a@example.test','password');f.journey.confirmTime({timezone:'UTC',dayStartHour:4});f.journey.create('Ler','reading','blue',true);f.journey.toggle(f.journey.state().local!.habits[0]!.habitId,false);await mount(f);
  await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));await fireEvent.press(screen.getByRole('button',{name:pt.editLabel('Ler')}));await fireEvent.press(screen.getByRole('button',{name:pt.deleteHabit}));
  fault=new SQLite(f.path());fault.exec("CREATE TRIGGER fail_delete BEFORE INSERT ON projected_views BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await fireEvent.press(screen.getByRole('button',{name:pt.deleteHabit}));expect(screen.getByRole('header',{name:pt.deleteTitle})).toBeOnTheScreen();expect(screen.getByText(pt.localFailure)).toBeOnTheScreen();expect(f.journey.state().local?.totalXp).toBe(10);
  fault.exec('DROP TRIGGER fail_delete');await fireEvent.press(screen.getByRole('button',{name:pt.deleteHabit}));expect(screen.getByRole('header',{name:pt.emptyManagement})).toBeOnTheScreen();expect(f.journey.state().local?.totalXp).toBe(0);
 } finally {fault?.close();f.close();}
});
test('order controls change the same Briefing and compatibility disables management writes',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.confirmTime({timezone:'UTC',dayStartHour:4});f.journey.create('Ler','reading','blue',true);f.journey.create('Meditar','meditation','accent',false);await mount(f);
  await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));expect(screen.getByRole('button',{name:pt.moveLabel('Ler',-1)})).toBeDisabled();expect(screen.getByRole('button',{name:pt.moveLabel('Meditar',1)})).toBeDisabled();await fireEvent.press(screen.getByRole('button',{name:pt.moveLabel('Meditar',-1)}));
  await fireEvent.press(screen.getByRole('tab',{name:pt.briefing}));await waitFor(()=>expect(screen.getAllByRole('checkbox').map(item=>item.props.accessibilityLabel)).toEqual([pt.habitLabel('Meditar',false),pt.habitLabel('Ler',false)]));
  await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));await act(()=>f.requireUpdate());expect(screen.getByRole('button',{name:pt.newHabit})).toBeDisabled();expect(screen.getByRole('button',{name:pt.editLabel('Ler')})).toBeDisabled();expect(screen.getByRole('button',{name:pt.moveLabel('Ler',-1)})).toBeDisabled();
 } finally {f.close();}
});
test('switching accounts while a destructive confirmation is open fences the modal and its previous habit',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.confirmTime({timezone:'UTC',dayStartHour:4});f.journey.create('Conta A','reading','blue',true);await mount(f);await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));await fireEvent.press(screen.getByRole('button',{name:pt.editLabel('Conta A')}));await fireEvent.press(screen.getByRole('button',{name:pt.deleteHabit}));
  await act(()=>f.session.logout());expect(screen.queryByRole('header',{name:pt.deleteTitle})).toBeNull();expect(screen.queryByText('Conta A')).toBeNull();await act(()=>f.session.login('b@example.test','password'));expect(f.journey.state().local?.habits).toHaveLength(0);
 } finally {f.close();}
});


test('Briefing distinguishes no due habits from no habits; management can edit a future start',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.skip();const store=f.session.account();
  store.applyPull({changes:[{revision:'1',operationResults:[],entities:[{kind:'habit',value:{habitId:'01996300-0000-7000-8000-000000000301',title:'Amanhã',habitType:'binary',scheduleKind:'daily',startDayKey:'2026-10-10',creationTimeContext:{timezone:'UTC',dayStartHour:4},iconKey:'reading',colorToken:'blue',sortOrder:0,createdAt:'2026-10-09T13:00:00Z',updatedAt:'2026-10-09T13:00:00Z',deletedAt:null,revision:'1'}}]}],nextCursor:'cursor',hasMore:false,highWaterRevision:'1',serverTime:'2026-10-09T13:00:00Z'});
  await mount(f);expect(screen.getByRole('header',{name:pt.noDueTitle})).toBeOnTheScreen();expect(screen.queryByRole('header',{name:pt.emptyTitle})).toBeNull();expect(screen.queryByRole('checkbox')).toBeNull();
  await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));await fireEvent.press(screen.getByRole('button',{name:pt.editLabel('Amanhã')}));
  expect(screen.getByLabelText(pt.habitName)).toHaveDisplayValue('Amanhã');await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Próximo dia');await fireEvent.press(screen.getByRole('button',{name:pt.saveHabit}));
  expect(screen.getByRole('button',{name:pt.editLabel('Próximo dia')})).toBeOnTheScreen();expect(f.journey.state().local?.habits).toHaveLength(0);
 } finally {f.close();}
});


test('Briefing at 200% summarizes the update requirement while preserving the read-only gate and local work',async()=>{
 const readDimensions=Dimensions.get.bind(Dimensions),dimensions=jest.spyOn(Dimensions,'get').mockImplementation(kind=>({...readDimensions(kind),width:390,height:844,fontScale:2})),f=fixture();
 try {
  await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Consulta preservada','reading','blue',false);const id=f.journey.state().local!.habits[0]!.habitId;f.journey.toggle(id,false);
  const queue=f.session.account().operations(),metadata=f.journey.state().local!.managementHabits;
  const expectReadable=(text:string)=>{let node:ReturnType<typeof screen.getByText>|null=screen.getByText(text);let opacity=1;while(node){opacity*=StyleSheet.flatten(node.props.style)?.opacity??1;node=node.parent;}expect(opacity).toBe(1);};
  f.requireUpdate();await mount(f);
  expect(f.journey.state()).toMatchObject({remote:pt.update,writable:false});expect(screen.getAllByText(pt.update)).toHaveLength(1);expect(screen.getByText(pt.updateCompact)).toBeOnTheScreen();
  const habit=screen.getByRole('checkbox',{name:pt.habitLabel('Consulta preservada',true)});expect(habit).toBeDisabled();expect(habit.props.accessibilityState).toMatchObject({disabled:true,checked:true});
  expectReadable('Consulta preservada');expectReadable('📖');expectReadable(pt.operationStates.pending);
  expect(habit.queryAll(node=>StyleSheet.flatten(node.props.style)?.opacity===tokens('dark').metrics.disabledOpacity).length).toBeGreaterThan(0);await fireEvent.press(habit);
  await fireEvent.press(screen.getByRole('button',{name:pt.syncPillLabel(pt.update)}));expect(screen.getByRole('header',{name:pt.syncTitle})).toBeOnTheScreen();expect(screen.getByText(pt.update)).toBeOnTheScreen();await fireEvent.press(screen.getByRole('button',{name:pt.close}));
  await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));expect(screen.getByRole('button',{name:pt.newHabit})).toBeDisabled();const edit=screen.getByRole('button',{name:pt.editLabel('Consulta preservada')});expect(edit).toBeDisabled();expect(edit.props.accessibilityState).toMatchObject({disabled:true});
  expectReadable('Consulta preservada');expectReadable('📖');expectReadable(pt.managementHabitCaption);expectReadable(pt.operationStates.pending);
  expect(screen.getByText(pt.symbols.chevron)).toHaveStyle({opacity:tokens('dark').metrics.disabledOpacity});
  await fireEvent.press(edit);await fireEvent.press(screen.getByRole('button',{name:pt.newHabit}));
  for(const direction of [-1,1] as const){const move=screen.getByRole('button',{name:pt.moveLabel('Consulta preservada',direction)});expect(move).toBeDisabled();await fireEvent.press(move);}
  expect(screen.queryByLabelText(pt.habitName)).toBeNull();
  await act(()=>{expect(f.journey.create('Bloqueado','reading','blue',false)).toBe(false);});
  expect(f.journey.state()).toMatchObject({remote:pt.update,writable:false});expect(f.session.account().operations()).toEqual(queue);expect(f.journey.state().local?.totalXp).toBe(10);expect(f.journey.state().local?.managementHabits).toEqual(metadata);
 } finally {dimensions.mockRestore();f.close();}
});

test('Briefing at 200% keeps the full vault notice and actionable sync summary without changing local work',async()=>{
 const readDimensions=Dimensions.get.bind(Dimensions),dimensions=jest.spyOn(Dimensions,'get').mockImplementation(kind=>({...readDimensions(kind),width:390,height:844,fontScale:2})),f=fixture();
 try {
  await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Local preservado','reading','blue',false);f.journey.toggle(f.journey.state().local!.habits[0]!.habitId,false);
  const queue=f.session.account().operations(),read=f.vault.get;f.vault.get=async()=>{throw new Error('private_keychain_error');};await f.session.retryVault();await mount(f);
  expect(f.journey.state()).toMatchObject({remote:pt.vault,vaultUnavailable:true,writable:true});
  expect(screen.getAllByText(pt.vault)).toHaveLength(1);expect(screen.getByText(pt.vaultCompact)).toBeOnTheScreen();expect(screen.getByRole('button',{name:pt.retryVault})).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button',{name:pt.syncPillLabel(pt.vault)}));expect(screen.getByRole('header',{name:pt.syncTitle})).toBeOnTheScreen();expect(screen.getByText(pt.vault)).toBeOnTheScreen();
  expect(f.session.account().operations()).toEqual(queue);expect(f.journey.state().local?.totalXp).toBe(10);
  await fireEvent.press(screen.getByRole('button',{name:pt.close}));f.vault.get=read;await fireEvent.press(screen.getByRole('button',{name:pt.retryVault}));
  await waitFor(()=>expect(screen.queryByText(pt.vaultCompact)).toBeNull());expect(f.journey.state().vaultUnavailable).toBe(false);expect(f.session.account().operations()).toEqual(queue);expect(f.journey.state().local?.totalXp).toBe(10);
 } finally {dimensions.mockRestore();f.close();}
});

test('vault pause is actionable in management and creation while local writing continues',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Local preservado','reading','blue',false);
  const read=f.vault.get;f.vault.get=async()=>{throw new Error('private_keychain_error');};await f.session.retryVault();await mount(f);
  await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));expect(screen.getByRole('button',{name:'Retomar acesso remoto'})).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button',{name:pt.newHabit}));expect(screen.getByRole('button',{name:'Retomar acesso remoto'})).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Criado sem cofre');await fireEvent.press(screen.getByRole('button',{name:pt.createHabit}));
  expect(screen.getByRole('button',{name:pt.editLabel('Criado sem cofre')})).toBeOnTheScreen();f.vault.get=read;
  await fireEvent.press(screen.getByRole('button',{name:'Retomar acesso remoto'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'Retomar acesso remoto'})).toBeNull());
  expect(screen.getByRole('button',{name:pt.editLabel('Local preservado')})).toBeOnTheScreen();expect(f.session.account().operations().some(op=>op.command.type==='habit.create'&&op.command.title==='Criado sem cofre')).toBe(true);
 } finally {f.close();}
});


test('account opening failure shows a safe diagnosis and retry preserves pending work',async()=>{
 const f=await openingFixture();try {
  await f.owner.session.login('a@example.test','password');f.journey.skip();f.journey.create('Preservado','reading','blue',false);f.journey.toggle(f.journey.state().local!.habits[0]!.habitId,false);
  const queue=f.owner.session.account().operations();f.fault('account');f.owner.session.close();await f.owner.session.restore();await mount(f);
  expect(screen.getByRole('header',{name:'Não foi possível abrir os dados desta conta.'})).toBeOnTheScreen();expect(screen.queryByText('Preservado')).toBeNull();
  await fireEvent.press(screen.getByRole('button',{name:'Ver diagnóstico'}));expect(screen.getByText('Código: local_open_failed')).toBeOnTheScreen();expect(screen.queryByText(/private_path_and_credential/)).toBeNull();
  await fireEvent.press(screen.getByRole('button',{name:'Tentar abrir novamente'}));expect(screen.queryByText('Preservado')).toBeNull();
  f.fault(null);await fireEvent.press(screen.getByRole('button',{name:'Tentar abrir novamente'}));await waitFor(()=>expect(screen.getByRole('checkbox',{name:pt.habitLabel('Preservado',true)})).toBeOnTheScreen());
  expect(f.owner.session.account().operations()).toEqual(queue);expect(f.journey.state().local?.totalXp).toBe(10);
 } finally {f.close();}
});


test('incomplete logout fences old routes and sheets until credential cleanup succeeds',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Somente A','reading','blue',false);const queue=f.session.account().operations();await mount(f);
  const remove=f.vault.remove;f.vault.remove=async()=>{throw new Error('private_remove_failure');};
  await fireEvent.press(screen.getByRole('tab',{name:pt.settings}));await fireEvent.press(screen.getByRole('button',{name:pt.logout}));await fireEvent.press(screen.getByRole('button',{name:pt.logout}));
  expect(screen.getByRole('header',{name:pt.logoutIncomplete})).toBeOnTheScreen();expect(screen.queryByText('Somente A')).toBeNull();
  await act(()=>{useNavigation.getState().go('edit');useNavigation.getState().setPrivacy(true);});
  expect(screen.queryByRole('header',{name:pt.privacyTitle})).toBeNull();expect(screen.queryByRole('button',{name:pt.register})).toBeNull();
  f.vault.remove=remove;await fireEvent.press(screen.getByRole('button',{name:pt.finishLogout}));await waitFor(()=>expect(screen.getByRole('button',{name:pt.register})).toBeOnTheScreen());
  await act(()=>f.session.login('b@example.test','password'));await act(()=>f.journey.skip());expect(screen.queryByText('Somente A')).toBeNull();
  await act(()=>f.session.logout());await act(()=>f.session.login('a@example.test','password'));expect(f.session.account().operations()).toEqual(queue);expect(screen.getByRole('checkbox',{name:pt.habitLabel('Somente A',false)})).toBeOnTheScreen();
 } finally {f.close();}
});


test('installation failure prevents login and retry opens only after control becomes healthy',async()=>{
 const f=await openingFixture('installation');try {
  await mount(f);expect(screen.getByRole('header',{name:pt.databaseInstallationTitle})).toBeOnTheScreen();expect(screen.queryByRole('button',{name:pt.register})).toBeNull();
  await fireEvent.press(screen.getByRole('button',{name:pt.retryDatabase}));expect(screen.getByRole('header',{name:pt.databaseInstallationTitle})).toBeOnTheScreen();
  f.fault(null);await fireEvent.press(screen.getByRole('button',{name:pt.retryDatabase}));await waitFor(()=>expect(screen.getByRole('button',{name:pt.register})).toBeOnTheScreen());expect(f.journey.state().local).toBeNull();
 } finally {f.close();}
});

test('expired remote authentication remains local and only the same online account can reauthenticate',async()=>{
 const readDimensions=Dimensions.get.bind(Dimensions),dimensions=jest.spyOn(Dimensions,'get').mockImplementation(kind=>({...readDimensions(kind),width:390,height:844,fontScale:2})),f=await openingFixture();try {
  const login=f.identity.login;f.identity.login=async(...args)=>({...await login(...args),accessExpiresAt:'2000-01-01T00:00:00Z'});
  await f.owner.session.login('a@example.test','password');f.journey.skip();f.journey.create('Ainda local','reading','blue',false);await mount(f);
  await act(async()=>{f.scheduler.update({active:true,online:true});});await waitFor(()=>expect(f.journey.state().remote).toBe(pt.remoteLogin));
  expect(screen.getByText(pt.remoteLoginCompact)).toBeOnTheScreen();expect(screen.getAllByText(pt.remoteLogin)).toHaveLength(1);expect(screen.getByRole('button',{name:pt.syncPillLabel(pt.remoteLogin)})).toBeOnTheScreen();expect(f.journey.state()).toMatchObject({authenticationRequired:true,writable:true});
  await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));await fireEvent.press(screen.getByRole('button',{name:pt.reauth}));expect(screen.getByRole('header',{name:pt.reauth})).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText(pt.email),'a@example.test');await fireEvent.changeText(screen.getByLabelText(pt.password),'password');await act(()=>f.scheduler.update({active:false,online:false}));
  await fireEvent.press(screen.getByRole('button',{name:pt.login}));expect(screen.getByLabelText(pt.email)).toHaveDisplayValue('a@example.test');expect(screen.getByLabelText(pt.password)).toHaveDisplayValue('password');
  f.identity.login=login;await act(()=>f.scheduler.update({active:false,online:true}));await fireEvent.changeText(screen.getByLabelText(pt.email),'b@example.test');await fireEvent.press(screen.getByRole('button',{name:pt.login}));expect(screen.getByText('Entre na mesma conta para recuperar a conexão. Para usar outra conta, saia primeiro.')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText(pt.email),'a@example.test');await fireEvent.press(screen.getByRole('button',{name:pt.login}));await waitFor(()=>expect(screen.getByRole('checkbox',{name:pt.habitLabel('Ainda local',false)})).toBeOnTheScreen());expect(f.owner.session.account().operations().some(op=>op.command.type==='habit.create'&&op.command.title==='Ainda local')).toBe(true);
 } finally {dimensions.mockRestore();f.close();}
});

test('a vault write failure during new login cannot activate an account and retry keeps typed fields',async()=>{
 const f=fixture();try {
  f.scheduler.update({active:false,online:true});const write=f.vault.set;f.vault.set=async()=>{throw new Error('private_vault_write_failure');};await mount(f);
  await fireEvent.press(screen.getByRole('button',{name:pt.hasAccount}));await fireEvent.changeText(screen.getByLabelText(pt.email),'a@example.test');await fireEvent.changeText(screen.getByLabelText(pt.password),'password');
  await fireEvent.press(screen.getByRole('button',{name:pt.login}));expect(f.journey.state().local).toBeNull();expect(screen.queryByRole('tab',{name:pt.habits})).toBeNull();expect(screen.getAllByText(pt.vaultLocked).length).toBeGreaterThan(0);expect(screen.getByLabelText(pt.email)).toHaveDisplayValue('a@example.test');
  f.vault.set=write;await fireEvent.press(screen.getByRole('button',{name:pt.retryVault}));expect(screen.getByLabelText(pt.password)).toHaveDisplayValue('password');expect(f.journey.state().local).toBeNull();
  await fireEvent.press(screen.getByRole('button',{name:pt.login}));await waitFor(()=>expect(screen.getByLabelText(pt.onboarding)).toBeOnTheScreen());
 } finally {f.close();}
});

import {operationHash} from '../../src/core/sync/operation-hash.ts';
test('sync review corrects a proven rejection and never offers discard for uncertain identity',async()=>{
 const f=openingFixture();const x=await f;try {
  await act(async()=>{await x.owner.session.login('a@example.test','password');x.journey.skip();x.journey.create('Recusado','reading','blue',false);});
  const store=x.owner.session.account(),parent=store.operations().find(op=>op.command.type==='habit.create')!;
  await act(async()=>{store.applyAck([{receipt:{operationId:parent.operationId,operationHash:operationHash(parent),status:'rejected',error:{code:'title_unavailable',fields:[],dependencyIds:[]}},replayed:false}]);});
  await mount(x);await fireEvent.press(screen.getByRole('button',{name:/^Sincronização: /}));await fireEvent.press(screen.getByRole('button',{name:pt.reviewChanges}));
  await fireEvent.press(screen.getByRole('button',{name:pt.reviewOperation('Criar hábito · Recusado')}));
  expect(screen.getByText(pt.rejectionReasons.title_unavailable)).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Corrigido');
  await fireEvent.press(screen.getByRole('button',{name:pt.correctOperation}));
  expect(x.journey.state().local?.habits[0]?.title).toBe('Corrigido');
  const replacement=store.operations().find(op=>op.supersedesOperationId===parent.operationId)!;
  await act(async()=>{store.applyAck([{receipt:{operationId:replacement.operationId,status:'accepted',acceptedRevision:'1'},replayed:false}]);});
  await fireEvent.press(screen.getByRole('button',{name:pt.reviewOperation('Criar hábito · Corrigido')}));
  expect(screen.getByText(pt.uncertainBody)).toBeOnTheScreen();
  expect(screen.queryByRole('button',{name:pt.discardOperation})).toBeNull();expect(screen.queryByRole('button',{name:pt.correctOperation})).toBeNull();
 } finally {x.close();}
});

test('canceling a proposed discard preserves the original and requires a fresh explicit confirmation',async()=>{
 const f=fixture();try {
  await act(async()=>{await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Cancelar descarte','reading','blue',false);});
  const store=f.session.account(),parent=store.operations().find(op=>op.command.type==='habit.create')!;
  await act(async()=>{store.applyAck([{receipt:{operationId:parent.operationId,operationHash:operationHash(parent),status:'rejected',error:{code:'title_unavailable',fields:[],dependencyIds:[]}},replayed:false}]);});
  await mount(f);await fireEvent.press(screen.getByRole('button',{name:/^Sincronização: /}));await fireEvent.press(screen.getByRole('button',{name:pt.reviewChanges}));await fireEvent.press(screen.getByRole('button',{name:pt.reviewOperation('Criar hábito · Cancelar descarte')}));
  await fireEvent.press(screen.getByRole('button',{name:pt.discardOperation}));expect(screen.getByText(pt.discardHelp)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button',{name:pt.close}));expect(store.recovery()[0]?.resolution).toBeNull();expect(store.recovery()[0]?.operation).toEqual(parent);
  await fireEvent.press(screen.getByRole('button',{name:pt.reviewOperation('Criar hábito · Cancelar descarte')}));expect(screen.queryByRole('button',{name:pt.discardConfirm})).toBeNull();expect(screen.getByRole('button',{name:pt.discardOperation})).toBeOnTheScreen();
 } finally {f.close();}
});

test('discard confirms only the selected rejection, preserves its child, and read-only update disables correction fields',async()=>{
 const f=fixture();try {
  await act(async()=>{await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Pai','reading','blue',false);});
  const store=f.session.account(),parent=store.operations().find(op=>op.command.type==='habit.create')!;
  const child=store.enqueue({type:'habit.delete',habitId:parent.command.type==='habit.create'?parent.command.habitId:' '},'01996300-0000-7000-8000-000000001500','2026-10-09T13:00:00Z');
  await act(async()=>{store.applyAck([{receipt:{operationId:parent.operationId,operationHash:operationHash(parent),status:'rejected',error:{code:'title_unavailable',fields:[],dependencyIds:[]}},replayed:false}]);});
  await mount(f);await fireEvent.press(screen.getByRole('button',{name:/^Sincronização: /}));await fireEvent.press(screen.getByRole('button',{name:pt.reviewChanges}));await fireEvent.press(screen.getByRole('button',{name:pt.reviewOperation('Criar hábito · Pai')}));
  await fireEvent.press(screen.getByRole('button',{name:pt.discardOperation}));expect(store.recovery().find(r=>r.operation.operationId===parent.operationId)?.resolution).toBeNull();
  await fireEvent.press(screen.getByRole('button',{name:pt.discardConfirm}));
  expect(store.recovery().find(r=>r.operation.operationId===parent.operationId)?.resolution?.kind).toBe('discarded');expect(store.recovery().find(r=>r.operation.operationId===child.operationId)?.resolution).toBeNull();
  await fireEvent.press(screen.getByRole('button',{name:pt.back}));await act(async()=>{f.requireUpdate();});await fireEvent.press(screen.getByRole('button',{name:/^Sincronização: /}));await fireEvent.press(screen.getByRole('button',{name:pt.reviewChanges}));
  expect(screen.getByText(pt.update)).toBeOnTheScreen();await fireEvent.press(screen.getByRole('button',{name:pt.reviewOperation('Excluir hábito')}));
  expect(screen.getByRole('button',{name:pt.correctOperation})).toBeDisabled();expect(screen.getByRole('button',{name:pt.discardOperation})).toBeDisabled();
 } finally {f.close();}
});

test('a failed correction preserves typed fields and unresolved intent; repeated refresh announces no new result',async()=>{
 const f=fixture();let db:SQLite.Database|undefined;try {
  await act(async()=>{await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Recusado','reading','blue',false);});
  const store=f.session.account(),parent=store.operations().find(op=>op.command.type==='habit.create')!;
  await act(async()=>{store.applyAck([{receipt:{operationId:parent.operationId,operationHash:operationHash(parent),status:'rejected',error:{code:'title_unavailable',fields:[],dependencyIds:[]}},replayed:false}]);});
  const announce=jest.spyOn(AccessibilityInfo,'announceForAccessibility');await mount(f);
  await fireEvent.press(screen.getByRole('button',{name:/^Sincronização: /}));await fireEvent.press(screen.getByRole('button',{name:pt.reviewChanges}));await fireEvent.press(screen.getByRole('button',{name:pt.reviewOperation('Criar hábito · Recusado')}));
  await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Campos preservados');db=new SQLite(f.path());db.exec("create trigger fail_correction before insert on sync_mutations begin select raise(abort,'controlled_storage_failure'); end");
  await fireEvent.press(screen.getByRole('button',{name:pt.correctOperation}));expect(screen.getByLabelText(pt.habitName)).toHaveDisplayValue('Campos preservados');expect(screen.getByText(pt.localFailure)).toBeOnTheScreen();expect(store.recovery()[0]?.resolution).toBeNull();
  const count=announce.mock.calls.length;await act(async()=>{f.journey.refresh();f.journey.refresh();});expect(announce.mock.calls.length).toBe(count);
  db.exec('drop trigger fail_correction');await fireEvent.press(screen.getByRole('button',{name:pt.correctOperation}));expect(f.journey.state().local?.habits[0]?.title).toBe('Campos preservados');announce.mockRestore();
 } finally {db?.close();f.close();}
});


test('first habit suggestions stay simple, retain a draft when revisiting time, and keep all day-start hours available',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');await mount(f);
  await fireEvent.press(screen.getByRole('button',{name:pt.otherHours}));await fireEvent.press(screen.getByRole('radio',{name:pt.hour(23)}));await fireEvent.changeText(screen.getByLabelText(pt.timezone),'America/Sao_Paulo');await fireEvent.press(screen.getByRole('button',{name:pt.continue}));
  expect(screen.queryByRole('radio')).toBeNull();expect(screen.queryByText(pt.icon)).toBeNull();
  await fireEvent.press(screen.getByRole('button',{name:pt.suggestionLabel('Ler 20 páginas','📖')}));await fireEvent.press(screen.getByRole('button',{name:pt.back}));
  expect(screen.getByLabelText(pt.timezone)).toHaveDisplayValue('America/Sao_Paulo');expect(screen.getByRole('radio',{name:pt.hour(23),checked:true})).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button',{name:pt.continue}));expect(screen.getByLabelText(pt.habitName)).toHaveDisplayValue('Ler 20 páginas');
  const longTitle='L'.repeat(120);await fireEvent.changeText(screen.getByLabelText(pt.habitName),longTitle);await fireEvent.press(screen.getByRole('button',{name:pt.firstHabitAction}));
  expect(f.journey.state().local?.habits[0]).toMatchObject({title:longTitle,iconKey:'reading',colorToken:'accent'});
 } finally {f.close();}
});
test('the current catalogue creates source metadata while title-only editing preserves legacy icon and color',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Legado','walking','green',false);await mount(f);await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));
  await fireEvent.press(screen.getByRole('button',{name:pt.editLabel('Legado')}));expect(screen.getByRole('radio',{name:pt.icons.walking,checked:true})).toBeOnTheScreen();expect(screen.getByRole('radio',{name:pt.colors.green,checked:true})).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Legado preservado');await fireEvent.press(screen.getByRole('button',{name:pt.saveHabit}));expect(f.journey.state().local?.managementHabits[0]).toMatchObject({iconKey:'walking',colorToken:'green'});
  await fireEvent.press(screen.getByRole('button',{name:pt.editLabel('Legado preservado')}));await fireEvent.press(screen.getByRole('radio',{name:pt.icons.noPhone}));await fireEvent.press(screen.getByRole('radio',{name:pt.colors.magenta}));await fireEvent.press(screen.getByRole('button',{name:pt.saveHabit}));expect(f.journey.state().local?.managementHabits[0]).toMatchObject({iconKey:'noPhone',colorToken:'magenta'});
  await act(async()=>{f.session.close();await f.session.restore();});await waitFor(()=>expect(screen.getByRole('button',{name:pt.editLabel('Legado preservado')})).toBeOnTheScreen());expect(f.journey.state().local?.managementHabits[0]).toMatchObject({iconKey:'noPhone',colorToken:'magenta'});
  await fireEvent.press(screen.getByRole('button',{name:pt.newHabit}));expect(screen.queryByRole('radio',{name:pt.icons.walking})).toBeNull();expect(screen.queryByRole('radio',{name:pt.colors.green})).toBeNull();
  await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Sem celular');await fireEvent.press(screen.getByRole('radio',{name:pt.icons.noPhone}));await fireEvent.press(screen.getByRole('radio',{name:pt.colors.magenta}));await fireEvent.press(screen.getByRole('button',{name:pt.createHabit}));expect(f.journey.state().local?.managementHabits[1]).toMatchObject({iconKey:'noPhone',colorToken:'magenta'});
 } finally {f.close();}
});


test('management keeps confirmed rows compact while pending and refused intentions remain explicit',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.skip();const store=f.session.account();
  store.applyPull({changes:[{revision:'1',operationResults:[],entities:[{kind:'habit',value:{habitId:'01996300-0000-7000-8000-000000000301',title:'Confirmado',habitType:'binary',scheduleKind:'daily',startDayKey:'2026-10-09',creationTimeContext:{timezone:'UTC',dayStartHour:4},iconKey:'reading',colorToken:'blue',sortOrder:0,createdAt:'2026-10-09T13:00:00Z',updatedAt:'2026-10-09T13:00:00Z',deletedAt:null,revision:'1'}}]}],nextCursor:'cursor',hasMore:false,highWaterRevision:'1',serverTime:'2026-10-09T13:00:00Z'});
  f.journey.create('Pendente','meditation','accent',false);await mount(f);await fireEvent.press(screen.getByRole('tab',{name:pt.habits}));
  expect(screen.getByRole('button',{name:pt.editLabel('Confirmado')})).toBeOnTheScreen();expect(screen.queryByText(pt.operationStates.acknowledged)).toBeNull();expect(screen.getByText(pt.operationStates.pending)).toBeOnTheScreen();
  await act(()=>f.journey.edit('01996300-0000-7000-8000-000000000301',{title:'Confirmado',iconKey:'reading',colorToken:'blue'},{title:'Alteração recusada',iconKey:'reading',colorToken:'blue'}));
  const operation=store.operations().find(op=>op.command.type==='habit.patchMetadata')!;
  await act(()=>store.applyAck([{receipt:{operationId:operation.operationId,operationHash:operationHash(operation),status:'rejected',error:{code:'title_unavailable',fields:[],dependencyIds:[]}},replayed:false}]));
  expect(screen.getByText(pt.operationStates.rejected)).toBeOnTheScreen();expect(screen.getByRole('button',{name:pt.editLabel('Confirmado')})).toBeOnTheScreen();expect(screen.queryByText(pt.operationStates.acknowledged)).toBeNull();
 } finally {f.close();}
});

test('exhausted synchronization keeps the explicit retry disabled during the preserved server floor',async()=>{
 const f=fixture();try{
  await act(async()=>{
   await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Preservado','reading','blue',false);
   const store=f.session.account(),batch=store.operations(),now=Date.parse('2026-10-09T13:00:00Z');
   for(let attempt=0;attempt<10;attempt++){store.beginAttempt(batch,now);store.retryLater(batch,new SyncHttpError(503,'temporarily_unavailable','60'),now);}
   f.session.close();await f.session.restore();f.scheduler.update({active:true,online:true});
  });
  const before=f.session.account().operations();await mount(f);await fireEvent.press(screen.getByRole('button',{name:/^Sincronização: /}));
  expect(screen.getAllByText(pt.syncFailed).length).toBeGreaterThan(0);expect(screen.getByRole('button',{name:pt.retry})).toBeDisabled();
  const retry=jest.spyOn(f.scheduler,'retry');await fireEvent.press(screen.getByRole('button',{name:pt.retry}));expect(retry).not.toHaveBeenCalled();expect(f.session.account().operations()).toEqual(before);
 }finally{f.close();}
});
