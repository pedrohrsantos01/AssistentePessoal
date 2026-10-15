import {useCallback,useState,type ComponentProps} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider} from '../../src/theme/theme.tsx';
import {tokens} from '../../src/theme/tokens.ts';
import {Button,Input,Sheet,Type} from '../../src/ui/primitives.tsx';
import {DialogFocusScope} from '../../src/ui/dialog-focus.tsx';
import type {DialogFocusDriver} from '../../src/ui/dialog-focus-controller.ts';
import {pt} from '../../src/i18n/pt-BR.ts';
type Host=Parameters<NonNullable<ComponentProps<typeof DialogFocusScope>['driver']>['focus']>[0];
const identity={};
function adapter(){
 const frames:(()=>void)[]=[],acknowledgements:(()=>void)[]=[],focused:Host[]=[];
 const driver:DialogFocusDriver<Host>={afterCommit:work=>{frames.push(work);},focus:(host,eligible)=>{acknowledgements.push(()=>{if(eligible())focused.push(host);});}};
 const frame=()=>{const tasks=frames.splice(0);for(const task of tasks)task();};
 const acknowledge=()=>{const tasks=acknowledgements.splice(0);for(const task of tasks)task();};
 return {driver,focused,frame,acknowledge};
}
function Scene({scope,driver,disabled=false}:{scope:string;driver:DialogFocusDriver<Host>;disabled?:boolean}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState('preservado'),readScope=useCallback(()=>scope,[scope]);
 return <SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:0,left:0,right:0,bottom:0}}}><ThemeProvider value={tokens('dark')}><DialogFocusScope scope={readScope} identity={identity} driver={driver}>
  <Input label={pt.name} value={draft} onChangeText={setDraft}/><Button label={pt.privacy} dialogKey="privacy" disabled={disabled} onPress={()=>setOpen(true)}/>
  <Sheet label={pt.privacyTitle} visible={open} onClose={()=>setOpen(false)}><Type>{pt.privacyBody}</Type><Button label={pt.close} onPress={()=>setOpen(false)}/></Sheet>
 </DialogFocusScope></ThemeProvider></SafeAreaProvider>;
}

function show(){
 let node:ReturnType<typeof screen.getByRole>|null=screen.getByRole('header',{name:pt.privacyTitle});
 while(node&&typeof node.props.onShow!=='function')node=node.parent;
 if(!node)throw new Error('modal_show_handler_missing');
 return fireEvent(node,'show');
}

test('Sheet focuses its single title on show, then returns to the opener without altering draft',async()=>{
 const f=adapter();await render(<Scene scope="A" driver={f.driver}/>);
 await fireEvent.press(screen.getByRole('button',{name:pt.privacy}));expect(screen.getAllByRole('header',{name:pt.privacyTitle})).toHaveLength(1);expect(f.focused).toHaveLength(0);
 await show();await act(()=>f.acknowledge());expect(f.focused).toHaveLength(1);
 await fireEvent.press(screen.getByRole('button',{name:pt.close}));await act(()=>{f.frame();f.acknowledge();});expect(f.focused).toHaveLength(2);expect(f.focused[1]).not.toBe(f.focused[0]);expect(screen.getByLabelText(pt.name)).toHaveDisplayValue('preservado');
});

test('the scope change rejects a queued title and return even if the control remains mounted',async()=>{
 const f=adapter();await render(<Scene scope="account-A" driver={f.driver}/>);await fireEvent.press(screen.getByRole('button',{name:pt.privacy}));await show();
 await fireEvent.press(screen.getByRole('button',{name:pt.close}));await act(()=>f.frame());await screen.rerender(<Scene scope="recovery-or-account-B" driver={f.driver}/>);await act(()=>f.acknowledge());expect(f.focused).toHaveLength(0);
});

test('an opener disabled after cancellation cannot receive the delayed native return',async()=>{
 const f=adapter();await render(<Scene scope="A" driver={f.driver}/>);await fireEvent.press(screen.getByRole('button',{name:pt.privacy}));await show();await act(()=>f.acknowledge());
 await fireEvent.press(screen.getByRole('button',{name:pt.close}));await act(()=>f.frame());await screen.rerender(<Scene scope="A" driver={f.driver} disabled/>);await act(()=>f.acknowledge());expect(f.focused).toHaveLength(1);
});


test('a state fence rejects focus before React commits its new scope',async()=>{
 const f=adapter(),realm={current:'A'},readScope=()=>realm.current;
 await render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:0,left:0,right:0,bottom:0}}}><ThemeProvider value={tokens('dark')}><DialogFocusScope scope={readScope} identity={identity} driver={f.driver}><Sheet label={pt.logoutTitle} onClose={()=>{}}><Type>{pt.logoutBody}</Type></Sheet></DialogFocusScope></ThemeProvider></SafeAreaProvider>);
 // The native onShow is real lifecycle input at the public Sheet seam; only layout completion is held.
 let node:ReturnType<typeof screen.getByRole>|null=screen.getByRole('header',{name:pt.logoutTitle});while(node&&typeof node.props.onShow!=='function')node=node.parent;if(!node)throw new Error('modal_show_handler_missing');
 await fireEvent(node,'show');realm.current='logged-out';await act(()=>f.acknowledge());expect(f.focused).toHaveLength(0);
});
