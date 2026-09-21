import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const snapshot=JSON.parse(await readFile('data/dubai-listings.json','utf8'));
const rows=snapshot.listings.map(v=>({...v,status:'advertised',source:'YallaMotor demo snapshot',source_observed_at:snapshot.source_observed_at,location:'Dubai',regional_specs:v.regional_specs||'GCC Specs',body_type_source:'Model-category enrichment; verify specific body configuration with seller'}));
for(const row of rows){assert(row.make&&row.model&&row.source_url&&row.asking_price_aed>0&&Number.isInteger(row.mileage_km)&&row.mileage_km>=0);assert.equal(new URL(row.source_url).hostname,'uae.yallamotor.com');}
const key=process.env.PITLANE_SUPABASE_SERVICE_KEY;
const r=await fetch(process.env.PITLANE_SUPABASE_URL+'/rest/v1/market_listings?on_conflict=stock_number',{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows)});
if(!r.ok)throw new Error('Snapshot import failed: HTTP '+r.status);
const saved=await r.json();assert.equal(saved.length,rows.length);
assert.equal(new Set(saved.map(v=>v.stock_number)).size,rows.length);
await writeFile('evidence/dubai-import.json',JSON.stringify({imported_at:new Date().toISOString(),mode:snapshot.mode,count:saved.length,source_observed_at:snapshot.source_observed_at,stock_numbers:saved.map(v=>v.stock_number)},null,2));console.log(`Imported ${saved.length} unique Dubai listing snapshots into Supabase.`);
