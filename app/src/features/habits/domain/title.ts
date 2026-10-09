import {caseFold} from './case-fold.ts';
// The same normalization version as contracts/primeiro-marco and ICU4J on the server.
export function titleKey(title:string):string {
 const folded=Array.from(title.normalize('NFKC'),character=>caseFold[character.codePointAt(0)!]??character).join('');
 return folded.replace(/\p{White_Space}+/gu,' ').replace(/^ +| +$/g,'');
}
