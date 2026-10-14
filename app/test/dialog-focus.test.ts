import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DialogFocusController, type DialogControl, type DialogWindow} from '../src/ui/dialog-focus-controller.ts';

function fixture() {
 const frames: (() => void)[] = [], measurements: (() => void)[] = [], focused: string[] = [];
 const controller = new DialogFocusController<string>({afterCommit: work => {frames.push(work);}, focus: (host, eligible) => {measurements.push(() => {if (eligible()) focused.push(host);});}});
 const control = (key: string, owner: string | null = null, host = key): DialogControl<string> => {
  const target = {key, owner, host: host as string | null, enabled: true};controller.register(target);return target;
 };
 const window = (id: string): DialogWindow<string> => ({id, visible:false, shown:false, title:'title:'+id, opener:null});
 const frame = () => {const tasks = frames.splice(0);for (const task of tasks) task();};
 const measure = () => {const tasks = measurements.splice(0);for (const task of tasks) task();};
 return {controller, control, window, frame, measure, focused};
}

test('opening waits for native presentation and layout, focuses the title once without activating the opener', () => {
 const f=fixture(),button=f.control('privacy'),sheet=f.window('privacy');
 f.controller.activate(button);f.controller.begin(sheet);f.measure();assert.deepEqual(f.focused,[]);
 f.controller.present(sheet);assert.deepEqual(f.focused,[]);f.measure();assert.deepEqual(f.focused,['title:privacy']);
 f.controller.present(sheet);f.measure();assert.deepEqual(f.focused,['title:privacy']);
});

test('cancel restores the registered opener only after commit and native layout', () => {
 const f=fixture(),button=f.control('delete'),sheet=f.window('delete');
 f.controller.activate(button);f.controller.begin(sheet);f.controller.present(sheet);f.measure();
 f.controller.end(sheet);f.measure();assert.deepEqual(f.focused,['title:delete']);
 f.frame();assert.deepEqual(f.focused,['title:delete']);f.measure();assert.deepEqual(f.focused,['title:delete','delete']);
});

for(const moment of ['before-presentation','after-presentation','after-dismissal'] as const) {
 test('scope preemption fences old callbacks: '+moment, () => {
  const f=fixture(),button=f.control('account-A'),sheet=f.window('logout');
  f.controller.activate(button);f.controller.begin(sheet);
  if(moment==='before-presentation') {f.controller.invalidate();f.controller.present(sheet);}
  else {f.controller.present(sheet);if(moment==='after-dismissal'){f.controller.end(sheet);f.frame();}f.controller.invalidate();}
  f.measure();assert.deepEqual(f.focused,[]);
 });
}

for(const change of ['removed','disabled','replaced'] as const) {
 test('late layout cannot restore an opener that became '+change, () => {
  const f=fixture(),button=f.control('opener'),sheet=f.window('sheet');
  f.controller.activate(button);f.controller.begin(sheet);f.controller.present(sheet);f.measure();f.controller.end(sheet);f.frame();
  if(change==='removed'){button.host=null;f.controller.register(button);}
  if(change==='disabled')button.enabled=false;
  if(change==='replaced')f.control('opener',null,'different-host');
  f.measure();assert.deepEqual(f.focused,['title:sheet']);
 });
}

test('a new window cancels the old return even with the page opener still mounted', () => {
 const f=fixture(),button=f.control('opener'),first=f.window('first'),second=f.window('second');
 f.controller.activate(button);f.controller.begin(first);f.controller.present(first);f.measure();f.controller.end(first);f.frame();
 f.controller.begin(second);f.controller.present(second);f.measure();assert.deepEqual(f.focused,['title:first','title:second']);
});

test('nested review resumes the recreated parent control, then parent cancellation restores the page', () => {
 const f=fixture(),page=f.control('sync-settings'),parent=f.window('sync'),child=f.window('review');
 f.controller.activate(page);f.controller.begin(parent);f.controller.present(parent);f.measure();
 const original=f.control('review-operation','sync','old-review-button');f.controller.activate(original);
 f.controller.end(parent);original.host=null;f.controller.register(original);f.controller.begin(child);f.controller.present(child);f.frame();f.measure();
 assert.deepEqual(f.focused,['title:sync','title:review']);
 f.controller.end(child);f.controller.begin(parent);f.control('review-operation','sync','new-review-button');
 f.controller.present(parent);f.frame();f.measure();assert.deepEqual(f.focused,['title:sync','title:review','new-review-button']);
 f.controller.end(parent);f.frame();f.measure();assert.equal(f.focused.at(-1),'sync-settings');
});

test('if the reviewed operation disappeared, the resumed panel focuses its own title, not an old control', () => {
 const f=fixture(),page=f.control('sync'),parent=f.window('panel'),child=f.window('review');
 f.controller.activate(page);f.controller.begin(parent);f.controller.present(parent);f.measure();
 const target=f.control('operation','panel');f.controller.activate(target);f.controller.end(parent);target.host=null;f.controller.register(target);
 f.controller.begin(child);f.controller.present(child);f.frame();f.measure();f.controller.end(child);f.controller.begin(parent);f.controller.present(parent);f.frame();f.measure();
 assert.deepEqual(f.focused,['title:panel','title:review','title:panel']);
});
