import {createContext, useCallback, useContext, useLayoutEffect, useMemo, type ReactNode} from 'react';
import {AccessibilityInfo, Platform, type View} from 'react-native';
import {DialogFocusController, type DialogControl, type DialogFocusDriver, type DialogWindow} from './dialog-focus-controller.ts';

type Host = Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0];
const nativeDriver: DialogFocusDriver<Host> = {
  afterCommit: work => {requestAnimationFrame(work);},
  focus: (host, eligible) => {
    // Android's focus event reports input focus; hover enter selects the node for TalkBack.
    // Recheck the current identity after the asynchronous native layout acknowledgement.
    host.measure((_x, _y, width, height) => {
      if (width > 0 && height > 0 && eligible()) AccessibilityInfo.sendAccessibilityEvent(host, Platform.OS === 'android' ? 'viewHoverEnter' : 'focus');
    });
  },
};
const Scope = createContext<DialogFocusController<Host> | null>(null);
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
  const controller = useContext(Scope), owner = useContext(DialogOwner);
  const control = useMemo<DialogControl<Host>>(() => ({key: key ?? '', owner, host: null, enabled}), [key, owner, controller]);
  useLayoutEffect(() => {control.enabled = enabled; return () => {control.enabled = false;};}, [control, enabled]);
  const ref = useCallback((host: View | null) => {control.host = host; if (key) controller?.register(control);}, [controller, control, key]);
  return {ref: key ? ref : null, activate: () => {if (key) controller?.activate(control);}};
}
export function useDialogWindow(id: string, visible: boolean) {
  const controller = useContext(Scope);
  const window = useMemo<DialogWindow<Host>>(() => ({id, visible: false, shown: false, title: null, opener: null}), [id, controller]);
  useLayoutEffect(() => {
    if (!visible) return;
    controller?.begin(window);
    return () => controller?.end(window);
  }, [controller, window, visible]);
  return {titleRef: useCallback((host: Host | null) => {window.title = host;}, [window]), shown: () => controller?.present(window), owner: id};
}
