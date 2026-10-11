import {useEffect,useRef,useState} from 'react';
import {SanctumClient,type Workspace,type KnowledgeAnswer} from './api';
import {Button,Input,Card} from './ui/primitives';

export function KnowledgePanel({api}:{api:SanctumClient}) {
  const [workspaces,setWorkspaces]=useState<Workspace[]>([]);
  const [workspace,setWorkspace]=useState('');
  const [name,setName]=useState('');
  const [query,setQuery]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [answer,setAnswer]=useState<KnowledgeAnswer|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const active=useRef<AbortController|null>(null);
  useEffect(()=>{
    const controller=new AbortController();active.current=controller;
    api.workspaces(controller.signal).then(data=>{if(!controller.signal.aborted){setWorkspaces(data);setWorkspace(data[0]?.id??'');}})
      .catch(e=>{if(!controller.signal.aborted)setError(String(e.message));});
    return ()=>{controller.abort();active.current?.abort();};
  },[api]);
  async function run(operation:(signal:AbortSignal)=>Promise<void>) {
    if(busy)return;
    active.current?.abort();const controller=new AbortController();active.current=controller;
    setBusy(true);setError('');setNotice('');setAnswer(null);
    try {await operation(controller.signal);}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Knowledge request failed');}
    finally {if(!controller.signal.aborted)setBusy(false);}
  }
  return <div className="knowledge-panel">
    <p>Your documents stay local. Citations and retrieved text are untrusted source material.</p>
    <Card title="Workspace"><form onSubmit={e=>{e.preventDefault();void run(async signal=>{
      const id=await api.createWorkspace(name.trim(),signal);setWorkspaces(previous=>[...previous,{id,name:name.trim()}]);setWorkspace(id);setName('');
    });}}><label>New Knowledge workspace<Input required maxLength={120} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
      <Button type="submit" disabled={busy||!name.trim()}>Create Knowledge workspace</Button></form>
      <label>Knowledge workspace<select value={workspace} disabled={busy} onChange={e=>{setWorkspace(e.target.value);setAnswer(null);setNotice('');}}>
        <option value="">Choose workspace</option>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label></Card>
    <Card title="Add document"><p>Markdown or text-based PDF, at most 10 MiB. Owner-only, restricted classification.</p>
      <label>Knowledge document<Input type="file" accept=".md,.pdf" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
      <Button disabled={busy||!workspace||!file} onClick={()=>void run(async signal=>{
        if(!file)return;if(file.size>10*1024*1024)throw Error('Document exceeds 10 MiB.');
        const bytes=new Uint8Array(await file.arrayBuffer());signal.throwIfAborted();
        const id=await api.uploadDocument(workspace,file.name,bytes,signal);setNotice(`Document indexed: ${file.name} (${id})`);
      })}>Upload document</Button></Card>
    <Card title="Ask your documents"><form onSubmit={e=>{e.preventDefault();void run(async signal=>{setAnswer(await api.askKnowledge(workspace,query.trim(),signal));});}}>
      <label>Knowledge question<textarea required maxLength={4000} value={query} disabled={busy} onChange={e=>setQuery(e.target.value)}/></label>
      <Button type="submit" disabled={busy||!workspace||!query.trim()}>Ask Knowledge</Button></form></Card>
    {busy&&<p aria-live="polite">Working locally…</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
    {answer&&<section aria-label="Knowledge answer"><h3>{answer.abstained?'No supported answer found':'Answer with sources'}</h3>
      <p className="whitespace-pre-wrap">{answer.answer}</p><ol>{answer.citations.map((c,i)=><li key={`${c.chunk_id}-${i}`}>
        <p>{c.source}{c.page!==null?` · Page ${c.page}`:''}</p><blockquote className="whitespace-pre-wrap">{c.quote}</blockquote>
      </li>)}</ol></section>}
  </div>;
}
