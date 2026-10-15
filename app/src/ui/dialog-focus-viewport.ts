type Measurable = {measureInWindow: (callback: (x:number,y:number,width:number,height:number)=>void)=>void};
type ScrollPort = Measurable & {scrollTo: (options:{y:number;animated:false})=>void};

/** Reveal the native destination before selecting it; a frame alone is never proof of visibility. */
export class DialogFocusViewport {
  private port: ScrollPort | null = null;
  private offset = 0;
  constructor(private readonly afterCommit:(work:()=>void)=>void) {}
  attach = (port:ScrollPort|null) => {this.port=port;this.offset=0;};
  scrolled = (offset:number) => {this.offset=offset;};
  reveal(host:Measurable,eligible:()=>boolean,select:()=>void) {
    const port=this.port;
    const live=()=>port!==null&&this.port===port&&eligible();
    const measure=(remaining:number)=>{
      if(!port||!live())return;
      port.measureInWindow((_x,top,_width,height)=>{
        if(!live()||height<=0)return;
        host.measureInWindow((_childX,childTop,childWidth,childHeight)=>{
          if(!live()||childWidth<=0||childHeight<=0)return;
          const bottom=childTop+Math.min(childHeight,height);
          const delta=childTop<top?childTop-top:bottom>top+height?bottom-top-height:0;
          if(delta===0){select();return;}
          if(remaining<=0)return;
          port.scrollTo({y:Math.max(0,this.offset+delta),animated:false});
          this.afterCommit(()=>measure(remaining-1));
        });
      });
    };
    measure(3);
  }
}
