import {useEffect,useState} from 'react';
import {observeHealth,type HealthObservation} from '../health-observation.js';
import {startupChecksPassed} from '../runtime-truth.js';
import {STRINGS} from './strings.js';

export function StartupBadge({health,receivedAt}:HealthObservation){
  const date=receivedAt===null?null:new Date(receivedAt);
  const iso=date&&!Number.isNaN(date.getTime())?date.toISOString():null;
  const passed=Boolean(iso)&&startupChecksPassed(health);const copy=STRINGS.startup;
  return <details className="startup-badge" data-startup-checks={passed?'passed':'unknown'}>
    <summary><span aria-hidden="true" className="startup-indicator"/>
      <span className="startup-description"><span className="startup-state" role="status">{passed?copy.passed:copy.unknown}</span>
        <span className="startup-time">{iso?<>{copy.read} <time dateTime={iso}>{date?.toLocaleTimeString()}</time></>:copy.noRead}</span>
      </span>
      <svg className="startup-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5"/></svg>
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
    function visibilityChanged(){setObservation({health:null,receivedAt:null});if(!document.hidden)void poll();}
    void poll();const timer=setInterval(()=>{if(!document.hidden)void poll();},8000);
    document.addEventListener('visibilitychange',visibilityChanged);
    return ()=>{active=false;clearInterval(timer);controller.abort();document.removeEventListener('visibilitychange',visibilityChanged);};
  },[]);
  return <StartupBadge {...observation}/>;
}
