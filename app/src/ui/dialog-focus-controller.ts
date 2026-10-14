export type DialogControl<Host> = {key: string; owner: string | null; host: Host | null; enabled: boolean};
export type DialogWindow<Host> = {id: string; visible: boolean; shown: boolean; title: Host | null; opener: ControlKey | null};
type ControlKey = {key: string; owner: string | null};
export type DialogFocusDriver<Host> = {afterCommit: (work: () => void) => void; focus: (host: Host, eligible: () => boolean) => void};

/** UI lifecycle only: no account data, timers, actions or process-wide registry. */
export class DialogFocusController<Host> {
  live = true;
  private controls = new Map<string, DialogControl<Host>>();
  private windows: DialogWindow<Host>[] = [];
  private activated: ControlKey | null = null;
  private pending: ControlKey | null = null;
  constructor(private readonly driver: DialogFocusDriver<Host>) {}
  private address(target: ControlKey) {return JSON.stringify([target.owner, target.key]);}
  register(control: DialogControl<Host>) {
    const address = this.address(control);
    if (control.host !== null) this.controls.set(address, control);
    else if (this.controls.get(address) === control) this.controls.delete(address);
  }
  activate(control: DialogControl<Host>) {
    if (this.live && control.enabled) this.activated = {key: control.key, owner: control.owner};
  }
  begin(window: DialogWindow<Host>) {
    // A covered parent resumes with its original opener; its child owns the last activation.
    if (this.activated?.owner !== window.id) window.opener = this.activated;
    window.visible = true; window.shown = false;
    this.windows = this.windows.filter(item => item !== window);
    this.windows.push(window);
  }
  private foreground(owner: string | null) {
    const top = this.windows.filter(window => window.visible).at(-1);
    return owner === null ? !top : top?.id === owner && top.shown;
  }
  present(window: DialogWindow<Host>) {
    if (!this.live || !window.visible || window.shown) return;
    window.shown = true;
    if (this.pending?.owner === window.id && this.restore()) return;
    const host = window.title;
    if (host !== null) this.driver.focus(host, () => this.live && window.visible && window.title === host && this.foreground(window.id));
  }
  end(window: DialogWindow<Host>) {
    window.visible = false; window.shown = false;
    this.windows = this.windows.filter(item => item !== window);
    const target = window.opener;
    this.pending = target;
    this.driver.afterCommit(() => {
      if (this.pending !== target || window.visible) return;
      // Opening a child covers this window; do not restore the page underneath it.
      if (this.windows.some(child => child.visible && child.opener?.owner === window.id)) {this.pending = null; return;}
      this.restore();
    });
  }
  private restore() {
    const target = this.pending;
    if (!this.live || !target || !this.foreground(target.owner)) return false;
    this.pending = null;
    const control = this.controls.get(this.address(target)), host = control?.host;
    if (!control?.enabled || host === null || host === undefined) return false;
    this.driver.focus(host, () => this.live && this.controls.get(this.address(target)) === control && control.host === host && control.enabled && this.foreground(target.owner));
    return true;
  }
  invalidate() {this.live = false; this.pending = null;}
}
