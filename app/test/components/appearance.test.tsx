import {fireEvent,render,screen} from '@testing-library/react-native';
import {StyleSheet,Text} from 'react-native';
import * as Native from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppearancePreferences} from '../../src/core/preferences/appearance.ts';
import {ThemeProvider,useTheme} from '../../src/theme/theme.tsx';
import {AppearanceReadNotice,AppearanceSection} from '../../src/features/preferences/appearance-section.tsx';
import {JourneyView} from '../../src/features/journey/screens.tsx';
import {useNavigation} from '../../src/features/journey/navigation.ts';
import {pt} from '../../src/i18n/pt-BR.ts';
import {fixture} from './fixture.ts';
function Probe(){const t=useTheme();return <Text accessibilityLabel="theme-probe" style={{color:t.text.primary,fontFamily:t.fonts.body.regular,borderRadius:t.radius.card}}>{t.skin+':'+t.mode}</Text>;}
const frame={frame:{x:0,y:0,width:390,height:844},insets:{top:0,left:0,right:0,bottom:0}};
test('selectors change shared theme, preserve mode when changing skin and return to following system changes',async()=>{
 let raw:string|null=null;const preferences=new AppearancePreferences({get:async()=>raw,set:async value=>{raw=value;}});await preferences.load();
 let system:'light'|'dark'='light';const scheme=jest.spyOn(Native,'useColorScheme').mockImplementation(()=>system);const tree=()=><SafeAreaProvider initialMetrics={frame}><ThemeProvider preferences={preferences}><AppearanceSection/><Probe/></ThemeProvider></SafeAreaProvider>;
 try{const view=await render(tree());
 expect(screen.getByLabelText('theme-probe')).toHaveTextContent('holo:light');expect(screen.getByRole('switch',{name:pt.followSystem}).props.accessibilityState).toMatchObject({checked:true});
 await fireEvent.press(screen.getByRole('radio',{name:pt.appearanceNames.neo}));expect(screen.getByLabelText('theme-probe')).toHaveTextContent('neo:light');expect(StyleSheet.flatten(screen.getByLabelText('theme-probe').props.style).fontFamily).toBe('SpaceGrotesk_400Regular');
 await fireEvent.press(screen.getByRole('switch',{name:pt.darkMode}));expect(screen.getByLabelText('theme-probe')).toHaveTextContent('neo:dark');expect(screen.getByRole('switch',{name:pt.followSystem}).props.accessibilityState).toMatchObject({checked:false});
 system='light';await view.rerender(tree());expect(screen.getByLabelText('theme-probe')).toHaveTextContent('neo:dark');
 await fireEvent.press(screen.getByRole('switch',{name:pt.followSystem}));system='dark';await view.rerender(tree());expect(screen.getByLabelText('theme-probe')).toHaveTextContent('neo:dark');system='light';await view.rerender(tree());expect(screen.getByLabelText('theme-probe')).toHaveTextContent('neo:light');
 }finally{scheme.mockRestore();await preferences.dispose();}
});
test('a failed preference write keeps the current theme and retry restores the intended selection',async()=>{
 let fail=true;const preferences=new AppearancePreferences({get:async()=>null,set:async()=>{if(fail)throw new Error('fixture');}});await preferences.load();
 try{await render(<ThemeProvider preferences={preferences}><AppearanceSection/><Probe/></ThemeProvider>);await fireEvent.press(screen.getByRole('radio',{name:pt.appearanceNames.cockpit}));expect(screen.getByText(pt.preferenceWriteFailure)).toBeOnTheScreen();expect(screen.getByRole('radio',{name:pt.appearanceNames.holo}).props.accessibilityState).toMatchObject({checked:true});fail=false;await fireEvent.press(screen.getByRole('button',{name:pt.retryAppearance}));expect(screen.getByRole('radio',{name:pt.appearanceNames.cockpit}).props.accessibilityState).toMatchObject({checked:true});expect(screen.queryByText(pt.preferenceWriteFailure)).toBeNull();}finally{await preferences.dispose();}
});
test('read failure retains usable local habits and pauses only appearance choices until explicit retry',async()=>{
 const f=fixture();let failed=true;const preferences=new AppearancePreferences({get:async()=>{if(failed)throw new Error('fixture');return '{"version":1,"skin":"neo","mode":"light"}';},set:async()=>{}});await preferences.load();
 try{await f.session.login('a@example.test','password');f.journey.confirmTime({timezone:'UTC',dayStartHour:4});f.journey.create('Leitura preservada','reading','blue',true);useNavigation.setState({key:null,gate:null,surface:'welcome',privacy:false,logout:false});
 await render(<SafeAreaProvider initialMetrics={frame}><ThemeProvider preferences={preferences}><AppearanceReadNotice preferences={preferences}/><JourneyView journey={f.journey}/></ThemeProvider></SafeAreaProvider>);
 await fireEvent.press(screen.getByRole('checkbox',{name:pt.habitLabel('Leitura preservada',false)}));expect(f.journey.state().local?.totalXp).toBe(10);await fireEvent.press(screen.getByRole('tab',{name:pt.settings}));expect(screen.getByRole('radio',{name:pt.appearanceNames.neo,disabled:true})).toBeOnTheScreen();expect(screen.getByText(pt.preferenceReadFailure)).toBeOnTheScreen();failed=false;await fireEvent.press(screen.getByRole('button',{name:pt.retryAppearanceRead}));expect(screen.getByRole('radio',{name:pt.appearanceNames.neo}).props.accessibilityState).toMatchObject({checked:true,disabled:false});expect(f.journey.state().local?.totalXp).toBe(10);
 }finally{f.close();await preferences.dispose();}
},15000);
