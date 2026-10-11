/** Owns a single composer request; transport cancellation belongs to the adapter. */
export class ChatRun {
  private controller:AbortController|null=null;
  get active():boolean {return this.controller !== null;}
  stop():void {this.controller?.abort();}

  async start(source:(signal:AbortSignal)=>AsyncIterable<string>,
    onDelta:(text:string)=>void):Promise<'complete'|'stopped'> {
    if(this.controller) throw Error('Chat already active');
    const controller=new AbortController();this.controller=controller;
    try {
      for await(const delta of source(controller.signal)) {
        if(controller.signal.aborted) return 'stopped';
        onDelta(delta);
      }
      return controller.signal.aborted?'stopped':'complete';
    } catch(error) {
      if(controller.signal.aborted) return 'stopped';
      throw error;
    } finally {this.controller=null;}
  }
}
