/** Same-origin Sanctum contracts. Credentials and drafts are never persisted here. */
export type Message = {role:'user'|'assistant'; content:string};
export type Model = {id:string; capabilities:string[]};
export type Turn = {request:string; response:string; streaming:boolean};
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

  async models(signal?:AbortSignal):Promise<Model[]> {
    const data:unknown=await (await this.request('/v1/models',signal)).json();
    signal?.throwIfAborted();
    if (!record(data) || !Array.isArray(data.data) || !data.data.every(m=>record(m) &&
      typeof m.id === 'string' && Array.isArray(m.capabilities) && m.capabilities.every(c=>typeof c === 'string'))) {
      throw Error('Invalid model response');
    }
    return data.data as Model[];
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
}
