import {useEffect,useState,type ReactNode} from 'react';
import {Dimensions,Image,Keyboard,KeyboardAvoidingView,Modal,PixelRatio,Platform,Pressable,ScrollView,Text,TextInput,View,type KeyboardMetrics,type PressableProps,type TextInputProps,type TextStyle,type ViewStyle} from 'react-native';
import {SafeAreaView,useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated,{ReduceMotion,useAnimatedStyle,useSharedValue,withTiming} from 'react-native-reanimated';
import {useTheme} from '../theme/theme.tsx';
import {typeSize} from '../theme/tokens.ts';
import {pt} from '../i18n/pt-BR.ts';
import scanline from '../../assets/scanline.png';
import backIcon from '../../assets/icons/back.png';
export function Type({children,size='body',tone='primary',mono=false,bold=false,semibold=false,medium=false,header=false,style,accessibilityLabel}:{children:ReactNode;size?:keyof typeof typeSize;tone?:'primary'|'secondary'|'accent'|'error'|'warning';mono?:boolean;bold?:boolean;semibold?:boolean;medium?:boolean;header?:boolean;style?:TextStyle;accessibilityLabel?:string}) {
 const t=useTheme(),font=mono?t.fonts.mono:t.fonts.body;
 const color=tone==='accent'?t.accent.text:tone==='error'?t.status.error:tone==='warning'?t.status.warning:t.text[tone];
 const family=bold?font.bold:semibold&&!mono?t.fonts.body.semibold:medium?font.medium:font.regular;
 return <Text accessibilityLabel={accessibilityLabel} accessibilityRole={header?'header':undefined} style={{includeFontPadding:false,fontFamily:family,fontSize:t.typeSize[size],lineHeight:t.typeSize[size]*(size==='brand'?t.line.brand:size==='title'?t.line.title:size==='number'||size==='hour'?t.line.number:t.line.body),color,...style}}>{children}</Text>;
}
export function Touch({style,onPressIn,onPressOut,dimWhenDisabled=true,...props}:Omit<PressableProps,'style'>&{style:ViewStyle;dimWhenDisabled?:boolean}) {
 const t=useTheme(),[pressed,setPressed]=useState(false);
 return <Pressable {...props} onPressIn={event=>{setPressed(true);onPressIn?.(event);}} onPressOut={event=>{setPressed(false);onPressOut?.(event);}} style={[style,{opacity:props.disabled?(dimWhenDisabled?t.metrics.disabledOpacity:1):pressed?t.metrics.pressedOpacity:1}]}/>;
}
const AnimatedPressable=Animated.createAnimatedComponent(Pressable);
export function Button({label,onPress,secondary=false,disabled=false,busy=false,compact=false,displayLabel,style,textSize='body'}:{label:string;displayLabel?:string;onPress:()=>void;secondary?:boolean;disabled?:boolean;busy?:boolean;compact?:boolean;style?:ViewStyle;textSize?:keyof typeof typeSize}) {
 const t=useTheme(),scale=useSharedValue(1),animated=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));
 const press=(down:boolean)=>{scale.value=withTiming(down?t.motion.pressedScale:1,{duration:t.motion.press,reduceMotion:ReduceMotion.System});};
 return <AnimatedPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy,busy}} disabled={disabled||busy} onPress={onPress} onPressIn={()=>press(true)} onPressOut={()=>press(false)}
  style={[{minHeight:compact?t.metrics.touch:t.metrics.button,minWidth:t.metrics.touch,paddingHorizontal:compact?t.space.inputInset:t.space.buttonInset,paddingVertical:compact?t.space.small:t.space.medium,borderRadius:t.radius.button,borderWidth:secondary?t.metrics.controlBorder:t.space.none,borderColor:secondary?t.border.interactive:t.accent.fill,backgroundColor:secondary?t.bg.transparent:t.accent.fill,opacity:disabled||busy?t.metrics.disabledOpacity:1,alignItems:'center',justifyContent:'center',...style},animated]}>
   <Type size={textSize} semibold style={{color:secondary?t.text.primary:t.text.onAccent}}>{displayLabel??label}</Type>
 </AnimatedPressable>;
}
export function Link({label,onPress,center=false,disabled=false}:{label:string;onPress:()=>void;center?:boolean;disabled?:boolean}) {
 const t=useTheme();return <Touch accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{disabled}} onPress={onPress} style={{minHeight:t.metrics.touch,minWidth:t.metrics.touch,paddingVertical:t.space.controlGap,justifyContent:'center',alignItems:center?'center':'flex-start'}}><Type size="context" semibold style={{color:t.text.link}}>{label}</Type></Touch>;
}
export function Input({label,displayLabel,accessory,caption,elevated=false,...props}:TextInputProps&{label:string;displayLabel?:string;accessory?:ReactNode;caption?:string|undefined;elevated?:boolean}) {
 const t=useTheme(),[focus,setFocus]=useState(false);
 return <View style={{gap:t.space.compact}}><View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:t.space.small}}><Type size="label" semibold style={{lineHeight:t.typeSize.label*t.line.title}}>{displayLabel??label}</Type>{caption&&<Type size="caption" mono tone="secondary">{caption}</Type>}</View>
  <View style={{flexDirection:'row',gap:t.space.small,alignItems:'stretch'}}><TextInput accessibilityLabel={label} placeholderTextColor={t.text.secondary} {...props} onFocus={event=>{setFocus(true);props.onFocus?.(event);}} onBlur={event=>{setFocus(false);props.onBlur?.(event);}}
    style={{flex:1,minWidth:t.space.none,minHeight:t.metrics.input,borderWidth:t.metrics.controlBorder,borderRadius:t.radius.inner,borderColor:focus?t.accent.text:elevated?t.border.inputElevated:t.border.input,backgroundColor:elevated?t.bg.inputElevated:t.bg.input,color:t.text.primary,fontFamily:t.fonts.body.regular,fontSize:t.typeSize.body,includeFontPadding:false,paddingHorizontal:t.space.inputInset,paddingVertical:t.space.small}} />{accessory}</View>
 </View>;
}
export function Decoration({corners=true}:{corners?:boolean}) {
 const t=useTheme();return t.skin==='cockpit'&&corners?<>{(['topLeft','bottomRight'] as const).map(corner=><View key={corner} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{position:'absolute',width:t.metrics.cockpitCorner,height:t.metrics.cockpitCorner,opacity:t.metrics.cockpitOpacity,borderColor:t.accent.fill,...(corner==='topLeft'?{top:t.metrics.cockpitOffset,left:t.metrics.cockpitOffset,borderTopWidth:t.metrics.border,borderLeftWidth:t.metrics.border}:{bottom:t.metrics.cockpitOffset,right:t.metrics.cockpitOffset,borderBottomWidth:t.metrics.border,borderRightWidth:t.metrics.border})}}/>)}</>:t.skin==='holo'?<><View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{position:'absolute',top:t.space.none,bottom:t.space.none,left:t.space.none,right:t.space.none,borderRadius:t.radius.card,overflow:'hidden'}}><Image source={scanline} resizeMode="repeat" tintColor={t.accent.fill} accessible={false} style={{width:t.metrics.full,height:t.metrics.full,opacity:t.decoration.scanOpacity,transform:[{scale:PixelRatio.get()}],transformOrigin:'top left'}}/></View>
 {corners&&(['topLeft','topRight','bottomLeft','bottomRight'] as const).map(corner=><View key={corner} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{position:'absolute',width:t.metrics.bracket,height:t.metrics.bracket,borderColor:t.accent.fill,...(corner.startsWith('top')?{top:t.metrics.bracketOffset,borderTopWidth:t.metrics.border}:{bottom:t.metrics.bracketOffset,borderBottomWidth:t.metrics.border}),...(corner.endsWith('Left')?{left:t.metrics.bracketOffset,borderLeftWidth:t.metrics.border}:{right:t.metrics.bracketOffset,borderRightWidth:t.metrics.border})}}/>)}</>:null;
}
export function Card({children,style,decorated=true}:{children:ReactNode;style?:ViewStyle;decorated?:boolean}) {
 const t=useTheme();return <View style={{backgroundColor:t.bg.elevated,borderColor:t.border.decorative,borderWidth:t.metrics.border,borderRadius:t.radius.card,padding:t.space.large,gap:t.space.medium,boxShadow:decorated?t.decoration.cardShadow:[],...style}}>{decorated&&<Decoration/>}{children}</View>;
}
export function Banner({message,error=false}:{message:string;error?:boolean}) {
 const t=useTheme();return <View accessibilityRole={error?'alert':'text'} accessibilityLiveRegion="polite" style={{backgroundColor:error?t.bg.error:t.bg.warning,padding:t.space.inputInset,borderColor:error?t.status.error:t.status.warning,borderWidth:t.metrics.border,borderRadius:t.radius.inner}}><Type>{message}</Type></View>;
}
function KeyboardViewport({children,style,insideSafeArea=true}:{children:ReactNode;style?:ViewStyle;insideSafeArea?:boolean}) {
 const insets=useSafeAreaInsets(),[keyboard,setKeyboard]=useState<KeyboardMetrics|undefined>(()=>Platform.OS==='android'?Keyboard.metrics():undefined),[screenHeight,setScreenHeight]=useState(()=>Dimensions.get('screen').height);
 useEffect(()=>{
  if(Platform.OS!=='android')return;
  const show=Keyboard.addListener('keyboardDidShow',event=>setKeyboard(event.endCoordinates)),hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(undefined)),dimensions=Dimensions.addEventListener('change',event=>setScreenHeight(event.screen.height));
  return ()=>{show.remove();hide.remove();dimensions.remove();};
 },[]);
 const viewportTop=insideSafeArea?insets.top:0;
 if(Platform.OS!=='android')return <KeyboardAvoidingView testID="page-keyboard-viewport" keyboardVerticalOffset={viewportTop} style={{flex:1,...style}} behavior="padding">{children}</KeyboardAvoidingView>;
 // RN Android excludes the navigation bar from IME height. In edge-to-edge
 // adjustResize, screenY can still be the full window bottom rather than IME top.
 const heightTop=keyboard&&keyboard.height>0?screenHeight-keyboard.height-insets.bottom:undefined;
 const keyboardTop=heightTop===undefined?undefined:Math.min(heightTop,keyboard!.screenY>0?keyboard!.screenY:heightTop);
 return <View testID="page-keyboard-viewport" style={{flex:1,...style,maxHeight:keyboardTop===undefined?undefined:Math.max(0,keyboardTop-viewportTop)}}>{children}</View>;
}
export function Page({children,briefing=false,footer,variant='form',back,hidden=false}:{children:ReactNode;briefing?:boolean;footer?:ReactNode;variant?:'form'|'welcome'|'onboarding'|'habit';back?:(()=>void)|undefined;hidden?:boolean}) {
 const t=useTheme();return <SafeAreaView accessibilityElementsHidden={hidden} importantForAccessibility={hidden?'no-hide-descendants':'auto'} style={{flex:1,backgroundColor:t.bg.base}}>
  <KeyboardViewport>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1,paddingTop:back?t.space.none:briefing?t.space.controlGap:variant==='welcome'?t.space.hero:variant==='onboarding'?t.space.buttonInset:t.space.large}}>{back&&<Back onPress={back}/>}<View style={{flexGrow:1,paddingHorizontal:briefing?t.space.briefing:variant==='habit'?t.space.buttonInset:t.space.form,paddingBottom:briefing?t.space.form:variant==='welcome'?t.metrics.touch:t.space.hero,gap:briefing||variant==='welcome'?t.space.medium:variant==='onboarding'||variant==='habit'?t.space.briefing:t.space.large}}>{children}</View></ScrollView>
   {footer}
  </KeyboardViewport>
 </SafeAreaView>;
}
export function Back({onPress}:{onPress:()=>void}) {
 const t=useTheme();return <View style={{paddingHorizontal:t.space.small,paddingVertical:t.space.micro}}><Touch accessibilityRole="button" accessibilityLabel={pt.back} onPress={onPress} style={{width:t.metrics.touch,height:t.metrics.touch,alignItems:'center',justifyContent:'center'}}><Image source={backIcon} tintColor={t.text.primary} accessible={false} style={{width:t.metrics.backIcon,height:t.metrics.backIcon}}/></Touch></View>;
}
export function Sheet({children,visible=true,onClose,label}:{children:ReactNode;visible?:boolean;onClose:()=>void;label:string}) {
 const t=useTheme(),insets=useSafeAreaInsets();return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent><KeyboardViewport insideSafeArea={false} style={{backgroundColor:t.bg.overlay,justifyContent:'flex-end'}}><Pressable accessible={false} importantForAccessibility="no-hide-descendants" onPress={onClose} style={{position:'absolute',top:t.space.none,left:t.space.none,right:t.space.none,bottom:t.space.none}}/><View accessibilityViewIsModal accessibilityLabel={label} importantForAccessibility="yes" style={{maxHeight:t.metrics.sheetMaxHeight,backgroundColor:t.bg.elevated,borderTopWidth:t.metrics.border,borderTopColor:t.border.decorative,borderTopLeftRadius:t.metrics.sheetRadius,borderTopRightRadius:t.metrics.sheetRadius}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingTop:t.space.controlGap,paddingHorizontal:t.space.buttonInset,paddingBottom:Math.max(insets.bottom,t.space.hero),gap:t.space.inputInset}}><View accessible={false} style={{alignSelf:'center',width:t.metrics.sheetHandleWidth,height:t.metrics.sheetHandleHeight,borderRadius:t.metrics.sheetHandleRadius,backgroundColor:t.border.interactive}}/>{children}</ScrollView></View></KeyboardViewport></Modal>;
}
export function Loading({message}:{message:string}) {
 const t=useTheme();return <Page><Type size="title" header>{message}</Type><View accessibilityRole="progressbar" accessibilityLabel={message} style={{height:t.metrics.skeleton,backgroundColor:t.bg.track,borderRadius:t.radius.card}}/><Type tone="secondary">{pt.initialHelp}</Type></Page>;
}
