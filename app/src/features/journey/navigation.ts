import {create} from 'zustand';
import type {JourneyState} from './journey.ts';
// Navigation/drafts only. Domain data always comes from Journey/SQLite.
export type Surface='welcome'|'register'|'login'|'briefing'|'habits'|'settings'|'create'|'reauth'|'edit'|'sync';
export const useNavigation=create<{key:string|null;gate:JourneyState['gate']|null;surface:Surface;syncFrom:'briefing'|'settings';privacy:boolean;logout:boolean;draft:string;editingId:string|null;formFrom:'briefing'|'habits';edit:(id:string)=>void;create:()=>void;go:(surface:Surface)=>void;bind:(key:string|null,gate:JourneyState['gate'])=>void;setPrivacy:(value:boolean)=>void;setLogout:(value:boolean)=>void;setDraft:(value:string)=>void}>(set=>({
 key:null,gate:null,surface:'welcome',syncFrom:'briefing',privacy:false,logout:false,draft:'',editingId:null,formFrom:'briefing',
 edit:editingId=>set({editingId,surface:'edit',formFrom:'habits'}),create:()=>set(state=>({surface:'create',editingId:null,formFrom:state.surface==='habits'?'habits':'briefing'})),
 go:surface=>set(state=>surface==='sync'?{surface,syncFrom:state.surface==='settings'?'settings':'briefing'}:{surface}),bind:(key,gate)=>set(state=>state.key===key&&state.gate===gate?state:{key,gate,surface:key?'briefing':'welcome',syncFrom:'briefing',privacy:false,logout:false,draft:'',editingId:null,formFrom:'briefing'}),
 setPrivacy:privacy=>set({privacy}),setLogout:logout=>set({logout}),setDraft:draft=>set({draft}),
}));
