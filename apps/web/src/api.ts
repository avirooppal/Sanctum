/** Same-origin Sanctum contracts. Credentials and drafts are never persisted here. */
export type Message = {role:'user'|'assistant'; content:string};
export type Model = {id:string; capabilities:string[]};
export type Turn = {request:string; response:string; streaming:boolean};
export type SessionPage = {data:{id:string;title:string}[];has_more:boolean};
export type Workspace = {id:string;name:string};
export type KnowledgeAnswer = {answer:string;abstained:boolean;citations:{source:string;page:number|null;quote:string;document_id:string;chunk_id:string;start:number;end:number}[]};
type Socket = Pick<WebSocket,'close'|'addEventListener'>;
type SocketFactory = (url:string, protocols:string[])=>Socket;

function record(value:unknown): value is Record<string,unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class SanctumClient {
  private readonly origin:string;
  constructor(private readonly token:string, private readonly fetcher:typeof fetch=globalThis.fetch.bind(globalThis),
    origin:string=globalThis.location?.origin ?? 'http://localhost') {
    const parsed=new URL(origin);
    if (!['http:','https:'].includes(parsed.protocol) || parsed.origin !== origin ||
      (globalThis.location && origin !== globalThis.location.origin)) throw Error('Same-origin gateway required');
    this.origin=origin;
  }

  private async request(path:string, signal?:AbortSignal, body?:object, method='GET', conversation?:string) {
    signal?.throwIfAborted();
    const headers:Record<string,string>={Authorization:`Bearer ${this.token}`};
    if (body !== undefined) headers['Content-Type']='application/json';
    if (conversation) headers['X-Sanctum-Conversation']=conversation;
    const response=await this.fetcher(path,{method,headers,signal,credentials:'omit',
      cache:'no-store',redirect:'error',body:body === undefined ? undefined : JSON.stringify(body)});
    if (signal?.aborted || !response.ok) {
      await response.body?.cancel().catch(()=>{});
      signal?.throwIfAborted();
      throw Error(`Gateway request failed (${response.status})`);
    }
    return response;
  }

  async workspaces(signal?:AbortSignal):Promise<Workspace[]> {
    const data:unknown=await (await this.request('/v1/workspaces',signal)).json();
    signal?.throwIfAborted();
    if(!record(data)||!Array.isArray(data.data)||!data.data.every(w=>record(w)&&typeof w.id==='string'&&typeof w.name==='string'))throw Error('Invalid Knowledge workspaces');
    return data.data as Workspace[];
  }

  async createWorkspace(name:string,signal?:AbortSignal):Promise<string> {
    const data:unknown=await (await this.request('/v1/workspaces',signal,{name},'POST')).json();
    signal?.throwIfAborted();
    if(!record(data)||typeof data.id!=='string')throw Error('Invalid Knowledge workspace');
    return data.id;
  }

  async uploadDocument(workspace:string,name:string,bytes:Uint8Array,signal?:AbortSignal):Promise<string> {
    if(!/\.(md|pdf)$/i.test(name))throw Error('Choose Markdown or a text-based PDF.');
    if(bytes.byteLength>10*1024*1024)throw Error('Document exceeds 10 MiB.');
    signal?.throwIfAborted();
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const data:unknown=await (await this.request(`/v1/workspaces/${encodeURIComponent(workspace)}/documents`,signal,
      {name,content_base64:btoa(binary),readers:[],data_class:'restricted'},'POST')).json();
    signal?.throwIfAborted();
    if(!record(data)||typeof data.id!=='string')throw Error('Invalid Knowledge document');
    return data.id;
  }

  async askKnowledge(workspace:string,query:string,signal?:AbortSignal):Promise<KnowledgeAnswer> {
    const data:unknown=await (await this.request(`/v1/workspaces/${encodeURIComponent(workspace)}/ask`,signal,{query},'POST')).json();
    signal?.throwIfAborted();
    if(!record(data)||typeof data.answer!=='string'||typeof data.abstained!=='boolean'||!Array.isArray(data.citations)||
      !data.citations.every(c=>record(c)&&typeof c.source==='string'&&typeof c.quote==='string'&&typeof c.document_id==='string'&&typeof c.chunk_id==='string'&&
        (c.page===null||(Number.isInteger(c.page)&&Number(c.page)>0))&&Number.isInteger(c.start)&&Number.isInteger(c.end)))throw Error('Invalid Knowledge answer');
    return data as KnowledgeAnswer;
  }

  async models(signal?:AbortSignal):Promise<Model[]> {
    const data:unknown=await (await this.request('/v1/models',signal)).json();
    signal?.throwIfAborted();
    if (!record(data) || !Array.isArray(data.data) || !data.data.every(m=>record(m) &&
      typeof m.id === 'string' && Array.isArray(m.capabilities) && m.capabilities.every(c=>typeof c === 'string'))) {
      throw Error('Invalid model response');
    }
    return data.data as Model[];
  }

  async sessions(query:string,offset:number,signal?:AbortSignal):Promise<SessionPage> {
    const data:unknown=await (await this.request('/v1/sessions',signal,{operation:'list',query,offset},'POST')).json();
    signal?.throwIfAborted();
    if(!record(data)||!Array.isArray(data.data)||typeof data.has_more!=='boolean'||
      !data.data.every(s=>record(s)&&typeof s.id==='string'&&typeof s.title==='string'))throw Error('Invalid session response');
    return data as SessionPage;
  }

  private async mutateSession(body:object,signal?:AbortSignal):Promise<void> {
    const data:unknown=await (await this.request('/v1/sessions',signal,body,'POST')).json();
    signal?.throwIfAborted();
    if(!record(data)||data.changed!==true)throw Error('Invalid session mutation response');
  }
  renameSession(id:string,title:string,signal?:AbortSignal):Promise<void> {
    return this.mutateSession({operation:'rename',id,title},signal);
  }
  deleteSession(id:string,signal?:AbortSignal):Promise<void> {
    return this.mutateSession({operation:'delete',id},signal);
  }

  async conversations(signal?:AbortSignal):Promise<string[]> {
    const data:unknown=await (await this.request('/v1/conversations',signal)).json();
    signal?.throwIfAborted();
    if (!record(data) || !Array.isArray(data.data) || !data.data.every(id=>typeof id === 'string')) {
      throw Error('Invalid conversation response');
    }
    return data.data as string[];
  }

  async turns(id:string,signal?:AbortSignal):Promise<Turn[]> {
    const data:unknown=await (await this.request(`/v1/conversations/${encodeURIComponent(id)}`,signal)).json();
    signal?.throwIfAborted();
    if (!record(data) || !Array.isArray(data.data) || !data.data.every(t=>record(t) &&
      typeof t.request === 'string' && typeof t.response === 'string' && typeof t.streaming === 'boolean')) {
      throw Error('Invalid conversation response');
    }
    return data.data as Turn[];
  }

  async *chat(model:string,messages:Message[],conversation:string,signal?:AbortSignal):AsyncGenerator<string> {
    const response=await this.request('/v1/chat/completions',signal,
      {model,messages,stream:true,max_tokens:256},'POST',conversation);
    if (!response.body) throw Error('Missing chat stream');
    const reader=response.body.getReader();
    const cancel=()=>{void reader.cancel().catch(()=>{});};
    signal?.addEventListener('abort',cancel,{once:true});
    const decoder=new TextDecoder('utf-8',{fatal:true});
    let pending='';
    try {
      for (;;) {
        signal?.throwIfAborted();
        const {value,done}=await reader.read();
        signal?.throwIfAborted();
        pending+=decoder.decode(value,{stream:!done});
        const lines=pending.split('\n'); pending=lines.pop() ?? '';
        if (done && pending) {lines.push(pending);pending='';}
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload=line.slice(5).trim();
          if (payload === '[DONE]') return;
          const event:unknown=JSON.parse(payload);
          if (!record(event) || !Array.isArray(event.choices)) throw Error('Invalid chat event');
          for (const choice of event.choices) {
            if (!record(choice) || !record(choice.delta)) throw Error('Invalid chat delta');
            const content=choice.delta.content;
            if (content !== undefined && content !== null && typeof content !== 'string') throw Error('Invalid chat content');
            if (typeof content === 'string' && content) {signal?.throwIfAborted();yield content;}
          }
        }
        if (done) return;
      }
    } finally {
      signal?.removeEventListener('abort',cancel);
      await reader.cancel().catch(()=>{});
      reader.releaseLock();
    }
  }

  async realtime(factory:SocketFactory=(url,protocols)=>new WebSocket(url,protocols),signal?:AbortSignal):Promise<Socket> {
    const ticket:unknown=await (await this.request('/v1/realtime/tickets',signal,undefined,'POST')).json();
    signal?.throwIfAborted();
    if (!record(ticket) || typeof ticket.ticket !== 'string' || !/^[0-9a-f]{64}$/.test(ticket.ticket) ||
      ticket.protocol !== 'sanctum.realtime.v1' || ticket.expires_in !== 30) throw Error('Invalid ticket response');
    const url=new URL('/v1/realtime',this.origin);
    url.protocol=url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket=factory(url.href,['sanctum.realtime.v1',`ticket.${ticket.ticket}`]);
    const cancel=()=>socket.close();
    signal?.addEventListener('abort',cancel,{once:true});
    socket.addEventListener('close',()=>signal?.removeEventListener('abort',cancel),{once:true});
    if (signal?.aborted) socket.close();
    return socket;
  }

  async capabilities(signal?: AbortSignal): Promise<{ capabilities: string[]; profile: string; hardware?: { threads: number; context: number } }> {
    const res = await this.request('/v1/capabilities', signal);
    const data: unknown = await res.json();
    if (!record(data) || !Array.isArray(data.capabilities)) throw Error('Invalid capabilities response');
    return data as { capabilities: string[]; profile: string; hardware?: { threads: number; context: number } };
  }

  async preferences(signal?: AbortSignal): Promise<Record<string, unknown> | null> {
    const res = await this.request('/v1/preferences', signal);
    const data: unknown = await res.json();
    if (!record(data)) throw Error('Invalid preferences response');
    return (data.preferences as Record<string, unknown> | null) ?? null;
  }

  async savePreferences(preferences: Record<string, unknown>, signal?: AbortSignal): Promise<void> {
    const body = JSON.stringify(preferences);
    const res = await this.request('/v1/preferences', signal, { 'Content-Type': 'application/json' }, 'POST', body);
    if (!res.ok) throw Error(`Failed to save preferences: ${res.status}`);
  }
}

