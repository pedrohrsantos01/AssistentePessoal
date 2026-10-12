import {createContext,useContext,useSyncExternalStore,type ReactNode} from 'react';
import {useColorScheme} from 'react-native';
import {tokens,type Theme} from './tokens.ts';
import {effectiveMode,type AppearancePreferences} from '../core/preferences/appearance.ts';
const Context=createContext<Theme|null>(null),PreferencesContext=createContext<AppearancePreferences|null>(null);
const emptySubscribe=()=>()=>{},emptyState=()=>null;
export function ThemeProvider({children,value,preferences}:{children:ReactNode;value?:Theme;preferences?:AppearancePreferences|null}) {
 const system=useColorScheme(),state=useSyncExternalStore(preferences?.subscribe??emptySubscribe,preferences?.state??emptyState);
 const theme=value??tokens(effectiveMode(state?.appearance.mode??'system',system),state?.appearance.skin??'holo');
 return <PreferencesContext.Provider value={preferences??null}><Context.Provider value={theme}>{children}</Context.Provider></PreferencesContext.Provider>;
}
export function useTheme() {const theme=useContext(Context);if(!theme) throw new Error('theme_required');return theme;}
export function useAppearancePreferences(){return useContext(PreferencesContext);}
