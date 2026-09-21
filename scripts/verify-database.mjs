import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const url=process.env.PITLANE_SUPABASE_URL,key=process.env.PITLANE_SUPABASE_SERVICE_KEY;
if(url!=='https://irltuonabpmnvqdikuvv.supabase.co')throw new Error('Wrong Pitlane project');
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
async function rpc(name,body){const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body)});if(!r.ok)throw new Error(`${name}: HTTP ${r.status}`);return r.json()}
const id=`db-check-${Date.now()}`,payload=JSON.stringify({request_id:id,budget_aed:150000}),results=[];
const pass=test=>{results.push({test,status:'passed'});console.log('PASS',test)};
try{
 const inventory=await fetch(`${url}/rest/v1/inventory?status=eq.available`,{headers});assert(inventory.ok);assert.equal((await inventory.json()).length,5);pass('Live inventory contains five available seed vehicles');
 for(const table of ['inventory','enquiry_runs','enquiry_reports','workflow_errors']){const r=await fetch(`${url}/rest/v1/${table}?limit=1`,{headers:{apikey:process.env.PITLANE_SUPABASE_ANON_KEY,Authorization:`Bearer ${process.env.PITLANE_SUPABASE_ANON_KEY}`}});assert([401,403].includes(r.status))}pass('Anonymous access denied to all Pitlane tables');
 const claims=await Promise.all(Array.from({length:5},()=>rpc('claim_enquiry',{p_request_id:id,p_payload_hash:payload,p_lease_seconds:90})));assert.equal(claims.filter(c=>c.status==='claimed').length,1);assert.equal(claims.filter(c=>c.status==='processing').length,4);pass('Five simultaneous duplicates produce exactly one claim');
 const token=claims.find(c=>c.status==='claimed').claim_token;
 const report=await rpc('finalize_enquiry',{p_request_id:id,p_claim_token:token,p_normalized_preferences:JSON.parse(payload),p_shortlist:[],p_priority:'low',p_reasons:['Verification fixture'],p_advisor_brief:'Synthetic database verification',p_fetched_at:new Date().toISOString()});assert.equal(report.request_id,id);pass('Finalization persists a report');
 const replay=await rpc('claim_enquiry',{p_request_id:id,p_payload_hash:payload});assert.equal(replay.status,'completed');assert.deepEqual(replay.report,report);pass('Same normalized request replays identical stored report');
 const conflict=await rpc('claim_enquiry',{p_request_id:id,p_payload_hash:JSON.stringify({request_id:id,budget_aed:100000})});assert.equal(conflict.status,'conflict');pass('Changed payload is rejected as conflict');
 const recoveryId=id+'-recovery';
 try {
  const first=await rpc('claim_enquiry',{p_request_id:recoveryId,p_payload_hash:payload});
  const expired=await fetch(`${url}/rest/v1/enquiry_runs?request_id=eq.${recoveryId}`,{method:'PATCH',headers,body:JSON.stringify({lease_expires_at:'2000-01-01T00:00:00Z'})});assert(expired.ok);
  const second=await rpc('claim_enquiry',{p_request_id:recoveryId,p_payload_hash:payload});assert.equal(second.status,'claimed');assert.notEqual(first.claim_token,second.claim_token);pass('Expired lease can be reclaimed with a new token');
  const args={p_request_id:recoveryId,p_claim_token:first.claim_token,p_normalized_preferences:{},p_shortlist:[],p_priority:'low',p_reasons:[],p_advisor_brief:'Lease recovery verification',p_fetched_at:new Date().toISOString()};
  const stale=await fetch(`${url}/rest/v1/rpc/finalize_enquiry`,{method:'POST',headers,body:JSON.stringify(args)});assert.equal(stale.status,400);pass('Stale worker cannot finalize a reclaimed request');
  const recovered=await rpc('finalize_enquiry',{...args,p_claim_token:second.claim_token});assert.equal(recovered.request_id,recoveryId);pass('Current worker finalizes reclaimed request');
 } finally {await fetch(`${url}/rest/v1/enquiry_runs?request_id=eq.${recoveryId}`,{method:'DELETE',headers})}
}finally{await fetch(`${url}/rest/v1/enquiry_runs?request_id=eq.${id}`,{method:'DELETE',headers})}
await writeFile('evidence/database-tests.json',JSON.stringify({testedAt:new Date().toISOString(),project:'irltuonabpmnvqdikuvv',results},null,2));
