import {act,fireEvent,render,screen} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider} from '../../src/theme/theme.tsx';
import {tokens} from '../../src/theme/tokens.ts';
import {JourneyView} from '../../src/features/journey/screens.tsx';
import {useNavigation} from '../../src/features/journey/navigation.ts';
import {IdentityHttpError} from '../../src/core/identity/http-identity.ts';
import {pt} from '../../src/i18n/pt-BR.ts';
import {fixture,openingFixture} from './fixture.ts';
import type {Journey} from '../../src/features/journey/journey.ts';
const token='A'.repeat(43);
const mount=(journey:Journey)=>render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:0,left:0,right:0,bottom:0}}}><ThemeProvider value={tokens('dark')}><JourneyView journey={journey}/></ThemeProvider></SafeAreaProvider>);
beforeEach(()=>{jest.useFakeTimers();useNavigation.setState({key:null,gate:null,surface:'welcome',privacy:false,logout:false,draft:'',editingId:null,formFrom:'briefing'});});
afterEach(()=>jest.useRealTimers());
test('forgot password validates, preserves offline email and renders uniform acceptance without a session',async()=>{
 const f=fixture();try {
  const send=jest.spyOn(f.identity,'requestPasswordReset');await mount(f.journey);await fireEvent.press(screen.getByRole('button',{name:pt.hasAccount}));await fireEvent.press(screen.getByRole('button',{name:pt.forgotPassword}));
  await fireEvent.changeText(screen.getByLabelText(pt.email),'invalid');await fireEvent.press(screen.getByRole('button',{name:pt.sendResetLink}));expect(screen.getByText(pt.invalidEmail)).toBeOnTheScreen();expect(send).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText(pt.email),' A.B+tag@example.test ');await fireEvent.press(screen.getByRole('button',{name:pt.sendResetLink}));expect(screen.getByLabelText(pt.email)).toHaveDisplayValue(' A.B+tag@example.test ');expect(send).not.toHaveBeenCalled();
  await act(()=>f.scheduler.update({active:false,online:true}));await fireEvent.press(screen.getByRole('button',{name:pt.sendResetLink}));expect(send).toHaveBeenCalledWith('a.b+tag@example.test');expect(screen.getByText(pt.recoverySent('a.b+tag@example.test'))).toBeOnTheScreen();expect(f.journey.state().key).toBeNull();
  await fireEvent.press(screen.getByRole('button',{name:pt.otherRecoveryEmail}));expect(screen.getByLabelText(pt.email)).toBeOnTheScreen();
 }finally{f.close();}
});
test('opening, revealing and confirming a new password preserves active local work and returns to same-account authentication',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Preservado','reading','blue',false);f.journey.toggle(f.journey.state().local!.habits[0]!.habitId,false);const queue=f.session.account().operations();
  const confirm=jest.spyOn(f.identity,'confirmPasswordReset');f.scheduler.update({active:false,online:true});await mount(f.journey);await fireEvent.press(screen.getByRole('tab',{name:pt.settings}));await fireEvent.press(screen.getByRole('button',{name:pt.privacy}));expect(screen.getByRole('header',{name:pt.privacyTitle})).toBeOnTheScreen();await act(()=>f.journey.passwordRecovery.open({kind:'valid',token}));expect(screen.queryByRole('header',{name:pt.privacyTitle})).toBeNull();expect(confirm).not.toHaveBeenCalled();expect(screen.queryByText(token)).toBeNull();
  const password='  nova senha 🌱  ';await fireEvent.changeText(screen.getByLabelText(pt.newPassword),password);await fireEvent.press(screen.getByRole('button',{name:pt.show}));expect(screen.getByLabelText(pt.newPassword).props.secureTextEntry).toBe(false);await fireEvent.press(screen.getByRole('button',{name:pt.hide}));expect(screen.getByLabelText(pt.newPassword).props.secureTextEntry).toBe(true);
  await fireEvent.press(screen.getByRole('button',{name:pt.saveNewPassword}));expect(confirm).toHaveBeenCalledWith(token,password);expect(screen.getByRole('header',{name:pt.resetCompleteTitle})).toBeOnTheScreen();expect(f.session.account().operations()).toEqual(queue);expect(f.journey.state().local?.totalXp).toBe(10);expect(f.journey.state().key).not.toBeNull();
  await fireEvent.press(screen.getByRole('button',{name:pt.backToLogin}));expect(screen.getByRole('header',{name:pt.reauth})).toBeOnTheScreen();expect(screen.getByText(pt.reauthHelp)).toBeOnTheScreen();expect(f.session.account().operations()).toEqual(queue);
 }finally{f.close();}
});
test('failed confirmation retains the typed password; used link offers another request',async()=>{
 const f=fixture();try {
  f.scheduler.update({active:false,online:true});const confirm=jest.spyOn(f.identity,'confirmPasswordReset').mockRejectedValue(new IdentityHttpError(503,'private-token-not-for-ui'));f.journey.passwordRecovery.open({kind:'valid',token});await mount(f.journey);await fireEvent.changeText(screen.getByLabelText(pt.newPassword),'new-password');await fireEvent.press(screen.getByRole('button',{name:pt.saveNewPassword}));expect(screen.getByText(pt.serviceUnavailable)).toBeOnTheScreen();expect(screen.getByLabelText(pt.newPassword)).toHaveDisplayValue('new-password');expect(screen.queryByText('private-token-not-for-ui')).toBeNull();
  confirm.mockRejectedValue(new IdentityHttpError(401,'reset_invalid'));await fireEvent.press(screen.getByRole('button',{name:pt.saveNewPassword}));expect(screen.getByText(pt.resetInvalidBody)).toBeOnTheScreen();expect(screen.queryByLabelText(pt.newPassword)).toBeNull();await fireEvent.press(screen.getByRole('button',{name:pt.anotherResetLink}));expect(screen.getByLabelText(pt.email)).toBeOnTheScreen();
 }finally{f.close();}
});
test('rate-limited request cannot send again through button or submit; reopening retains wait',async()=>{
 const f=fixture();try {
  f.scheduler.update({active:false,online:true});const send=jest.spyOn(f.identity,'requestPasswordReset').mockRejectedValue(new IdentityHttpError(429,'rate_limit','60'));f.journey.passwordRecovery.request();await mount(f.journey);await fireEvent.changeText(screen.getByLabelText(pt.email),'a@example.test');await fireEvent.press(screen.getByRole('button',{name:pt.sendResetLink}));expect(screen.getByText(pt.rateLimit)).toBeOnTheScreen();expect(screen.getByRole('button',{name:pt.sendResetLink})).toBeDisabled();
  await fireEvent(screen.getByLabelText(pt.email),'submitEditing');expect(send).toHaveBeenCalledTimes(1);await fireEvent.press(screen.getByRole('button',{name:pt.back}));await act(()=>f.journey.passwordRecovery.request());expect(screen.getByRole('button',{name:pt.sendResetLink})).toBeDisabled();
 }finally{f.close();}
});
test('an incoming link cannot bypass installation recovery and resumes only after healthy reopening',async()=>{
 const f=await openingFixture('installation');try {
  const confirm=jest.spyOn(f.identity,'confirmPasswordReset');f.journey.passwordRecovery.open({kind:'valid',token});await mount(f.journey);expect(screen.getByRole('header',{name:pt.databaseInstallationTitle})).toBeOnTheScreen();expect(screen.queryByLabelText(pt.newPassword)).toBeNull();expect(confirm).not.toHaveBeenCalled();f.fault(null);await fireEvent.press(screen.getByRole('button',{name:pt.retryDatabase}));expect(screen.getByLabelText(pt.newPassword)).toBeOnTheScreen();expect(confirm).not.toHaveBeenCalled();
 }finally{f.close();}
});


test('a warm recovery preempts logout and its explicit return keeps that dialog closed and local work intact',async()=>{
 const f=fixture();try {
  await f.session.login('a@example.test','password');f.journey.skip();f.journey.create('Mantido na recuperação','reading','blue',false);f.journey.toggle(f.journey.state().local!.habits[0]!.habitId,false);
  const queue=f.session.account().operations(),key=f.journey.state().key;f.scheduler.update({active:false,online:true});await mount(f.journey);
  await fireEvent.press(screen.getByRole('tab',{name:pt.settings}));await fireEvent.press(screen.getByRole('button',{name:pt.logout}));expect(screen.getByRole('header',{name:pt.logoutTitle})).toBeOnTheScreen();
  await act(()=>f.journey.passwordRecovery.open({kind:'valid',token}));expect(screen.queryByRole('header',{name:pt.logoutTitle})).toBeNull();
  await fireEvent.changeText(screen.getByLabelText(pt.newPassword),'new-fixture-password');await fireEvent.press(screen.getByRole('button',{name:pt.saveNewPassword}));expect(screen.getByRole('header',{name:pt.resetCompleteTitle})).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button',{name:pt.backToLogin}));expect(screen.getByRole('header',{name:pt.reauth})).toBeOnTheScreen();expect(screen.queryByRole('header',{name:pt.logoutTitle})).toBeNull();expect(f.journey.state().key).toBe(key);expect(f.journey.state().local?.totalXp).toBe(10);expect(f.session.account().operations()).toEqual(queue);
 }finally{f.close();}
});
