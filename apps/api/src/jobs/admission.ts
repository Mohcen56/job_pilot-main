import type { BackendContext } from '../context';
import { getPool } from '../database/pool';
export class DiscoveryLimitError extends Error {}
/** Discovery has its own abuse bounds: it must remain usable when the AI allowance is exhausted. */
export async function withDiscoveryLimit<T>(context:BackendContext,work:()=>Promise<T>):Promise<T> {
  if(!context.user)throw new Error('Unauthorized');
  const pool=getPool();const client=await pool.connect();const userId=context.user.id;
  try {
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(78419232)');
    await client.query('DELETE FROM discovery_leases WHERE expires_at<=now()');
    await client.query("DELETE FROM discovery_counters WHERE window_start<now()-interval '2 days'");
    const leases=await client.query<{user_id:string}>('SELECT user_id FROM discovery_leases');
    if(leases.rows.some(r=>r.user_id===userId))throw new DiscoveryLimitError('A job discovery is already running for your account. Please wait for it to finish.');
    if(leases.rows.length>=3)throw new DiscoveryLimitError('Job discovery is busy. Please try again in a minute.');
    const counter=await client.query("INSERT INTO discovery_counters(user_id,window_start,used) VALUES($1,date_trunc('hour',now()),1) ON CONFLICT(user_id,window_start) DO UPDATE SET used=discovery_counters.used+1 WHERE discovery_counters.used<20 RETURNING used",[userId]);
    if(!counter.rowCount)throw new DiscoveryLimitError('Your job discovery allowance has been reached (20 searches per hour). Please try again next hour.');
    await client.query("INSERT INTO discovery_leases(user_id,expires_at) VALUES($1,now()+interval '3 minutes')",[userId]);await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
  try {return await work();} finally {await pool.query('DELETE FROM discovery_leases WHERE user_id=$1',[userId]).catch(()=>console.warn('[discovery] Lease release unavailable'));}
}
