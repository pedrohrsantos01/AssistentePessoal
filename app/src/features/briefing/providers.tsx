import {Component,useEffect,useState,type ReactNode} from 'react';
import type {JourneyState} from '../journey/journey.ts';
import {Banner,Card,Type} from '../../ui/primitives.tsx';
import {pt} from '../../i18n/pt-BR.ts';
export type BriefingContext={state:JourneyState;create:()=>void;toggle:(id:string,done:boolean)=>void};
export type BriefingCardProvider={id:string;module:'habits'|'gamification';priority:(context:BriefingContext)=>number|null;
 load:(context:BriefingContext)=>Promise<BriefingContext>;render:(data:BriefingContext)=>ReactNode};
class CardBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};static getDerivedStateFromError() {return {failed:true};}
 render() {return this.state.failed?<Banner message={pt.genericError} error/>:this.props.children;}
}
function CardContent({provider,context}:{provider:BriefingCardProvider;context:BriefingContext}) {
 const [loaded,setLoaded]=useState<{state:JourneyState;data:BriefingContext}|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  let current=true;
  void provider.load(context).then(data=>{if(current) setLoaded({state:context.state,data});},()=>{if(current) setFailed(true);});
  return ()=>{current=false;};
 },[provider,context]);
 if(failed) return <Banner message={pt.genericError} error/>;
 if(loaded?.state!==context.state) return <Card><Type>{pt.loading}</Type></Card>;
 return provider.render(loaded.data);
}
export function BriefingCards({providers,context}:{providers:readonly BriefingCardProvider[];context:BriefingContext}) {
 const eligible=providers.map(provider=>({provider,priority:provider.priority(context)})).filter(item=>item.priority!==null).sort((a,b)=>b.priority!-a.priority!);
 return <>{eligible.map(({provider})=><CardBoundary key={provider.id+':'+context.state.key}><CardContent provider={provider} context={context}/></CardBoundary>)}</>;
}
