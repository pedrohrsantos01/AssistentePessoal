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
