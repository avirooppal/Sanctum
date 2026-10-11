import {useEffect,useState} from 'react';
import {SanctumClient,type SessionPage} from './api';
import {Button,Dialog} from './ui/primitives';

export function HistoryPanel({api,current,busy,revision,onLoad,onDeleted}:{api:SanctumClient;current:string;busy:boolean;revision:number;onLoad:(id:string)=>void;onDeleted:(id:string)=>void}) {
 const [page,setPage]=useState<SessionPage>({data:[],has_more:false});
 const [query,setQuery]=useState('');const [search,setSearch]=useState('');
 const [pending,setPending]=useState(false);const [error,setError]=useState('');
 const [selected,setSelected]=useState<{id:string;title:string;operation:'rename'|'delete'}|null>(null);
 const [title,setTitle]=useState('');const [refresh,setRefresh]=useState(0);
 useEffect(()=>{const controller=new AbortController();setPending(true);setError('');
  api.sessions(search,0,controller.signal).then(setPage).catch(e=>{if(!controller.signal.aborted)setError(String(e));}).finally(()=>{if(!controller.signal.aborted)setPending(false);});
  return ()=>controller.abort();
 },[api,revision,search,refresh]);
 async function more(){setPending(true);setError('');try{const next=await api.sessions(search,page.data.length);setPage({data:[...page.data,...next.data],has_more:next.has_more});}catch(e){setError(String(e));}finally{setPending(false);}}
 async function mutate(){if(!selected||pending||busy)return;setPending(true);setError('');try{
  if(selected.operation==='rename')await api.renameSession(selected.id,title);
  else {await api.deleteSession(selected.id);onDeleted(selected.id);}
  setSelected(null);setRefresh(n=>n+1);
 }catch(e){setError(String(e));}finally{setPending(false);}}
 return <section aria-label="Conversation history">
  <form onSubmit={e=>{e.preventDefault();setSearch(query);setRefresh(n=>n+1);}}>
   <input aria-label="Search conversations" value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} className="w-full ui-surface border ui-border rounded p-2"/>
   <Button type="submit" variant="outline" disabled={pending||busy}>Search</Button>
  </form>
  <nav aria-label="Saved conversations">{page.data.map(session=><div key={session.id} className="my-2">
   <Button className="max-w-full break-all text-left" variant="outline" disabled={busy||pending} aria-current={current===session.id?'page':undefined} onClick={()=>onLoad(session.id)}>{session.title}</Button>
   <div><Button disabled={busy||pending} onClick={()=>{setTitle(session.title);setSelected({...session,operation:'rename'});}} aria-label={`Rename ${session.title}`}>Rename</Button>
   <Button disabled={busy||pending} onClick={()=>setSelected({...session,operation:'delete'})} aria-label={`Delete ${session.title}`}>Delete</Button></div>
  </div>)}</nav>
  {page.has_more&&<Button disabled={busy||pending} onClick={more}>Load more conversations</Button>}
  {!pending&&!page.data.length&&<p className="text-xs ui-text-secondary">No saved conversations found.</p>}
  {error&&<p role="alert">{error}</p>}
  <div onKeyDown={event=>{if(event.key==='Escape'||event.key==='Tab')event.stopPropagation();}}>
  <Dialog open={selected!==null} title={selected?.operation==='delete'?'Delete conversation':'Rename conversation'} onClose={()=>{if(!pending)setSelected(null);}}>
   {error&&<p role="alert">{error}</p>}
   {selected?.operation==='rename'?<form onSubmit={e=>{e.preventDefault();void mutate();}}><label>Conversation title<input value={title} maxLength={120} required onChange={e=>setTitle(e.target.value)}/></label><Button type="submit" disabled={pending||busy||!title.trim()}>Save title</Button></form>:<><p>Delete this conversation and its saved turns? This cannot be undone. This is not secure erasure of backups or database remnants.</p><Button disabled={pending||busy} onClick={mutate}>Confirm delete</Button></>}
  </Dialog>
  </div>
 </section>;
}
