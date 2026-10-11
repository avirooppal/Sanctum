import {useEffect,useId,useRef,type ButtonHTMLAttributes,type InputHTMLAttributes,type ReactNode} from 'react';

export function Button({type='button',className='',variant='primary',...props}:ButtonHTMLAttributes<HTMLButtonElement> & {variant?:'primary'|'quiet'|'outline'}) {
  return <button {...props} type={type} data-ui-button={variant} className={className}/>;
}

export function Input(props:InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} data-ui-input=""/>;
}

export function Card({title,children}:{title:string;children:ReactNode}) {
  return <section className="ui-card"><h2 className="ui-card-title text-display">{title}</h2>{children}</section>;
}

export function Dialog({open,title,onClose,children}:{open:boolean;title:string;onClose:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const heading=useId();
  useEffect(()=>{
    const node=dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
    return ()=>{if(node.open)node.close();};
  },[open]);
  return <dialog ref={dialog} className="ui-dialog" aria-labelledby={heading}
    onCancel={event=>{event.preventDefault();onClose();}}>
    <header className="ui-dialog-heading"><h2 id={heading}>{title}</h2>
      <Button variant="outline" aria-label={`Close ${title}`} onClick={onClose}>Close</Button>
    </header>{children}
  </dialog>;
}
