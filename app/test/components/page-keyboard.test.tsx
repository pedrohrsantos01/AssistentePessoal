import {act,render,screen} from '@testing-library/react-native';
import {Dimensions,Keyboard,Platform,StyleSheet,type KeyboardEvent,type ScaledSize} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider} from '../../src/theme/theme.tsx';
import {tokens} from '../../src/theme/tokens.ts';
import {Input,Link,Page,Sheet} from '../../src/ui/primitives.tsx';
import {pt} from '../../src/i18n/pt-BR.ts';

test.each([{fontScale:1,sheet:false},{fontScale:2,sheet:false},{fontScale:1,sheet:true},{fontScale:2,sheet:true}])('Android viewport uses the real IME top with $fontScale font scale, sheet=$sheet',async({fontScale,sheet})=>{
 const platform=jest.replaceProperty(Platform,'OS','android'),listeners=new Map<string,(event:KeyboardEvent)=>void>(),originalDimensions=Dimensions.get.bind(Dimensions),listenKeyboard=Keyboard.addListener.bind(Keyboard),listenDimensions=Dimensions.addEventListener.bind(Dimensions);
 const subscription=jest.spyOn(Keyboard,'addListener').mockImplementation((event,callback)=>{listeners.set(event,callback);return listenKeyboard(event,callback);});
 const metrics=jest.spyOn(Keyboard,'metrics').mockReturnValue(undefined);
 const dimensions=jest.spyOn(Dimensions,'get').mockImplementation(kind=>({...originalDimensions(kind),width:390,height:844,fontScale}));
 let changeDimensions:((event:{screen:ScaledSize;window:ScaledSize})=>void)|undefined;
 const dimensionSubscription=jest.spyOn(Dimensions,'addEventListener').mockImplementation((event,callback)=>{changeDimensions=callback;return listenDimensions(event,callback);});
 const show=async(screenY:number,height:number)=>{await act(async()=>{listeners.get('keyboardDidShow')!({duration:0,easing:'keyboard',endCoordinates:{screenX:0,screenY,width:390,height}});});};
 const viewportTop=sheet?0:40;
 const viewportHeight=()=>StyleSheet.flatten(screen.getByTestId('page-keyboard-viewport').props.style).maxHeight;
 try {
  const fields=<><Input label={pt.password} value="preserved draft"/><Link center label={pt.hasAccount} onPress={()=>{}}/></>;
  await render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:40,left:0,right:0,bottom:36}}}><ThemeProvider value={tokens('light')}>{sheet?<Sheet label="Recovery" onClose={()=>{}}>{fields}</Sheet>:<Page>{fields}</Page>}</ThemeProvider></SafeAreaProvider>);
  // RN Android's height excludes the 36 dp navigation bar: IME top = 844 - 308 - 36.
  await show(844,308);expect(viewportHeight()!+viewportTop).toBe(500);
  // Correct screenY on devices that resize normally produces the same boundary.
  await show(500,308);expect(viewportHeight()!+viewportTop).toBe(500);
  // Gboard's enlarged notice or emoji panel can change height without a hide event.
  await show(844,408);expect(viewportHeight()!+viewportTop).toBe(400);
  await act(async()=>{const size={width:390,height:900,scale:1,fontScale};changeDimensions!({screen:size,window:size});});
  await show(900,408);expect(viewportHeight()!+viewportTop).toBe(456);
  expect(screen.getByLabelText(pt.password)).toHaveDisplayValue('preserved draft');expect(screen.getByRole('button',{name:pt.hasAccount})).toBeOnTheScreen();
  await act(async()=>{listeners.get('keyboardDidHide')!({duration:0,easing:'keyboard',endCoordinates:{screenX:0,screenY:900,width:390,height:0}});});
  expect(viewportHeight()).toBeUndefined();expect(screen.getByLabelText(pt.password)).toHaveDisplayValue('preserved draft');
 } finally {subscription.mockRestore();metrics.mockRestore();dimensions.mockRestore();dimensionSubscription.mockRestore();platform.restore();}
});
