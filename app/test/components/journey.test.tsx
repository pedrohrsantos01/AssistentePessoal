import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import SQLite from 'better-sqlite3';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider} from '../../src/theme/theme.tsx';
import {tokens} from '../../src/theme/tokens.ts';
import {BriefingCards,type BriefingCardProvider} from '../../src/features/briefing/providers.tsx';
import {Type} from '../../src/ui/primitives.tsx';
import {JourneyView} from '../../src/features/journey/screens.tsx';
import {useNavigation} from '../../src/features/journey/navigation.ts';
import {pt} from '../../src/i18n/pt-BR.ts';
import {fixture} from './fixture.ts';
const mount=(f:ReturnType<typeof fixture>)=>render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:0,left:0,right:0,bottom:0}}}><ThemeProvider value={tokens('dark')}><JourneyView journey={f.journey}/></ThemeProvider></SafeAreaProvider>);
beforeEach(()=>{useNavigation.setState({key:null,surface:'welcome',privacy:false,logout:false,draft:'',editingId:null,formFrom:'briefing'});});
test('offline login preserves typed values and exposes a useful connection error',async()=>{
 const f=fixture();try {
  await mount(f);await fireEvent.press(screen.getByRole('button',{name:pt.hasAccount}));
  await fireEvent.changeText(screen.getByLabelText(pt.email),'a@example.test');await fireEvent.changeText(screen.getByLabelText(pt.password),'password');
  await fireEvent.press(screen.getByRole('button',{name:pt.login}));
  expect(screen.getByLabelText(pt.email)).toHaveDisplayValue('a@example.test');expect(screen.getByLabelText(pt.password)).toHaveDisplayValue('password');
  expect(screen.getAllByText(pt.offlineAuth).length).toBeGreaterThan(0);expect(f.journey.state().local).toBeNull();
 } finally {f.close();}
});
test('the native components go through onboarding, skip, create and mark/undo using SQLite',async()=>{
 const f=fixture();try {
  await act(async()=>{await f.session.login('a@example.test','password');});await mount(f);
  await fireEvent.press(screen.getByRole('button',{name:pt.continue}));
  expect(screen.getByRole('header',{name:pt.firstHabit})).toBeOnTheScreen();await fireEvent.press(screen.getByRole('button',{name:pt.skip}));
  expect(screen.getByRole('header',{name:pt.emptyTitle})).toBeOnTheScreen();await fireEvent.press(screen.getByRole('button',{name:pt.createHabit}));
  await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Ler um capítulo');await fireEvent.press(screen.getByRole('radio',{name:pt.icons.reading}));await fireEvent.press(screen.getByRole('radio',{name:pt.colors.blue}));await fireEvent.press(screen.getByRole('button',{name:pt.createHabit}));
  await fireEvent.press(screen.getByRole('checkbox',{name:pt.habitLabel('Ler um capítulo',false)}));
  expect(screen.getByRole('checkbox',{checked:true})).toBeOnTheScreen();expect(f.journey.state().local?.totalXp).toBe(10);
  await fireEvent.press(screen.getByRole('checkbox',{checked:true}));expect(f.journey.state().local?.totalXp).toBe(0);
  await fireEvent.press(screen.getByRole('checkbox',{checked:false}));expect(f.journey.state().local?.totalXp).toBe(10);
  expect(screen.getByText('10')).toBeOnTheScreen();const creations=f.session.account().operations().filter(op=>op.command.type==='habit.create');expect(creations).toHaveLength(1);expect(creations[0]?.command).toMatchObject({iconKey:'reading',colorToken:'blue'});
 } finally {f.close();}
});
test('a durable write failure keeps the form and step and never renders a successful habit',async()=>{
 const f=fixture();let fault:SQLite.Database|undefined;try {
  await f.session.login('a@example.test','password');f.journey.confirmTime({timezone:'UTC',dayStartHour:4});await mount(f);
  fault=new SQLite(f.path());fault.exec("CREATE TRIGGER fail_component BEFORE INSERT ON projected_views BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await fireEvent.changeText(screen.getByLabelText(pt.habitName),'Meditar');await fireEvent.press(screen.getByRole('button',{name:pt.createHabit}));
  expect(screen.getByLabelText(pt.habitName)).toHaveDisplayValue('Meditar');expect(screen.getByText(pt.localFailure)).toBeOnTheScreen();expect(f.journey.state().local?.step).toBe('first_habit');expect(f.journey.state().local?.habits).toHaveLength(0);
  fault.exec('DROP TRIGGER fail_component');await fireEvent.press(screen.getByRole('button',{name:pt.createHabit}));expect(screen.getByRole('checkbox',{checked:false})).toBeOnTheScreen();
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
 const f=fixture();try {
  await mount(f);await fireEvent.press(screen.getByRole('button',{name:pt.register}));
  await fireEvent.press(screen.getByRole('button',{name:pt.registrationNoticeLabel}));expect(screen.getByRole('header',{name:pt.privacyTitle})).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button',{name:pt.close}));expect(screen.queryByRole('header',{name:pt.privacyTitle})).toBeNull();expect(screen.getByLabelText(pt.name)).toBeOnTheScreen();
 } finally {f.close();}
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

test('one failing Briefing provider cannot prevent another card from loading',async()=>{
 const f=fixture();try {
  const providers:BriefingCardProvider[]=[
   {id:'broken',module:'habits',priority:()=>100,load:async()=>{throw new Error('fixture_provider_failure');},render:()=>null},
   {id:'xp',module:'gamification',priority:()=>50,load:async ctx=>ctx,render:()=> <Type>{pt.xp}</Type>},
  ];
  await render(<ThemeProvider value={tokens('dark')}><BriefingCards providers={providers} context={{state:f.journey.state(),create:()=>{},toggle:()=>{}}}/></ThemeProvider>);
  expect(await screen.findByText(pt.xp)).toBeOnTheScreen();expect(await screen.findByText(pt.genericError)).toBeOnTheScreen();
 } finally {f.close();}
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
