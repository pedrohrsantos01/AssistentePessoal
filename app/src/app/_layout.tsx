import '../../global.css';
import {Slot} from 'expo-router';
import {ThemeProvider} from '../theme/theme.tsx';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
export default function Layout() {return <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><ThemeProvider><StatusBar style="auto"/><Slot/></ThemeProvider></SafeAreaProvider></GestureHandlerRootView>;}
