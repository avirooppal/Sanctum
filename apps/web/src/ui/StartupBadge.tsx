import {useEffect,useState} from 'react';
import {observeHealth,type HealthObservation} from '../health-observation.js';
import {startupChecksPassed} from '../runtime-truth.js';
import {STRINGS} from './strings.js';

export function StartupBadge({health,receivedAt}:HealthObservation){
  const date=receivedAt===null?null:new Date(receivedAt);
  const iso=date&&!Number.isNaN(date.getTime())?date.toISOString():null;
  const passed=Boolean(iso)&&startupChecksPassed(health);const copy=STRINGS.startup;
  return <details className="startup-badge" data-startup-checks={passed?'passed':'unknown'}>
    <summary><span className="startup-state" role="status">{passed?copy.passed:copy.unknown}</span>
      {iso&&<span className="startup-time">{copy.read} <time dateTime={iso}>{date?.toLocaleTimeString()}</time></span>}
    </summary>
    <p>{iso?`${copy.read} ${iso}. `:copy.unavailable}{copy.scope}</p>
  </details>;
}

export function LockedStartupBadge(){
  const [observation,setObservation]=useState<HealthObservation>({health:null,receivedAt:null});
  useEffect(()=>{
    let active=true,inFlight=false;const controller=new AbortController();
    async function poll(){
      if(inFlight)return;inFlight=true;
      try{const next=await observeHealth(undefined,controller.signal);if(active)setObservation(next);}
      finally{inFlight=false;}
    }
    void poll();const timer=setInterval(()=>void poll(),8000);
    return ()=>{active=false;clearInterval(timer);controller.abort();};
  },[]);
  return <StartupBadge {...observation}/>;
}
