import {createContext,useContext,type ReactNode} from 'react';
import {useColorScheme} from 'react-native';
import {tokens,type Theme} from './tokens.ts';
const Context=createContext<Theme|null>(null);
export function ThemeProvider({children,value}:{children:ReactNode;value?:Theme}) {
 const mode=useColorScheme()==='light'?'light':'dark';
 return <Context.Provider value={value??tokens(mode)}>{children}</Context.Provider>;
}
export function useTheme() {const theme=useContext(Context);if(!theme) throw new Error('theme_required');return theme;}
