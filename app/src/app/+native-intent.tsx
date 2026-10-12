import {receivePasswordResetPath} from '../core/identity/password-reset-intent.ts';
export function redirectSystemPath({path}:{path:string;initial:boolean}):string {
 const origin=process.env.EXPO_PUBLIC_RITMO_JOURNEY_TEST==='1'?'https://api.example.test':process.env.EXPO_PUBLIC_RITMO_API_ORIGIN;
 return receivePasswordResetPath(path,origin);
}
