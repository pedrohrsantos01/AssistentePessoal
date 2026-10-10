import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tokens,blend,type Skin,type ColorMode} from '../src/theme/tokens.ts';
const luminance=(hex:string)=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4).reduce((sum,c,index)=>sum+c*[0.2126,0.7152,0.0722][index]!,0);
const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
for(const skin of ['holo','cockpit','neo'] as Skin[]) for(const mode of ['dark','light'] as ColorMode[]) test(skin+' '+mode+' permitted native text and interactive pairs pass contrast',()=>{
 const t=tokens(mode,skin);
 for(const background of [t.bg.base,t.bg.elevated,t.bg.input,t.decoration.scan]) for(const foreground of [t.text.primary,t.text.secondary,t.text.link,t.accent.text]) assert.ok(contrast(foreground,background)>=4.5,foreground+' on '+background);
 for(const background of [t.bg.accentSoft,t.bg.warning,t.bg.error]) assert.ok(contrast(t.text.primary,background)>=4.5);
 for(const color of Object.values(t.habitColors)) {assert.ok(contrast(t.text.onAccent,color)>=4.5);assert.ok(contrast(color,t.bg.elevated)>=3);}
 assert.ok(contrast(t.text.onAccent,t.accent.fill)>=4.5);assert.ok(contrast(t.toast.text,t.toast.bg)>=4.5);assert.ok(contrast(t.toast.link,t.toast.bg)>=4.5);
 // Fields and transparent controls must contrast with both adjacent surfaces.
 for(const background of [t.bg.base,t.bg.elevated,t.bg.input,t.bg.inputElevated]) {
  for(const foreground of [t.text.primary,t.text.secondary,t.text.link]) assert.ok(contrast(foreground,background)>=4.5);
  for(const border of [t.border.interactive,t.border.input,t.border.inputElevated]) assert.ok(contrast(border,background)>=3,border+' boundary on '+background);
 }
 assert.ok(contrast(t.accent.fill,t.bg.elevated)>=3);
 assert.equal(t.metrics.touch,44);assert.ok(t.metrics.button>=44);
 // Dim text on an accent surface is deliberately excluded from the allowed pairs.
 assert.ok(contrast(t.text.primary,blend(t.accent.fill,t.bg.base,0.13))>=4.5);
});
