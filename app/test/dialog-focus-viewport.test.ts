import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DialogFocusViewport} from '../src/ui/dialog-focus-viewport.ts';

function fixture(top=900) {
 const frames:(()=>void)[]=[],measures:(()=>void)[]=[],scrolls:number[]=[],selected:string[]=[];
 let offset=0,live=true;
 const viewport=new DialogFocusViewport(work=>frames.push(work));
 const port={measureInWindow:(cb:(x:number,y:number,width:number,height:number)=>void)=>cb(0,100,400,600),scrollTo:({y}:{y:number;animated:false})=>{scrolls.push(y);}};
 const host={measureInWindow:(cb:(x:number,y:number,width:number,height:number)=>void)=>measures.push(()=>cb(10,top-offset,300,100))};
 viewport.attach(port);
 const measure=()=>{for(const task of measures.splice(0))task();};
 const frame=()=>{for(const task of frames.splice(0))task();};
 return {viewport,port,scrolls,selected,measure,frame,reveal:()=>viewport.reveal(host,()=>live,()=>selected.push('target')),scroll:(y:number)=>{offset=y;viewport.scrolled(y);},invalidate:()=>{live=false;}};
}

test('an offscreen nested opener is selected only after native measurement proves it was revealed',()=>{
 const f=fixture();f.reveal();f.measure();assert.deepEqual(f.scrolls,[300]);assert.deepEqual(f.selected,[]);
 f.scroll(300);f.frame();assert.deepEqual(f.selected,[]);f.measure();assert.deepEqual(f.selected,['target']);
});

test('a title above the resumed viewport is brought back into view',()=>{
 const f=fixture(150);f.scroll(300);f.reveal();f.measure();assert.deepEqual(f.scrolls,[50]);assert.deepEqual(f.selected,[]);
 f.scroll(50);f.frame();f.measure();assert.deepEqual(f.selected,['target']);
});

for(const preemption of ['scope','window'] as const)test('pending reveal rejects an old '+preemption,()=>{
 const f=fixture();f.reveal();f.measure();if(preemption==='scope')f.invalidate();else f.viewport.attach(null);
 f.scroll(300);f.frame();f.measure();assert.deepEqual(f.selected,[]);
});

test('a frame without a native position change cannot count as successful focus',()=>{
 const f=fixture();f.reveal();f.measure();for(let i=0;i<4;i++){f.frame();f.measure();}
 assert.deepEqual(f.selected,[]);assert.equal(f.scrolls.length,3);
});


test('a resumed opener on the native pixel boundary is revealed despite float DIP rounding',()=>{
 const density=2.625,frames:(()=>void)[]=[],selected:string[]=[],scrolls:number[]=[];let pixels=0;
 // Bounds from the failed Android capture: viewport [0,294][1080,2424], opener [98,2187][984,2424].
 // Android scrollTo rounds to pixels; measure callbacks return float DIP values.
 const viewport=new DialogFocusViewport(work=>frames.push(work),density);
 const port={measureInWindow:(cb:(x:number,y:number,width:number,height:number)=>void)=>cb(0,Math.fround(294/density),Math.fround(1080/density),Math.fround(2130/density)),scrollTo:({y}:{y:number;animated:false})=>{pixels=Math.round(y*density);scrolls.push(pixels);viewport.scrolled(Math.fround(pixels/density));}};
 const host={measureInWindow:(cb:(x:number,y:number,width:number,height:number)=>void)=>cb(Math.fround(98/density),Math.fround((2187-pixels)/density),Math.fround(886/density),Math.fround(237/density))};
 viewport.attach(port);viewport.reveal(host,()=>true,()=>selected.push('opener'));
 for(let i=0;i<4;i++)for(const task of frames.splice(0))task();
 assert.deepEqual(selected,['opener']);assert.equal(scrolls[0],1);assert.equal(scrolls.length,1);
});
