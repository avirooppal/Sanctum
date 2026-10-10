import React, {useEffect, useState} from 'react';
import {saveMeeting, type MeetingResult} from './meeting';

export function MeetingPanel({token}: {token: string}) {
  const [workspaces, setWorkspaces] = useState<{id:string;name:string}[]>([]);
  const [workspace, setWorkspace] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<MeetingResult|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
  useEffect(() => {
    const controller = new AbortController();
    fetch('/v1/workspaces', {headers, signal: controller.signal}).then(async response => {
      if (!response.ok) throw Error('Knowledge workspaces are unavailable.');
      const data = await response.json();
      setWorkspaces(data.data); setWorkspace(data.data[0]?.id || '');
    }).catch(error => {if (!controller.signal.aborted) setError(String(error.message));});
    return () => controller.abort();
  }, [token]);
  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/v1/workspaces', {method:'POST', headers, body:JSON.stringify({name:name.trim()})});
      if (!response.ok) throw Error('Could not create workspace.');
      const data = await response.json();
      setWorkspaces(previous => [...previous, {id:data.id, name:name.trim()}]);
      setWorkspace(data.id); setName(''); setResult(null);
    } catch (error) {setError(error instanceof Error ? error.message : 'Workspace creation failed.');}
    finally {setBusy(false);}
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setResult(null);
    try {setResult(await saveMeeting(token, workspace, title, transcript));}
    catch (error) {setError(error instanceof Error ? error.message : 'Save failed.');}
    finally {setBusy(false);}
  }
  const input = 'block w-full rounded-lg border border-[#c9d4ca] bg-white p-3 mt-2';
  return <details className="border border-[#c9d4ca] rounded-xl p-4 my-4">
    <summary className="cursor-pointer font-semibold">Meeting notes</summary>
    <p className="text-sm my-3">Review a transcript, then save locally into Knowledge. Notes are restricted to you by default. Review generated summaries and action items before acting.</p>
    <div className="flex gap-2 items-end mb-4"><label className="flex-1">New workspace<input className={input} aria-label="New workspace name" value={name} maxLength={120} disabled={busy} onChange={event=>setName(event.target.value)}/></label><button type="button" className="border rounded-lg p-3" disabled={busy||!name.trim()} onClick={create}>Create workspace</button></div>
    <form onSubmit={save} className="space-y-3">
      <label className="block">Save in workspace<select className={input} aria-label="Meeting workspace" value={workspace} disabled={busy} onChange={event=>{setWorkspace(event.target.value);setResult(null);}}><option value="">Choose workspace</option>{workspaces.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="block" htmlFor="meeting-title">Meeting title</label><input id="meeting-title" className={input} value={title} disabled={busy} onChange={event=>setTitle(event.target.value)} required/>
      <label className="block" htmlFor="meeting-transcript">Reviewed transcript</label><textarea id="meeting-transcript" className={input} value={transcript} disabled={busy} rows={5} onChange={event=>setTranscript(event.target.value)} required/>
      <p className="text-xs">{[...transcript].length} / 6000 characters. No diarization is applied.</p>
      <button className="bg-[#23583f] text-white rounded-lg px-4 py-2" disabled={busy||!workspace||!title.trim()||!transcript.trim()}>{busy?'Working locally…':'Save meeting'}</button>
    </form>
    {error&&<p role="alert" className="text-red-800 my-3">{error}</p>}
    {result&&<section aria-label="Saved meeting" className="mt-4 space-y-3 break-words"><h2 className="font-semibold">Saved to Knowledge — review these notes</h2><p className="whitespace-pre-wrap">{result.notes.summary}</p>{result.notes.action_items.length===0?<p>No action items identified.</p>:<ul>{result.notes.action_items.map((item,index)=><li key={index} className="my-3"><p>{item.description}</p><p>Owner: {item.owner||'Unassigned'} · Due: {item.due_date||'Not stated'}</p><blockquote className="border-l-2 pl-3 whitespace-pre-wrap">{item.evidence_quote}</blockquote></li>)}</ul>}<p className="text-xs">Document: {result.document.id}</p></section>}
  </details>;
}
