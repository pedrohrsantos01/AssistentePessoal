import {act,fireEvent,render,screen} from '@testing-library/react-native';
import SQLite from 'better-sqlite3';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider} from '../../src/theme/theme.tsx';
import {tokens} from '../../src/theme/tokens.ts';
import {JourneyView} from '../../src/features/journey/screens.tsx';
import {performanceMark} from '../../src/core/diagnostics/performance.ts';
import {useNavigation} from '../../src/features/journey/navigation.ts';
import {pt} from '../../src/i18n/pt-BR.ts';
import {fixture} from './fixture.ts';
jest.mock('../../src/core/diagnostics/performance.ts',()=>({performanceTest:true,performanceMark:jest.fn()}));
beforeEach(()=>{useNavigation.setState({key:null,gate:null,surface:'welcome',privacy:false,logout:false,draft:'',editingId:null,formFrom:'briefing'});});
test('performance readiness follows real local content and visual state changes only after SQLite commits',async()=>{
 const f=fixture();let fault:SQLite.Database|undefined;try {
  await render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:0,left:0,right:0,bottom:0}}}><ThemeProvider value={tokens('dark')}><JourneyView journey={f.journey}/></ThemeProvider></SafeAreaProvider>);
  expect(screen.queryByTestId('ritmo.perf.briefing')).toBeNull();expect(screen.queryByTestId('ritmo.perf.local-cards')).toBeNull();
  await act(async()=>{await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Medicao local','reading','blue',false);});
  expect(screen.getByTestId('ritmo.perf.briefing')).toBeOnTheScreen();expect(screen.getByTestId('ritmo.perf.local-cards')).toBeOnTheScreen();
  const before=f.session.account().operations();jest.mocked(performanceMark).mockClear();fault=new SQLite(f.path());fault.exec("CREATE TRIGGER fail_perf BEFORE INSERT ON projected_views BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await fireEvent.press(screen.getByRole('checkbox',{name:pt.habitLabel('Medicao local',false)}));
  expect(screen.getByTestId('ritmo.perf.habit.open')).toBeOnTheScreen();expect(screen.queryByTestId('ritmo.perf.habit.done')).toBeNull();expect(f.session.account().operations()).toEqual(before);expect(performanceMark).not.toHaveBeenCalledWith('local.persisted');
  fault.exec('DROP TRIGGER fail_perf');await fireEvent.press(screen.getByRole('checkbox',{name:pt.habitLabel('Medicao local',false)}));
  expect(screen.getByTestId('ritmo.perf.habit.done')).toBeOnTheScreen();expect(f.journey.state().local?.totalXp).toBe(10);expect(performanceMark).toHaveBeenCalledWith('local.persisted');
 } finally {fault?.close();f.close();}
});
