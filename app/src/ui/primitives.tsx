import {useState,type ReactNode} from 'react';
import {Image,KeyboardAvoidingView,Platform,Pressable,ScrollView,Text,TextInput,View,type PressableProps,type TextInputProps,type TextStyle,type ViewStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated,{ReduceMotion,useAnimatedStyle,useSharedValue,withTiming} from 'react-native-reanimated';
import {useTheme} from '../theme/theme.tsx';
import {typeSize} from '../theme/tokens.ts';
import {pt} from '../i18n/pt-BR.ts';
import scanline from '../../assets/scanline.png';
export function Type({children,size='body',tone='primary',mono=false,bold=false,header=false,style}:{children:ReactNode;size?:keyof typeof typeSize;tone?:'primary'|'secondary'|'accent'|'error'|'warning';mono?:boolean;bold?:boolean;header?:boolean;style?:TextStyle}) {
 const t=useTheme(),font=mono?t.fonts.mono:t.fonts.body;
 const color=tone==='accent'?t.accent.text:tone==='error'?t.status.error:tone==='warning'?t.status.warning:t.text[tone];
 return <Text accessibilityRole={header?'header':undefined} style={{fontFamily:bold?font.bold:font.regular,fontSize:t.typeSize[size],lineHeight:t.typeSize[size]*(size==='brand'?t.line.brand:size==='title'?t.line.title:t.line.body),color,...style}}>{children}</Text>;
}
// Keep native layout styles flat; pressed feedback changes only opacity.
export function Touch({style,onPressIn,onPressOut,...props}:Omit<PressableProps,'style'>&{style:ViewStyle}) {
 const t=useTheme(),[pressed,setPressed]=useState(false);
 return <Pressable {...props} onPressIn={event=>{setPressed(true);onPressIn?.(event);}} onPressOut={event=>{setPressed(false);onPressOut?.(event);}} style={[style,{opacity:pressed?t.metrics.pressedOpacity:1}]}/>;
}
const AnimatedPressable=Animated.createAnimatedComponent(Pressable);
export function Button({label,onPress,secondary=false,disabled=false,busy=false,compact=false,displayLabel}:{label:string;displayLabel?:string;onPress:()=>void;secondary?:boolean;disabled?:boolean;busy?:boolean;compact?:boolean}) {
 const t=useTheme(),scale=useSharedValue(1),animated=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));
 const press=(down:boolean)=>{scale.value=withTiming(down?t.motion.pressedScale:1,{duration:t.motion.press,reduceMotion:ReduceMotion.System});};
 return <AnimatedPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy,busy}} disabled={disabled||busy} onPress={onPress} onPressIn={()=>press(true)} onPressOut={()=>press(false)}
  style={[{minHeight:compact?t.metrics.touch:t.metrics.button,minWidth:t.metrics.touch,paddingHorizontal:t.space.buttonInset,paddingVertical:t.space.medium,borderRadius:t.radius.button,borderWidth:t.metrics.controlBorder,borderColor:secondary?t.border.interactive:t.accent.fill,backgroundColor:secondary?t.bg.elevated:t.accent.fill,opacity:disabled||busy?t.metrics.disabledOpacity:1,alignItems:'center',justifyContent:'center'},animated]}>
   <Type bold style={{color:secondary?t.text.primary:t.text.onAccent}}>{displayLabel??label}</Type>
 </AnimatedPressable>;
}
export function Link({label,onPress}:{label:string;onPress:()=>void}) {
 const t=useTheme();return <Touch accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{minHeight:t.metrics.touch,minWidth:t.metrics.touch,paddingVertical:t.space.controlGap,justifyContent:'center'}}><Type style={{color:t.text.link,textDecorationLine:'underline'}}>{label}</Type></Touch>;
}
export function Input({label,...props}:TextInputProps&{label:string}) {
 const t=useTheme(),[focus,setFocus]=useState(false);
 return <View style={{gap:t.space.compact}}><Type size="label" bold>{label}</Type>
  <TextInput accessibilityLabel={label} placeholderTextColor={t.text.secondary} {...props} onFocus={event=>{setFocus(true);props.onFocus?.(event);}} onBlur={event=>{setFocus(false);props.onBlur?.(event);}}
    style={{minHeight:t.metrics.input,borderWidth:t.metrics.controlBorder,borderRadius:t.radius.inner,borderColor:focus?t.accent.text:t.border.input,backgroundColor:t.bg.input,color:t.text.primary,fontFamily:t.fonts.body.regular,fontSize:t.typeSize.body,paddingHorizontal:t.space.inputInset,paddingVertical:t.space.medium}} />
 </View>;
}
export function Card({children,style}:{children:ReactNode;style?:ViewStyle}) {
 const t=useTheme();return <View style={{backgroundColor:t.bg.elevated,borderColor:t.border.decorative,borderWidth:t.metrics.border,borderRadius:t.radius.card,padding:t.space.large,gap:t.space.medium,...style}}>
  {t.skin==='holo'&&<View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{position:'absolute',top:t.space.none,bottom:t.space.none,left:t.space.none,right:t.space.none,borderRadius:t.radius.card,overflow:'hidden'}}><Image source={scanline} resizeMode="repeat" tintColor={t.accent.fill} accessible={false} style={{width:t.metrics.full,height:t.metrics.full,opacity:t.decoration.scanOpacity}}/></View>}
  {children}
  {t.skin==='holo'&&(['topLeft','topRight','bottomLeft','bottomRight'] as const).map(corner=><View key={corner} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{position:'absolute',width:t.metrics.bracket,height:t.metrics.bracket,borderColor:t.accent.fill,...(corner.startsWith('top')?{top:t.metrics.bracketOffset,borderTopWidth:t.metrics.border}:{bottom:t.metrics.bracketOffset,borderBottomWidth:t.metrics.border}),...(corner.endsWith('Left')?{left:t.metrics.bracketOffset,borderLeftWidth:t.metrics.border}:{right:t.metrics.bracketOffset,borderRightWidth:t.metrics.border})}}/>)}
 </View>;
}
export function Banner({message,error=false}:{message:string;error?:boolean}) {
 const t=useTheme();return <View accessibilityRole={error?'alert':'text'} accessibilityLiveRegion="polite" style={{backgroundColor:error?t.bg.error:t.bg.warning,padding:t.space.inputInset,borderColor:error?t.status.error:t.status.warning,borderWidth:t.metrics.border,borderRadius:t.radius.inner}}><Type>{message}</Type></View>;
}
export function Page({children,briefing=false,footer}:{children:ReactNode;briefing?:boolean;footer?:ReactNode}) {
 const t=useTheme();return <SafeAreaView style={{flex:1,backgroundColor:t.bg.base}}>
  <KeyboardAvoidingView className="flex-1" style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1,paddingHorizontal:briefing?t.space.briefing:t.space.form,paddingTop:t.space.large,paddingBottom:t.space.section,gap:t.space.briefing}}>{children}</ScrollView>
   {footer}
  </KeyboardAvoidingView>
 </SafeAreaView>;
}
export function Back({onPress}:{onPress:()=>void}) {return <Link label={pt.back} onPress={onPress}/>;}
export function Loading({message}:{message:string}) {
 const t=useTheme();return <Page><Type size="title" header>{message}</Type><View accessibilityRole="progressbar" accessibilityLabel={message} style={{height:t.metrics.skeleton,backgroundColor:t.bg.track,borderRadius:t.radius.card}}/><Type tone="secondary">{pt.initialHelp}</Type></Page>;
}
