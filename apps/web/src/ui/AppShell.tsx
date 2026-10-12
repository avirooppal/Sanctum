import {useEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {Button} from './primitives.js';

const MOBILE_QUERY='(max-width:639.98px)';

export function AppShell({
  sidebar,
  header,
  rightRail,
  children,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  rightRail?: ReactNode;
  children: ReactNode;
}) {
  const [mobile,setMobile]=useState(()=>typeof matchMedia === 'function' && matchMedia(MOBILE_QUERY).matches);
  const [open,setOpen]=useState(false);
  const opener=useRef<HTMLButtonElement>(null);
  const navigation=useRef<HTMLElement>(null);
  const returnFocus=useRef(false);
  useEffect(()=>{
    const query=matchMedia(MOBILE_QUERY);
    const changed=()=>{setMobile(query.matches);if(!query.matches)setOpen(false);};
    query.addEventListener('change',changed);
    return ()=>query.removeEventListener('change',changed);
  },[]);
  useEffect(()=>{
    if(mobile && open){
      returnFocus.current=true;
      navigation.current?.querySelector<HTMLButtonElement>('[data-navigation-close]')?.focus();
    }else if(returnFocus.current){
      returnFocus.current=false;
      if(mobile)opener.current?.focus();
    }
  },[mobile,open]);
  function navigationKeys(event:KeyboardEvent<HTMLElement>){
    if(!mobile || !open)return;
    if(event.key === 'Escape'){event.preventDefault();setOpen(false);return;}
    if(event.key !== 'Tab')return;
    const targets=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')]
      .filter(node=>node.getClientRects().length>0);
    const first=targets[0],last=targets.at(-1);
    if(event.shiftKey && document.activeElement === first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement === last){event.preventDefault();first?.focus();}
  }
  return <div className="app-shell" data-navigation-open={open}>
    {mobile && open && <button type="button" className="app-navigation-backdrop" aria-label="Dismiss navigation" tabIndex={-1} onClick={()=>setOpen(false)}/>}
    <aside id="sanctum-navigation" className="app-sidebar ui-sidebar ui-text-primary" ref={navigation}
      data-open={open} inert={mobile && !open} role={mobile && open ? 'dialog' : undefined}
      aria-modal={mobile && open ? true : undefined} aria-label="Navigation" onKeyDown={navigationKeys}>
      <Button className="app-navigation-close" variant="outline" aria-label="Close navigation"
        data-navigation-close="" onClick={()=>setOpen(false)}>Close</Button>
      {sidebar}
    </aside>
    <main className="app-main" inert={mobile && open}>
      <header className="app-header ui-border">
        <button ref={opener} type="button" className="app-navigation-opener" aria-label="Open navigation"
          aria-expanded={open} aria-controls="sanctum-navigation" onClick={()=>setOpen(true)}>☰</button>
        {header}
      </header>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="app-body flex-1">{children}</div>
        {rightRail}
      </div>
    </main>
  </div>;
}
