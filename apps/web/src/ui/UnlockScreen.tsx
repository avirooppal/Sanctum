import {useEffect,useId,useRef,type ReactNode} from 'react';
import {Button} from './primitives.js';
import {STRINGS} from './strings.js';

export interface UnlockProps {
  value:string;busy:boolean;error:string;
  onChange:(value:string)=>void;onUnlock:()=>void;onReview:()=>void;
  wizard?:ReactNode;onBack?:()=>void;
}

export function UnlockScreen({value,busy,error,onChange,onUnlock,onReview,wizard,onBack}:UnlockProps){
  const id=useId();const copy=STRINGS.unlock;
  const card=useRef<HTMLElement>(null);const previous=useRef(!!wizard);
  useEffect(()=>{if(previous.current!==!!wizard)card.current?.querySelector<HTMLElement>('input,button')?.focus();previous.current=!!wizard;},[!!wizard]);
  return <main className="unlock-page">
    <section ref={card} className={`unlock-card${wizard?' unlock-review':''}`} aria-label={wizard?copy.review:copy.region}>
      <div className="unlock-brand"><svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" fill="none">
        <path d="M16 3 29 16 16 29 3 16Z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M16 10 22 16 16 22 10 16Z" fill="currentColor"/>
      </svg><span>{STRINGS.app.name}</span></div>
      {wizard?<>{wizard}<Button variant="quiet" className="unlock-back" onClick={onBack}>{copy.back}</Button></>:<>
        <header className="unlock-heading"><h1>{copy.title}</h1><p>{copy.subtitle}</p></header>
        <form onSubmit={event=>{event.preventDefault();if(value.trim()&&!busy)onUnlock();}} aria-busy={busy}>
          <label htmlFor={id}>{copy.keyLabel}</label>
          <input id={id} aria-label="Local access key" aria-describedby={`${id}-hint`} type="password"
            autoComplete="off" spellCheck={false} required disabled={busy} value={value}
            onChange={event=>onChange(event.target.value)} placeholder={copy.placeholder}/>
          <p id={`${id}-hint`} className="unlock-hint">{copy.memory}</p>
          {error&&<p role="alert" className="unlock-error">{error}</p>}
          <Button type="submit" disabled={busy||!value.trim()} className="unlock-submit">{busy?copy.busy:copy.submit}</Button>
        </form>
        <details className="unlock-help"><summary>{copy.helpTitle}</summary><p>{copy.helpBody}</p><p>{copy.helpSafety}</p></details>
        <footer className="unlock-footer"><span>{copy.firstTime}</span><Button variant="quiet" onClick={onReview}>{copy.review}</Button></footer>
      </>}
    </section>
    <p className="unlock-footnote">{copy.scope}</p>
  </main>;
}
