/** Bounded metadata read only;never sends credentials or claims an egress history. */
export type HealthObservation={health:unknown;receivedAt:number|null};
export async function observeHealth(fetcher:typeof fetch=globalThis.fetch.bind(globalThis),parent?:AbortSignal):Promise<HealthObservation>{
  const controller=new AbortController();
  const signal=parent?AbortSignal.any([parent,controller.signal]):controller.signal;
  const timer=setTimeout(()=>controller.abort(),5000);
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  try{
    const response=await fetcher('/healthz',{signal,credentials:'omit',cache:'no-store',redirect:'error'});
    if(!response.ok||response.redirected||response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!response.body)return {health:null,receivedAt:null};
    reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
    while(true){
      const part=await reader.read();signal.throwIfAborted();if(part.done)break;
      size+=part.value.byteLength;if(size>65536)throw Error('Health response exceeded limit');
      chunks.push(part.value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return {health:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown,receivedAt:Date.now()};
  }catch{return {health:null,receivedAt:null};}
  finally{clearTimeout(timer);controller.abort();if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}}
}
