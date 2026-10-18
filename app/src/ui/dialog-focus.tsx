import {createContext, useCallback, useContext, useLayoutEffect, useMemo, type ReactNode} from 'react';
import {AccessibilityInfo, PixelRatio, Platform, type View, type ScrollView} from 'react-native';
import {DialogFocusViewport} from './dialog-focus-viewport.ts';
import {DialogFocusController, type DialogControl, type DialogFocusDriver, type DialogWindow} from './dialog-focus-controller.ts';

type NativeHost = Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0];
type Host = {node:NativeHost;viewport:DialogFocusViewport|null};
const nativeDriver: DialogFocusDriver<Host> = {
  afterCommit: work => {requestAnimationFrame(work);},
  focus: (target, eligible) => {
    const host=target.node;
    const select=()=>{
      // Android's focus event reports input focus; hover enter selects the node for TalkBack.
      // Recheck the current identity after the asynchronous native layout acknowledgement.
      host.measure((_x, _y, width, height) => {
        if (width > 0 && height > 0 && eligible()) AccessibilityInfo.sendAccessibilityEvent(host, Platform.OS === 'android' ? 'viewHoverEnter' : 'focus');
      });
    };
    if(target.viewport)target.viewport.reveal(host,eligible,select);else select();
  },
};
const Scope = createContext<DialogFocusController<Host> | null>(null);
export const DialogViewport = createContext<DialogFocusViewport|null>(null);
export const DialogOwner = createContext<string | null>(null);
export function DialogFocusScope({children, scope, identity, driver=nativeDriver}: {children: ReactNode; scope: () => string; identity: object; driver?:DialogFocusDriver<Host>}) {
  const expectedScope=scope();
  const controller = useMemo(() => new DialogFocusController<Host>({
    afterCommit: driver.afterCommit,
    focus: (host,eligible) => driver.focus(host,()=>scope()===expectedScope&&eligible()),
  }), [scope, expectedScope, identity, driver]);
  useLayoutEffect(() => {controller.live = true; return () => controller.invalidate();}, [controller]);
  return <Scope.Provider value={controller}>{children}</Scope.Provider>;
}
export function useDialogControl(key: string | undefined, enabled: boolean) {
  const controller = useContext(Scope), owner = useContext(DialogOwner),viewport=useContext(DialogViewport);
  const control = useMemo<DialogControl<Host>>(() => ({key: key ?? '', owner, host: null, enabled}), [key, owner, controller, viewport]);
  useLayoutEffect(() => {control.enabled = enabled; return () => {control.enabled = false;};}, [control, enabled]);
  const ref = useCallback((host: View | null) => {control.host = host?{node:host,viewport}:null; if (key) controller?.register(control);}, [controller, control, key, viewport]);
  return {ref: key ? ref : null, activate: () => {if (key) controller?.activate(control);}};
}
export function useDialogWindow(id: string, visible: boolean) {
  const controller = useContext(Scope);
  const window = useMemo<DialogWindow<Host>>(() => ({id, visible: false, shown: false, title: null, opener: null}), [id, controller]);
  const viewport=useMemo(()=>new DialogFocusViewport(work=>requestAnimationFrame(work),PixelRatio.get()),[window]);
  useLayoutEffect(() => {
    if (!visible) return;
    controller?.begin(window);
    return () => controller?.end(window);
  }, [controller, window, visible]);
  return {viewport, scrollRef:useCallback((scroll:ScrollView|null)=>{const host=scroll?.getNativeScrollRef();viewport.attach(scroll&&host?{measureInWindow:callback=>host.measureInWindow(callback),scrollTo:options=>scroll.scrollTo(options)}:null);},[viewport]), titleRef: useCallback((host: NativeHost | null) => {window.title = host?{node:host,viewport}:null;}, [window,viewport]), shown: () => controller?.present(window), owner: id};
}
