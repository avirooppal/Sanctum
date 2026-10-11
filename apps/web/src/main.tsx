import React, {useState, useEffect, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {SpeechPanel} from './SpeechPanel';
import {MeetingPanel} from './MeetingPanel';

import {SanctumClient, type Message} from './api';
import {ChatRun} from './chat-run';
import {KnowledgePanel} from './KnowledgePanel';
import {HistoryPanel} from './HistoryPanel';
import './ui/knowledge.css';
import {Button,Dialog} from './ui/primitives';
import './ui/primitives.css';
import thirdPartyNotices from '../../../THIRD_PARTY_NOTICES.md?raw';
import {ThemeControls} from './ui/ThemeControls';
import './ui/themes.css';
import './ui/fonts.css';
import {AppShell} from './ui/AppShell';
import './ui/shell.css';
function App(){
 const [token,setToken]=useState('');
 const [keyInput,setKeyInput]=useState('');
 const [model,setModel]=useState('');
 const [models,setModels]=useState<string[]>([]);
 const [messages,setMessages]=useState<Message[]>([]);
 const [prompt,setPrompt]=useState('');
 const [busy,setBusy]=useState(false);
 const [chatStatus,setChatStatus]=useState('');
 const chatRun=useMemo(()=>new ChatRun(),[]);
 useEffect(()=>()=>chatRun.stop(),[chatRun]);
 const [error,setError]=useState('');
 const [conversation,setConversation]=useState<string>(crypto.randomUUID());
 const [historyRevision,setHistoryRevision]=useState(0);
 const [licensesOpen,setLicensesOpen]=useState(false);
 const [knowledgeOpen,setKnowledgeOpen]=useState(false);
 const api=useMemo(()=>new SanctumClient(token),[token]);
 async function refresh(){setHistoryRevision(n=>n+1);}
 useEffect(()=>{if(!token)return;api.models().then(async data=>{const textModels=data.filter(m=>m.capabilities.includes('text')).map(m=>m.id);setModels(textModels);setModel(textModels[0]||'');await refresh();}).catch(e=>{setError(e.message);setToken('');});},[token]);
 async function send(e:React.FormEvent){e.preventDefault();if(!prompt.trim()||busy||chatRun.active)return;setError('');setChatStatus('');setBusy(true);const next:Message[]=[...messages,{role:'user',content:prompt}];setMessages([...next,{role:'assistant',content:''}]);setPrompt('');let answer='';
  try {const result=await chatRun.start(signal=>api.chat(model,next,conversation,signal),delta=>{answer+=delta;setMessages([...next,{role:'assistant',content:answer}]);});if(result==='stopped')setChatStatus('Generation stopped. Partial text is not guaranteed to be saved.');await refresh();}
  catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}}
 async function load(id:string){if(busy)return;setBusy(true);setError('');try{const turns=await api.turns(id);const all:Message[]=[];for(const turn of turns){const request=JSON.parse(turn.request);const last=request.messages.filter((m:Message)=>m.role==='user').at(-1);if(last)all.push(last);let answer='';if(turn.streaming){for(const line of turn.response.split('\n')){if(line.startsWith('data: ')&&line.trim()!=='data: [DONE]'){const event=JSON.parse(line.slice(6));answer+=event.choices?.[0]?.delta?.content||'';}}}else answer=JSON.parse(turn.response).choices?.[0]?.message?.content||'';all.push({role:'assistant',content:answer});}setConversation(id);setMessages(all);}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <><AppShell sidebar={<>
  <div className="text-2xl tracking-tight font-semibold ui-wordmark">◈ Sanctum</div><p className="text-xs ui-text-secondary mt-2 text-display tracking-[.18em]">A private place to think</p><button disabled={busy} className="mt-10 border ui-border rounded-lg px-4 py-3 text-left ui-hover" onClick={()=>{setConversation(crypto.randomUUID());setMessages([]);setError('');}}>＋ New conversation</button><p className="mt-9 mb-3 text-xs text-display tracking-wider ui-text-secondary">Your conversations</p>{token&&<HistoryPanel api={api} current={conversation} busy={busy} revision={historyRevision} onLoad={load} onDeleted={id=>{if(id===conversation){setConversation(crypto.randomUUID());setMessages([]);}}}/>}<div className="mt-auto pt-10 text-xs ui-text-secondary leading-6">● Local models only<br/>Cloud connections disabled<br/>{token&&<Button variant="outline" onClick={()=>setKnowledgeOpen(true)}>Knowledge</Button>}<Button variant="outline" onClick={()=>setLicensesOpen(true)}>Licenses</Button><ThemeControls/></div></>} header={<>
  <span className="text-sm ui-text-secondary">Your workspace / Chat</span>{model&&<select aria-label="Model" className="ui-surface rounded-lg border ui-border p-2 text-sm" value={model} disabled={busy} onChange={e=>setModel(e.target.value)}>{models.map(id=><option key={id}>{id}</option>)}</select>}</>}>
  {token&&<MeetingPanel token={token}/>}
  {!token?<section className="m-auto w-full max-w-md"><div className="text-5xl ui-text-accent mb-6">◈</div><h1 className="text-3xl font-semibold mb-4">Welcome to your Sanctum.</h1><p className="ui-text-secondary mb-7 leading-relaxed">Use your local access key to open your workspace. Your conversations stay on this machine.</p><form onSubmit={e=>{e.preventDefault();setToken(keyInput.trim());setKeyInput('');}}><label className="block text-sm mb-2" htmlFor="key">Local access key</label><input id="key" type="password" autoComplete="off" required value={keyInput} onChange={e=>setKeyInput(e.target.value)} className="w-full ui-surface p-3 rounded-lg border ui-border"/><button className="mt-4 ui-primary text-white rounded-lg py-3 px-5 w-full">Open workspace</button></form></section>:<><section className="app-transcript py-6 space-y-7" aria-live="polite">{!messages.length&&<div className="pt-12"><p className="text-sm ui-text-secondary mb-4">YOUR IDEAS, YOUR MACHINE.</p><h1 className="text-4xl font-semibold tracking-tight">What’s on your mind?</h1><p className="mt-5 ui-text-secondary max-w-lg leading-7">Write, explore, or work through a question with your local model.</p></div>}{messages.map((m,i)=><article key={i} className={m.role==='user'?'ui-user-bubble rounded-2xl p-5 ml-8':'p-4'}><div className="text-xs text-display ui-text-secondary tracking-wider mb-2">{m.role==='user'?'You':'Sanctum'}</div><div className="whitespace-pre-wrap leading-7">{m.content||'Thinking locally…'}</div></article>)}</section><form onSubmit={send} className="app-composer ui-background pt-3 pb-3"><div className="ui-surface border ui-border rounded-2xl p-4 shadow-sm"><textarea aria-label="Message" placeholder="Ask anything…" value={prompt} onChange={e=>setPrompt(e.target.value)} rows={3} className="resize-none w-full bg-transparent"/><div className="flex justify-between items-center"><span className="text-xs ui-text-secondary">Private by default</span><button disabled={busy||!prompt.trim()} className="ui-primary text-white py-2 px-5 rounded-lg">{busy?'Generating…':'Send ↑'}</button>{busy&&<Button variant="outline" onClick={()=>chatRun.stop()}>Stop generation</Button>}</div></div>{chatStatus&&<p className="text-xs ui-text-secondary" aria-live="polite">{chatStatus}</p>}<SpeechPanel token={token} conversation={conversation} answer={messages.filter(m=>m.role==='assistant').at(-1)?.content||''} onTranscript={setPrompt}/><p className="text-xs text-center mt-3 ui-text-secondary">Local models can make mistakes. Check important details.</p></form></>}{error&&<p role="alert" className="rounded-lg bg-red-50 text-red-800 p-4 my-3">{error}</p>}</AppShell><Dialog open={knowledgeOpen} title="Knowledge" onClose={()=>setKnowledgeOpen(false)}>{knowledgeOpen&&<KnowledgePanel api={api}/>}</Dialog><Dialog open={licensesOpen} title="Licenses" onClose={()=>setLicensesOpen(false)}><pre className="ui-licenses">{thirdPartyNotices}</pre></Dialog></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
