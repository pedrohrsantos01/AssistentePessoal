// Values transcribed from spec/11 and the received M1. Components use semantic roles.
export type Skin='holo'|'cockpit'|'neo';
export type ColorMode='dark'|'light';
const palettes={
  "cockpit": {
    "dark": {
      "bg": "#06080B",
      "surf": "#0D141A",
      "bord": "#1C2A33",
      "text": "#DCEAF0",
      "dim": "#93A8B2",
      "accent": "#3EE0FF",
      "accentText": "#3EE0FF",
      "onAccent": "#04161C",
      "warn": "#F0A93B",
      "err": "#FF8A7A",
      "link": "#6FE8FF"
    },
    "light": {
      "bg": "#EEF3F5",
      "surf": "#FFFFFF",
      "bord": "#D3DEE3",
      "text": "#0D1A20",
      "dim": "#4F6873",
      "accent": "#07758C",
      "accentText": "#06687C",
      "onAccent": "#FFFFFF",
      "warn": "#8F5609",
      "err": "#B42318",
      "link": "#06687C"
    }
  },
  "neo": {
    "dark": {
      "bg": "#0D0A12",
      "surf": "#171022",
      "bord": "#2D2040",
      "text": "#EFE9F6",
      "dim": "#AEA2C0",
      "accent": "#FF5FA2",
      "accentText": "#FF7DB3",
      "onAccent": "#12060C",
      "warn": "#FFC24D",
      "err": "#FF8A7A",
      "link": "#FF8DBD"
    },
    "light": {
      "bg": "#F6F1F7",
      "surf": "#FFFFFF",
      "bord": "#E8DCEB",
      "text": "#1E1424",
      "dim": "#665770",
      "accent": "#C2296D",
      "accentText": "#AD2261",
      "onAccent": "#FFFFFF",
      "warn": "#8F5609",
      "err": "#B42318",
      "link": "#AD2261"
    }
  },
  "holo": {
    "dark": {
      "bg": "#04090F",
      "surf": "#08141D",
      "bord": "#143D50",
      "text": "#D7ECF5",
      "dim": "#88AEBF",
      "accent": "#63F5D8",
      "accentText": "#63F5D8",
      "onAccent": "#031511",
      "warn": "#FFB661",
      "err": "#FF8A7A",
      "link": "#7FF7E0"
    },
    "light": {
      "bg": "#EDF4F4",
      "surf": "#FFFFFF",
      "bord": "#C7DCDF",
      "text": "#0B1B20",
      "dim": "#4B6972",
      "accent": "#0B7A68",
      "accentText": "#096B5B",
      "onAccent": "#FFFFFF",
      "warn": "#8F5609",
      "err": "#B42318",
      "link": "#096B5B"
    }
  }
} as const;
export const space={none:0,tiny:2,micro:4,compact:6,small:8,controlGap:10,medium:12,inputInset:14,large:16,briefing:18,buttonInset:20,form:24,section:32,hero:40,wide:48,logo:64} as const;
export const metrics={reflowScale:1.4,sheetRadius:22,sheetHandleWidth:40,sheetHandleHeight:5,sheetMaxHeight:'82%',pillRadius:999,tabIcon:22,tabGap:3,tabHeight:49,stepTrack:4,stepLetter:0.96,sectionLetter:1.44,brandLetter:-0.4,iconColumns:5,iconBorder:2,swatchBorder:3,swatchRadius:24,previewTile:32,habitTile:34,managementRow:56,profileLabel:110,profileRow:52,sheetOverlayOpacity:0.56,welcomeMin:360,passwordToggle:76,touch:44,input:48,button:52,habitRow:60,check:28,tile:36,border:1,controlBorder:1.5,bracket:10,bracketOffset:5,pressedOpacity:0.82,disabledOpacity:0.55,scanPeriod:4,scanLine:1,skeleton:160,track:8,swatch:48,full:'100%',half:'48%'} as const;
export const motion={press:120,state:200,max:320,feedback:1400,pressedScale:0.98} as const;
export const typeSize={tab:11,caption:12,status:13,label:14,context:15,body:16,tile:17,lead:18,control:20,section:22,mark:24,title:28,hour:32,number:36,brand:40} as const;
export const line={body:1.45,title:1.2,briefing:1.15,row:1.3,context:1.4,onboarding:1.5,hint:1.35,brand:1.05,number:1} as const;
const radii={holo:{card:4,button:4,inner:4,check:4,tile:4},cockpit:{card:10,button:8,inner:6,check:5,tile:6},neo:{card:20,button:999,inner:12,check:9,tile:11}} as const;
export const fontNames={chakra:{regular:'ChakraPetch_400Regular',medium:'ChakraPetch_500Medium',semibold:'ChakraPetch_600SemiBold',bold:'ChakraPetch_700Bold'},space:{regular:'SpaceGrotesk_400Regular',medium:'SpaceGrotesk_500Medium',semibold:'SpaceGrotesk_600SemiBold',bold:'SpaceGrotesk_700Bold'},mono:{regular:'JetBrainsMono_400Regular',medium:'JetBrainsMono_500Medium',bold:'JetBrainsMono_700Bold'}} as const;
export function blend(front:string,back:string,alpha:number):string {
  const rgb=(hex:string)=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
  const foreground=rgb(front),background=rgb(back);
  return '#'+foreground.map((channel,index)=>Math.round(channel*alpha+background[index]!*(1-alpha)).toString(16).padStart(2,'0')).join('');
}
export function tokens(mode:ColorMode,skin:Skin='holo') {
 const p=palettes[skin][mode],dark=mode==='dark';
 // A transparent control can border base, surface, or input; this boundary contrasts with all three.
 const controlBoundary=blend(p.text,dark?p.surf:p.bg,0.48);
 return {skin,mode,space,metrics,motion,typeSize,line,radius:radii[skin],
  fonts:{body:skin==='neo'?fontNames.space:fontNames.chakra,mono:fontNames.mono},
  bg:{welcomeAccentSoft:blend(p.accent,p.bg,0.13),base:p.bg,elevated:p.surf,tab:dark?p.bg:blend(p.surf,p.bg,0.97),overlay:dark?'rgba(0,0,0,0.62)':'rgba(10,20,25,0.42)',transparent:'transparent',input:dark?blend('#FFFFFF',p.bg,0.03):'#F7F9FA',inputElevated:dark?blend('#FFFFFF',p.surf,0.03):'#F7F9FA',accentSoft:blend(p.accent,p.surf,0.13),warning:blend(p.warn,p.surf,dark?0.12:0.1),error:blend(p.err,p.surf,dark?0.12:0.07),track:blend(dark?'#FFFFFF':'#000000',p.surf,dark?0.08:0.07)},
  text:{primary:p.text,secondary:p.dim,onAccent:p.onAccent,link:p.link},
  accent:{fill:p.accent,text:p.accentText,line:blend(p.accent,p.surf,0.45)},
  border:{decorative:p.bord,interactive:controlBoundary,input:controlBoundary,inputElevated:controlBoundary},
  status:{warning:p.warn,error:p.err},
  decoration:{scan:blend(p.accent,p.surf,dark?0.035:0.05),scanOpacity:dark?0.035:0.05},
  habitColors:{accent:p.accent,blue:dark?'#79B8FF':'#1F5FA8',amber:p.warn,violet:dark?'#B69CFF':'#5B3FC4',green:dark?'#7CE38B':'#2B6E37'},
  habitSoft:(color:string)=>blend(color,p.surf,dark?0.2:0.14),swatchCheck:dark?'#06080B':'#FFFFFF',
  toast:{bg:dark?'#F2F4F5':'#12181C',text:dark?'#0B1115':'#F2F4F5',link:dark?(skin==='neo'?'#AD2261':'#06687C'):(skin==='neo'?'#FF8DBD':skin==='cockpit'?'#6FE8FF':'#7FF7E0')},
 };
}
export type Theme=ReturnType<typeof tokens>;
export type HabitColor=keyof Theme['habitColors'];
