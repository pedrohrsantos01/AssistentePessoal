import {useEffect,type ReactNode} from 'react';
import {AccessibilityInfo,FlatList,Modal,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {pt} from '../../i18n/pt-BR.ts';
import {useTheme} from '../../theme/theme.tsx';
import type {HabitColor} from '../../theme/tokens.ts';
import {Banner,Button,Card,Page,Touch,Type} from '../../ui/primitives.tsx';
import type {Journey,JourneyState} from '../journey/journey.ts';
import {habitGlyph} from './catalog.ts';
type ManagedHabit=NonNullable<JourneyState['local']>['managementHabits'][number];
export function DeleteConfirmation({journey,state,habit,close,deleted}:{journey:Journey;state:JourneyState;habit:{habitId:string;title:string};close:()=>void;deleted:()=>void}) {
 const available=state.local?.managementHabits.some(item=>item.habitId===habit.habitId)??false;
 useEffect(()=>{AccessibilityInfo.announceForAccessibility(pt.deleteTitle);},[]);
 const cancel=()=>{journey.clearError();close();};
 return <Modal visible animationType="none" onRequestClose={cancel}><Page><Type size="title" bold header>{pt.deleteTitle}</Type><Type size="section" bold>{habit.title}</Type><Type tone="secondary">{pt.deleteBody}</Type>
  {!available&&<Banner message={pt.habitUnavailable} error/>}{state.error&&<Banner message={state.error} error/>}
  <Button label={pt.deleteHabit} disabled={!state.writable||!available} onPress={()=>{if(journey.delete(habit.habitId)) deleted();}}/><Button label={pt.cancel} secondary onPress={cancel}/>
 </Page></Modal>;
}
export function HabitManagement({journey,state,footer,create,edit}:{journey:Journey;state:JourneyState;footer:ReactNode;create:()=>void;edit:(id:string)=>void}) {
 const t=useTheme(),habits=state.local!.managementHabits;
 const render=({item:habit,index}:{item:ManagedHabit;index:number})=>{
  const color=habit.colorToken&&Object.hasOwn(t.habitColors,habit.colorToken)?t.habitColors[habit.colorToken as HabitColor]:t.accent.text;
  return <Card><Touch accessibilityRole="button" accessibilityLabel={pt.editLabel(habit.title)} onPress={()=>edit(habit.habitId)} disabled={!state.writable} accessibilityState={{disabled:!state.writable}} style={{minHeight:t.metrics.habitRow,flexDirection:'row',alignItems:'center',gap:t.space.medium}}>
    <Type size="section" style={{color}}>{habitGlyph(habit.iconKey)}</Type><View style={{flex:1,gap:t.space.compact}}><Type>{habit.title}</Type><Type size="caption" mono tone="secondary">{pt.daily}</Type></View>
   </Touch><View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:t.space.small}}><Type size="caption" mono tone="secondary">{pt.position(index,habits.length)}</Type>
    <Button compact secondary displayLabel={pt.up} label={pt.moveLabel(habit.title,-1)} disabled={!state.writable||index===0} onPress={()=>journey.move(habit.habitId,-1)}/>
    <Button compact secondary displayLabel={pt.down} label={pt.moveLabel(habit.title,1)} disabled={!state.writable||index===habits.length-1} onPress={()=>journey.move(habit.habitId,1)}/>
   </View></Card>;
 };
 return <SafeAreaView style={{flex:1,backgroundColor:t.bg.base}}><FlatList data={habits} keyExtractor={habit=>habit.habitId} renderItem={render} extraData={state}
  contentContainerStyle={{flexGrow:1,paddingHorizontal:t.space.briefing,paddingTop:t.space.large,paddingBottom:t.space.section,gap:t.space.briefing}}
  ListHeaderComponent={<View style={{gap:t.space.briefing}}><Type size="caption" mono tone="accent">{pt.brand} · {pt.habits}</Type><Type size="title" bold header>{pt.habits}</Type><Type size="caption" mono>{state.remote}</Type><Button label={pt.newHabit} disabled={!state.writable} onPress={create}/>{state.error&&<Banner message={state.error} error/>}</View>}
  ListEmptyComponent={<Card><Type size="section" bold header>{pt.emptyManagement}</Type><Type tone="secondary">{pt.managementHelp}</Type></Card>}
 />{footer}</SafeAreaView>;
}
