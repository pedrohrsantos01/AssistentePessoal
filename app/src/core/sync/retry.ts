export type FailureKind='retry'|'authentication_required'|'update_required'|'blocked'|'paused';
export function failureKind(error:unknown):FailureKind {
  if(error instanceof Error) {
    if(error.message==='session_locked'||error.message==='sync_paused'||error.message==='vault_unavailable') return 'paused';
    if(error.message==='authentication_required') return 'authentication_required';
    if(error.message==='snapshot_retry_required') return 'retry';
    if(error.message==='unsupported_protocol'||error.message==='update_required') return 'update_required';
    if('status' in error&&typeof error.status==='number') {
      if(error.status===401) return 'authentication_required';
      if(error.status===426) return 'update_required';
      if(error.status===408||error.status===429||error.status>=500) return 'retry';
      return 'blocked';
    }
    if(error instanceof TypeError||error.name==='AbortError'||error.name==='TimeoutError') return 'retry';
  }
  return 'blocked';
}
export function retryAfterDelay(error:unknown,now:number):number {
  if(error instanceof Error&&'retryAfter' in error&&typeof error.retryAfter==='string') {
    const value=error.retryAfter.trim();
    const requested=/^\d+$/.test(value)?Number(value)*1000:Date.parse(value)-now;
    if(Number.isFinite(requested)&&requested>0) return requested;
  }
  return 0;
}
export function retryDelay(attempt:number,error:unknown,now:number):number {
  return Math.max(Math.min(1000*2**Math.max(0,attempt-1),300000),retryAfterDelay(error,now));
}
