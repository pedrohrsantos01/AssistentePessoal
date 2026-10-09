import {create} from 'zustand';
// Navigation/drafts only. Domain data always comes from Journey/SQLite.
export type Surface='welcome'|'register'|'login'|'briefing'|'habits'|'settings'|'create'|'reauth';
export const useNavigation=create<{key:string|null;surface:Surface;privacy:boolean;logout:boolean;draft:string;go:(surface:Surface)=>void;bind:(key:string|null)=>void;setPrivacy:(value:boolean)=>void;setLogout:(value:boolean)=>void;setDraft:(value:string)=>void}>(set=>({
 key:null,surface:'welcome',privacy:false,logout:false,draft:'',
 go:surface=>set({surface}),bind:key=>set(state=>state.key===key?state:{key,surface:key?'briefing':'welcome',privacy:false,logout:false,draft:''}),
 setPrivacy:privacy=>set({privacy}),setLogout:logout=>set({logout}),setDraft:draft=>set({draft}),
}));
