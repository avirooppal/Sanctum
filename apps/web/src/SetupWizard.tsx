import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Button} from './ui/primitives.js';
import {SanctumClient,type Model} from './api.js';
import {loadWorkspace} from './workspace-bootstrap.js';
import {GatewayError,MESSAGES,privacyMessage,startupChecksPassed,userError} from './runtime-truth.js';

export interface SetupWizardProps {
  onComplete:(token:string,initialPrompt?:string)=>void;
  defaultToken?:string;
  onSelectPrompt?:(prompt:string)=>void;
}
type Review={model:Model;profile:string;health:unknown;threads?:number;context?:number};

export function SetupWizard({onComplete,defaultToken=''}:SetupWizardProps) {
  const [key,setKey]=useState(defaultToken);
  const [busy,setBusy]=useState(false);
  const [review,setReview]=useState<Review|null>(null);
  const [error,setError]=useState('');
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>active.current?.abort(),[]);
  async function check(event:FormEvent) {
    event.preventDefault();if(busy||!key.trim())return;
    const controller=new AbortController();active.current=controller;
    setBusy(true);setReview(null);setError('');
    try {
      const loaded=await loadWorkspace(new SanctumClient(key.trim()),controller.signal);
      const response=await fetch('/healthz',{signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error'});
      if(!response.ok)throw new GatewayError(response.status,response.headers.get('Retry-After'));
      const health:unknown=await response.json();controller.signal.throwIfAborted();
      const model=loaded.models.find(item=>item.capabilities.includes('text'));
      if(!model){setError(MESSAGES.unsupported);return;}
      if(!startupChecksPassed(health)){setError(MESSAGES.unknown);return;}
      setReview({model,profile:loaded.capabilities.profile,health,
        threads:loaded.capabilities.hardware?.threads,context:loaded.capabilities.hardware?.context});
    } catch(failure) {
      if(!controller.signal.aborted)setError(userError(failure));
    } finally {if(active.current===controller)setBusy(false);}
  }
  function cancel(){active.current?.abort();setBusy(false);setReview(null);setError(MESSAGES.cancelled);}
  return <section aria-label="First-run setup" className="setup-wizard-container max-w-xl mx-auto p-8 ui-surface rounded-2xl border ui-border">
    <h1 className="text-xl font-semibold">Welcome to Sanctum</h1>
    <p>Connect to your configured local runtime. The access key stays in memory.</p>
    <p>Hardware tier: <strong>Unknown</strong>. This runtime does not expose a detected-tier report. Run <code>sanctum doctor</code> locally for the hardware recommendation.</p>
    {!review?<form onSubmit={check} className="space-y-4">
      <label>Local access key<input aria-label="Local access key" type="password" required autoComplete="off"
        disabled={busy} value={key} onChange={event=>setKey(event.target.value)} className="w-full ui-surface border ui-border p-3 rounded-lg"/></label>
      <p>Use the token file printed by the runtime. There is no key bypass or automatic login.</p>
      <Button type="submit" disabled={busy||!key.trim()}>{busy?'Checking local runtime…':'Check local runtime'}</Button>
      {busy&&<Button variant="outline" type="button" onClick={cancel}>Cancel setup check</Button>}
      <p>Model import/download and folder watching are not available in setup yet. Use the documented offline provisioning tools;add supported files from Knowledge after signing in.</p>
    </form>:<div className="space-y-4">
      <h2 className="text-lg">Review local configuration</h2>
      <dl><dt>Configured profile</dt><dd>{review.profile}</dd><dt>Local chat model</dt><dd>{review.model.id}</dd>
        <dt>Model license</dt><dd>{review.model.license??'Unknown'}</dd>
        <dt>Model fit / speed estimate</dt><dd>Unknown</dd>
        <dt>Configured threads / context</dt><dd>{review.threads??'Unknown'} / {review.context??'Unknown'}</dd></dl>
      <p role="status">{privacyMessage(review.health)}</p>
      <Button onClick={()=>{const token=key.trim();setKey('');onComplete(token);}}>Open workspace</Button>
      <Button variant="outline" onClick={()=>{setReview(null);setError('');}}>Change access key</Button>
    </div>}
    {!review&&<p role="status">{privacyMessage(null)}</p>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
