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
import {SafeMarkdown} from './ui/SafeMarkdown';
import {DashboardPanel} from './DashboardPanel';
import {SetupWizard} from './SetupWizard';

const PROMPT_SUGGESTIONS = [
  { title: 'Explain a technical concept', prompt: 'Explain how local on-device LLMs run without cloud dependencies.' },
  { title: 'Analyze code & find bugs', prompt: 'Review this code for edge cases and security vulnerabilities:\n\n```python\ndef handler(req):\n    pass\n```' },
  { title: 'Summarize notes & documents', prompt: 'Summarize the core takeaways from my notes in bullet points.' },
  { title: 'Draft an architectural proposal', prompt: 'Draft a concise architecture decision record for local-first storage.' },
];

function App(){
 const [token,setToken]=useState('');
 const [keyInput,setKeyInput]=useState('');
 const [model,setModel]=useState('');
 const [models,setModels]=useState<string[]>([]);
 const [messages,setMessages]=useState<Message[]>([]);
 const [prompt,setPrompt]=useState('');
 const [busy,setBusy]=useState(false);
 const [chatStatus,setChatStatus]=useState('');
 const [showWizard,setShowWizard]=useState(false);
 const [copiedIndex,setCopiedIndex]=useState<number | null>(null);
 const chatRun=useMemo(()=>new ChatRun(),[]);
 useEffect(()=>()=>chatRun.stop(),[chatRun]);
 const [error,setError]=useState('');
 const [conversation,setConversation]=useState<string>(crypto.randomUUID());
 const [historyRevision,setHistoryRevision]=useState(0);
 const [licensesOpen,setLicensesOpen]=useState(false);
 const [knowledgeOpen,setKnowledgeOpen]=useState(false);
 const [dashboardOpen,setDashboardOpen]=useState(false);
 const api=useMemo(()=>new SanctumClient(token),[token]);
 async function refresh(){setHistoryRevision(n=>n+1);}
 useEffect(()=>{
  if(!token)return;
  api.models().then(async data=>{
   const textModels=data.filter(m=>m.capabilities.includes('text')).map(m=>m.id);
   setModels(textModels);
   setModel(textModels[0]||'');
   await refresh();
  }).catch(e=>{
   setError(e.message);
   setToken('');
  });
 },[token]);

 async function handleSlashCommand(input:string):Promise<boolean>{
  const trimmed=input.trim();
  if(trimmed==='/help'){
   setMessages(prev=>[...prev,{role:'user',content:'/help'},{role:'assistant',content:'**Available Slash Commands:**\n- `/help` - Show available local commands\n- `/clear` - Clear messages in current session\n- `/stop` - Stop current generation\n- `/info` - Show active model and privacy invariants'}]);
   setPrompt('');
   return true;
  }
  if(trimmed==='/clear'){
   setMessages([]);
   setPrompt('');
   setChatStatus('Conversation cleared.');
   return true;
  }
  if(trimmed==='/stop'){
   if(busy||chatRun.active){chatRun.stop();setChatStatus('Generation stopped.');}
   setPrompt('');
   return true;
  }
  if(trimmed==='/info'){
   setMessages(prev=>[...prev,{role:'user',content:'/info'},{role:'assistant',content:`**Sanctum Active Runtime Info**\n- **Model**: \`${model||'none'}\` (Local on-device inference)\n- **Privacy**: Zero external network egress, authenticated localhost socket\n- **Storage**: Local session turns, zero telemetry`}]);
   setPrompt('');
   return true;
  }
  return false;
 }

 async function send(e:React.FormEvent){
  e.preventDefault();
  const input=prompt.trim();
  if(!input||busy||chatRun.active)return;
  setError('');setChatStatus('');
  if(input.startsWith('/')){
   const handled=await handleSlashCommand(input);
   if(handled)return;
  }
  setBusy(true);
  const next:Message[]=[...messages,{role:'user',content:prompt}];
  setMessages([...next,{role:'assistant',content:''}]);
  setPrompt('');
  let answer='';
  try {
   const result=await chatRun.start(signal=>api.chat(model,next,conversation,signal),delta=>{answer+=delta;setMessages([...next,{role:'assistant',content:answer}]);});
   if(result==='stopped')setChatStatus('Generation stopped. Partial text is not guaranteed to be saved.');
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}
 }

 async function copyText(text:string,index:number){
  try {
   await navigator.clipboard.writeText(text);
   setCopiedIndex(index);
   setTimeout(()=>setCopiedIndex(null),2000);
  } catch {
   // Fallback if clipboard API is restricted
  }
 }

 async function load(id:string){if(busy)return;setBusy(true);setError('');try{const turns=await api.turns(id);const all:Message[]=[];for(const turn of turns){const request=JSON.parse(turn.request);const last=request.messages.filter((m:Message)=>m.role==='user').at(-1);if(last)all.push(last);let answer='';if(turn.streaming){for(const line of turn.response.split('\n')){if(line.startsWith('data: ')&&line.trim()!=='data: [DONE]'){const event=JSON.parse(line.slice(6));answer+=event.choices?.[0]?.delta?.content||'';}}}else answer=JSON.parse(turn.response).choices?.[0]?.message?.content||'';all.push({role:'assistant',content:answer});}setConversation(id);setMessages(all);}catch(e){setError(String(e));}finally{setBusy(false);}}

 return <><AppShell sidebar={<>
  <div className="text-2xl tracking-tight font-semibold ui-wordmark">◈ Sanctum</div><p className="text-xs ui-text-secondary mt-2 text-display tracking-[.18em]">A private place to think</p><button disabled={busy} className="mt-10 border ui-border rounded-lg px-4 py-3 text-left ui-hover" onClick={()=>{setConversation(crypto.randomUUID());setMessages([]);setError('');}}>＋ New conversation</button><p className="mt-9 mb-3 text-xs text-display tracking-wider ui-text-secondary">Your conversations</p>{token&&<HistoryPanel api={api} current={conversation} busy={busy} revision={historyRevision} onLoad={load} onDeleted={id=>{if(id===conversation){setConversation(crypto.randomUUID());setMessages([]);}}}/>}<div className="mt-auto pt-10 text-xs ui-text-secondary leading-6">● Local models only<br/>Cloud connections disabled<br/><div className="flex flex-wrap gap-2 my-2">{token&&<Button variant="outline" onClick={()=>setDashboardOpen(true)}>Dashboard</Button>}{token&&<Button variant="outline" onClick={()=>setKnowledgeOpen(true)}>Knowledge</Button>}<Button variant="outline" onClick={()=>setLicensesOpen(true)}>Licenses</Button></div><ThemeControls/></div></>} header={<>
  <div className="flex items-center gap-3">
   <span className="text-sm ui-text-secondary">Your workspace / Chat</span>
   {token && <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>live</span>}
  </div>
  {model&&<div className="flex items-center gap-2"><select aria-label="Model" className="ui-surface rounded-lg border ui-border p-2 text-sm" value={model} disabled={busy} onChange={e=>setModel(e.target.value)}>{models.map(id=><option key={id}>{id}</option>)}</select><span className="text-[11px] px-2 py-0.5 rounded border ui-border text-display ui-text-secondary" title="Runs on device with verified open license">On-Device · Local</span></div>}</>}>
  {token&&<MeetingPanel token={token}/>}
  {!token?(
   showWizard?(
    <div className="m-auto w-full max-w-2xl py-6">
     <SetupWizard onComplete={t=>{setToken(t);setShowWizard(false);}} defaultToken={keyInput}/>
     <div className="text-center mt-4">
      <button className="text-xs ui-text-secondary underline hover:opacity-80" onClick={()=>setShowWizard(false)}>
       Or enter existing access key directly
      </button>
     </div>
    </div>
   ):(
    <section className="m-auto w-full max-w-md">
     <div className="text-5xl ui-text-accent mb-6">◈</div>
     <h1 className="text-3xl font-semibold mb-3">Welcome to your Sanctum.</h1>
     <p className="ui-text-secondary mb-6 leading-relaxed">
      Local AI that runs 100% on your device with zero cloud telemetry.
     </p>
     <div className="mb-6 p-4 rounded-xl border ui-border bg-neutral-500/5">
      <div className="flex items-center justify-between mb-2">
       <span className="text-xs font-semibold text-display ui-text-secondary">First-Time Setup</span>
       <span className="text-[10px] px-1.5 py-0.5 rounded border ui-border text-display">Hermes Style</span>
      </div>
      <p className="text-xs ui-text-secondary mb-3">
       New here? Follow the interactive setup walkthrough to check local compute, configure models, and launch.
      </p>
      <Button className="w-full" onClick={()=>setShowWizard(true)}>
       Start Setup Walkthrough →
      </Button>
     </div>
     <div className="relative my-6 text-center">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t ui-border"></div></div>
      <span className="relative ui-surface px-2 text-xs ui-text-secondary text-display">Or Existing Key</span>
     </div>
     <form onSubmit={e=>{e.preventDefault();setToken(keyInput.trim());setKeyInput('');}}>
      <label className="block text-sm mb-2" htmlFor="key">Local access key</label>
      <input id="key" type="password" autoComplete="off" required value={keyInput} onChange={e=>setKeyInput(e.target.value)} className="w-full ui-surface p-3 rounded-lg border ui-border" placeholder="Paste local.token"/>
      <button className="mt-4 ui-primary text-white rounded-lg py-3 px-5 w-full">Open workspace</button>
     </form>
    </section>
   )
  ):(<><section className="app-transcript py-6 space-y-7" aria-live="polite">
   {!messages.length&&(
    <div className="pt-8 pb-4">
     <div className="text-xs text-display ui-text-secondary tracking-widest mb-3">HERMES-GRADE LOCAL AI · PRIVACY FIRST</div>
     <h1 className="text-4xl font-semibold tracking-tight">What’s on your mind?</h1>
     <p className="mt-3 ui-text-secondary max-w-lg leading-relaxed">
      Write, explore, analyze code, or question your local model with zero cloud network egress.
     </p>
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 max-w-2xl">
      {PROMPT_SUGGESTIONS.map((item, idx)=>(
       <button
        key={idx}
        type="button"
        onClick={()=>setPrompt(item.prompt)}
        className="text-left p-3.5 rounded-xl border ui-border ui-surface hover:border-accent transition-colors shadow-sm group"
       >
        <div className="text-xs font-semibold group-hover:text-accent transition-colors">{item.title}</div>
        <p className="text-[11px] ui-text-secondary mt-1 line-clamp-2 leading-relaxed">{item.prompt}</p>
       </button>
      ))}
     </div>
    </div>
   )}
   {messages.map((m,i)=>(
    <article key={i} className={m.role==='user'?'ui-user-bubble rounded-2xl p-5 ml-8':'p-4 group/msg'}>
     <div className="flex items-center justify-between mb-2">
      <div className="text-xs text-display ui-text-secondary tracking-wider">{m.role==='user'?'You':'Sanctum'}</div>
      {m.role==='assistant'&&m.content&&(
       <button
        type="button"
        onClick={()=>copyText(m.content,i)}
        className="text-[11px] ui-text-secondary hover:text-foreground opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1"
        title="Copy response"
       >
        {copiedIndex===i?'✓ Copied':'Copy'}
       </button>
      )}
     </div>
     {m.role==='assistant'?<SafeMarkdown content={m.content||'Thinking locally…'}/>:<div className="whitespace-pre-wrap leading-7">{m.content}</div>}
    </article>
   ))}
  </section>
  <form onSubmit={send} className="app-composer ui-background pt-3 pb-3">
   <div className="ui-surface border ui-border rounded-2xl p-4 shadow-sm">
    <textarea aria-label="Message" placeholder="Ask anything, or type /help…" value={prompt} onChange={e=>setPrompt(e.target.value)} rows={3} className="resize-none w-full bg-transparent"/>
    <div className="flex justify-between items-center mt-2 pt-2 border-t ui-border">
     <div className="flex items-center gap-2">
      <span className="text-xs ui-text-secondary">● Private by default</span>
      <span className="text-[11px] text-display ui-text-secondary hidden sm:inline">· Shift+Enter for new line</span>
     </div>
     <div className="flex items-center gap-2">
      {busy&&<Button variant="outline" onClick={()=>chatRun.stop()}>Stop generation</Button>}
      <button disabled={busy||!prompt.trim()} className="ui-primary text-white py-2 px-5 rounded-lg text-xs font-medium">
       {busy?'Generating…':'Send ↑'}
      </button>
     </div>
    </div>
   </div>
   {chatStatus&&<p className="text-xs ui-text-secondary mt-1" aria-live="polite">{chatStatus}</p>}
   <SpeechPanel token={token} conversation={conversation} answer={messages.filter(m=>m.role==='assistant').at(-1)?.content||''} onTranscript={setPrompt}/>
   <p className="text-[11px] text-center mt-3 ui-text-secondary">Local models run directly on your hardware. Verify important outputs.</p>
  </form></>)}
  {error&&<p role="alert" className="rounded-lg bg-red-50 text-red-800 p-4 my-3">{error}</p>}
 </AppShell>
 <Dialog open={dashboardOpen} title="Platform Dashboard" onClose={()=>setDashboardOpen(false)}>{dashboardOpen&&<DashboardPanel token={token}/>}</Dialog>
 <Dialog open={knowledgeOpen} title="Knowledge" onClose={()=>setKnowledgeOpen(false)}>{knowledgeOpen&&<KnowledgePanel api={api}/>}</Dialog>
 <Dialog open={licensesOpen} title="Licenses" onClose={()=>setLicensesOpen(false)}><pre className="ui-licenses">{thirdPartyNotices}</pre></Dialog>
</>;
}
createRoot(document.getElementById('root')!).render(<App/>);
