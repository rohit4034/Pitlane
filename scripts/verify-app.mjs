import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3080',results=[];
let r=await fetch(base);assert.equal(r.status,200);assert((await r.text()).includes('Build shortlist'));results.push('Advisor UI served');
r=await fetch(base+'/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:'ui-check-'+Date.now(),customer_name:'UI Demo Buyer',preferred_make:'BMW',body_type:'SUV',budget_aed:150000,purchase_timeline:'within_30_days'})});assert.equal(r.status,200);const data=await r.json();assert.equal(data.report.shortlist[0].stock_number,'YM-2140402');results.push('UI server invokes real n8n workflow and returns ranked report');
r=await fetch(base+'/api/reports');assert.equal(r.status,200);assert((await r.json()).reports.some(v=>v.request_id===data.report.request_id));results.push('Generated report appears in saved history');
r=await fetch(base+'/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:'{}'});assert.equal(r.status,403);results.push('Foreign-origin requests rejected');
await writeFile('evidence/app-tests.json',JSON.stringify({testedAt:new Date().toISOString(),requestId:data.report.request_id,results},null,2));console.log(results.join('\n'));
