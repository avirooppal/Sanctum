export const MESSAGES = {
  unknown:'Sanctum could not finish this operation. Your request was not retried automatically.',
  offline:'Sanctum is unavailable. Start the local runtime, then check again.',
  auth:"The local access key was not accepted. Check the runtime's token file and sign in again.",
  invalid:'This request could not be accepted. Review the highlighted fields.',
  cancelled:'Cancelled. No automatic retry will run.',
  deadline:'This operation reached its time limit. Review its saved state before restarting.',
  busy:'The local engine is busy. Wait for the displayed retry interval, then retry.',
  scope:'This data is outside the selected workspace or tool scope.',
  unsupported:'This capability is not available on this runtime.',
  document:'Choose a Markdown file or a text-based PDF up to 10 MiB.',
  engine:'The local engine stopped. Your saved data is unchanged; the unfinished answer may not be saved.',
} as const;

export class GatewayError extends Error {
  readonly retryAfter:number|null;
  constructor(readonly status:number,retryAfter:string|null=null) {
    super(status===401?MESSAGES.auth:status===403?MESSAGES.scope:
      status===429||status===503?MESSAGES.busy:status===504?MESSAGES.deadline:
      status===502?MESSAGES.engine:status===404||status===405||status===501?MESSAGES.unsupported:
      status===413?MESSAGES.document:status===400?MESSAGES.invalid:MESSAGES.unknown);
    this.name='GatewayError';
    const seconds=retryAfter!==null&&/^\d+$/.test(retryAfter)?Number(retryAfter):NaN;
    this.retryAfter=Number.isSafeInteger(seconds)&&seconds>=0?seconds:null;
  }
}

export function userError(error:unknown):string {
  if(error instanceof GatewayError)return error.message+(error.retryAfter===null?'':` Retry after ${error.retryAfter} seconds.`);
  if(error instanceof DOMException&&error.name==='AbortError')return MESSAGES.cancelled;
  if(error instanceof TypeError)return MESSAGES.offline;
  if(error instanceof Error&&['Choose Markdown or a text-based PDF.','Document exceeds 10 MiB.'].includes(error.message))return MESSAGES.document;
  return MESSAGES.unknown;
}

const DENIAL_CHECKS=['host_fd_import','host_unix_socket','io_uring','ipv4_tcp','ipv4_udp',
  'ipv6_tcp','ipv6_udp','namespace_change'];
export type RuntimeHealth={status?:string;isolation?:string;cloud_connectors?:string;checks?:unknown};
export function startupChecksPassed(value:unknown):boolean {
  if(!value||typeof value!=='object')return false;
  const health=value as RuntimeHealth;
  if(health.status!=='ok'||health.cloud_connectors!=='disabled'||health.isolation!=='linux-user-netns-seccomp')return false;
  if(!health.checks||typeof health.checks!=='object'||Array.isArray(health.checks))return false;
  const checks=health.checks as Record<string,unknown>;
  return DENIAL_CHECKS.every(key=>checks[key]==='denied')&&Object.values(checks).every(result=>result==='denied');
}
export function privacyMessage(value:unknown):string {
  return startupChecksPassed(value)?'Startup denial checks passed. Ledger unavailable.':
    'Startup checks: unknown. Ledger unavailable.';
}
