import {useEffect,type ReactNode} from 'react';
import {AccessibilityInfo,FlatList,useWindowDimensions,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {pt} from '../../i18n/pt-BR.ts';
import {useTheme} from '../../theme/theme.tsx';
import type {HabitColor} from '../../theme/tokens.ts';
import {Banner,Button,Card,Sheet,Touch,Type} from '../../ui/primitives.tsx';
import type {Journey,JourneyState} from '../journey/journey.ts';
import {habitGlyph} from './catalog.ts';
type ManagedHabit=NonNullable<JourneyState['local']>['managementHabits'][number];
export function DeleteConfirmation({journey,state,habit,close,deleted}:{journey:Journey;state:JourneyState;habit:{habitId:string;title:string};close:()=>void;deleted:()=>void}) {
 const available=state.local?.managementHabits.some(item=>item.habitId===habit.habitId)??false;
 useEffect(()=>{AccessibilityInfo.announceForAccessibility(pt.deleteTitle);},[]);
 const cancel=()=>{journey.clearError();close();};
 return <Sheet onClose={cancel} label={pt.deleteTitle}><Type size="section" semibold header>{pt.deleteTitle}</Type><Type size="body" semibold>{habit.title}</Type><Type tone="secondary">{pt.deleteBody}</Type>
  {!available&&<Banner message={pt.habitUnavailable} error/>}{state.error&&<Banner message={state.error} error/>}
  <Button label={pt.deleteHabit} disabled={!state.writable||!available} onPress={()=>{if(journey.delete(habit.habitId)) deleted();}}/><Button label={pt.cancel} secondary onPress={cancel}/>
 </Sheet>;
}
export function HabitManagement({journey,state,footer,notice,create,edit}:{journey:Journey;state:JourneyState;footer:ReactNode;notice?:ReactNode;create:()=>void;edit:(id:string)=>void}) {
 const t=useTheme(),habits=state.local!.managementHabits,{fontScale}=useWindowDimensions(),reflow=fontScale>t.metrics.reflowScale;
 const render=({item:habit,index}:{item:ManagedHabit;index:number})=>{
  const color=habit.colorToken&&Object.hasOwn(t.habitColors,habit.colorToken)?t.habitColors[habit.colorToken as HabitColor]:t.accent.text;
  return <View style={{minHeight:t.metrics.habitRow,flexDirection:reflow?'column':'row',alignItems:reflow?'stretch':'center',gap:t.space.small,borderTopWidth:index?t.metrics.border:t.space.none,borderTopColor:t.border.decorative}}><Touch accessibilityRole="button" accessibilityLabel={pt.editLabel(habit.title)} accessibilityHint={pt.position(index,habits.length)} onPress={()=>edit(habit.habitId)} disabled={!state.writable} accessibilityState={{disabled:!state.writable}} style={{flex:reflow?undefined:1,minHeight:t.metrics.managementRow,flexDirection:'row',alignItems:'center',gap:t.space.medium,paddingVertical:t.space.compact,paddingHorizontal:t.space.micro}}>
    <View style={{width:t.metrics.habitTile,height:t.metrics.habitTile,borderRadius:t.radius.tile,backgroundColor:t.habitSoft(color),alignItems:'center',justifyContent:'center'}}><Type size="tile">{habitGlyph(habit.iconKey)}</Type></View><View style={{flex:1,gap:t.space.tiny}}><Type style={{lineHeight:t.typeSize.body*t.line.row}}>{habit.title}</Type><Type size="caption" mono tone="secondary">{pt.daily}</Type></View><Type tone="secondary">{pt.symbols.chevron}</Type>
   </Touch><View style={{flexDirection:'row',alignItems:'center',gap:t.space.small,alignSelf:reflow?'flex-end':undefined,paddingBottom:reflow?t.space.compact:t.space.none}}>
    <Button compact secondary displayLabel={pt.up} label={pt.moveLabel(habit.title,-1)} disabled={!state.writable||index===0} onPress={()=>journey.move(habit.habitId,-1)} style={{width:t.metrics.touch,paddingHorizontal:t.space.none,borderWidth:t.metrics.border}}/>
    <Button compact secondary displayLabel={pt.down} label={pt.moveLabel(habit.title,1)} disabled={!state.writable||index===habits.length-1} onPress={()=>journey.move(habit.habitId,1)} style={{width:t.metrics.touch,paddingHorizontal:t.space.none,borderWidth:t.metrics.border}}/>
   </View></View>;
 };
 return <SafeAreaView style={{flex:1,backgroundColor:t.bg.base}}><View style={{flex:1,paddingHorizontal:t.space.briefing,paddingTop:t.space.controlGap,paddingBottom:t.space.form,gap:t.space.inputInset}}>{notice}<View style={{flexDirection:'row',alignItems:'center',gap:t.space.controlGap,paddingTop:t.space.micro,paddingHorizontal:t.space.tiny}}><Type size="title" semibold header style={{flex:1}}>{pt.habits}</Type><Button compact textSize="context" label={pt.newHabit} displayLabel={pt.newShort} disabled={!state.writable} onPress={create} style={{paddingHorizontal:t.space.large}}/></View>
  {state.error&&<Banner message={state.error} error/>}
  {habits.length?<Card style={{flexShrink:1,paddingVertical:t.space.micro,paddingHorizontal:t.space.small,gap:t.space.none}}><FlatList data={habits} keyExtractor={habit=>habit.habitId} renderItem={render} extraData={state} style={{flexGrow:0}} contentContainerStyle={{flexGrow:0}}/></Card>:<View style={{paddingVertical:t.space.form,paddingHorizontal:t.space.micro,gap:t.space.controlGap}}><Type size="tile" semibold header>{pt.emptyManagement}</Type><Type size="context" tone="secondary">{pt.managementHelp}</Type></View>}
 </View>{footer}</SafeAreaView>;
}
