const $=id=>document.getElementById(id), form=$('enquiry-form');
const money=v=>new Intl.NumberFormat('en-AE',{maximumFractionDigits:0}).format(v);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let currentReport, busy=false, lastSubmittedPayload=null, catalogMakes=null;
function newId(){form.elements.request_id.value='enquiry-'+crypto.randomUUID();}
function showView(history){$('cars-view').hidden=true;$('cars-tab').classList.remove('active');$('enquiry-view').hidden=history;$('history-view').hidden=!history;$('new-tab').classList.toggle('active',!history);$('history-tab').classList.toggle('active',history);}
function render(report,replay=false){currentReport=report;const p=report.normalized_preferences;
 const requestedMake=p.preferred_make;
 const hasMake=report.shortlist.some(v=>v.make.toLowerCase()===requestedMake?.toLowerCase());
 const absentFromCatalog=catalogMakes&&!catalogMakes.some(make=>make.toLowerCase()===requestedMake?.toLowerCase());
 const makeMessage=requestedMake&&!hasMake?(absentFromCatalog?`No ${requestedMake} listings are in the current Dubai catalog.`:`No ${requestedMake} listings matched this enquiry within AED ${money(p.budget_aed)}.`):'';
 const alternativeMessage=makeMessage&&report.shortlist.length?'The cars below are alternatives from other makes, not '+requestedMake+' matches.':'';
 $('result').innerHTML=`<div class="report-head"><div class="report-top"><span class="eyebrow">ADVISOR BRIEF${replay?' · SAVED REPORT':''}</span><span class="badge">${escape(report.priority)} priority</span></div><h2>${escape(p.customer_name)}’s shortlist</h2>${makeMessage?`<div class="match-notice"><strong>${escape(makeMessage)}</strong><p>${escape(alternativeMessage)}</p></div>`:''}<p>${escape(report.advisor_brief)}</p>${report.reasons.map(r=>`<p>• ${escape(r)}</p>`).join('')}</div>${report.shortlist.length?report.shortlist.map((v,i)=>`<article class="vehicle"><div class="vehicle-top"><div>${requestedMake&&v.make.toLowerCase()!==requestedMake.toLowerCase()?'<span class="alternative-badge">Alternative make</span>':''}<span class="stock">0${i+1} / ${escape(v.stock_number)}</span><h3>${escape(v.make)} ${escape(v.model)}</h3></div><strong class="price"><small>AED</small> ${money(v.asking_price_aed)}</strong></div><p class="specs">${escape(v.model_year)} &nbsp; · &nbsp; ${money(v.mileage_km)} km &nbsp; · &nbsp; ${escape(v.body_type)}</p><div class="tags">${v.match_reasons.map(r=>`<span>${escape(r)}</span>`).join('')}</div>${listingSource(v)}</article>`).join(''):'<div class="vehicle"><h3>No vehicles within budget</h3><p class="specs">Discuss budget flexibility with the buyer. No unavailable or over-budget stock has been suggested.</p></div>'}<p class="report-meta">Report data fetched ${escape(new Date(report.fetched_at).toLocaleString())}<br>Request: ${escape(report.request_id)}</p><div class="report-actions"><button class="secondary" id="print">Print brief</button><button class="secondary" id="download">Download JSON</button></div>`;
 $('print').onclick=()=>window.print();$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(currentReport,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='pitlane-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;$('submit').disabled=true;$('reset').disabled=true;$('status').className='';$('status').textContent='Checking inventory and saving your advisor brief…';
 const data=Object.fromEntries(new FormData(form));data.budget_aed=Number(data.budget_aed);if(!data.preferred_make)delete data.preferred_make;if(!data.body_type)delete data.body_type;
 const {request_id:submittedId,...preferences}=data;const fingerprint=JSON.stringify(preferences);
 if(lastSubmittedPayload&&lastSubmittedPayload.id===submittedId&&lastSubmittedPayload.fingerprint!==fingerprint){newId();data.request_id=form.elements.request_id.value;}
 lastSubmittedPayload={id:data.request_id,fingerprint};
 try{const r=await fetch('/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(r.status===202){$('status').textContent='This enquiry is processing. Submit again shortly with the same request ID.';return;}if(r.status===409){newId();lastSubmittedPayload=null;throw new Error('This request ID belongs to a different enquiry. A new ID is ready—click Build shortlist again.');}if(!r.ok){throw new Error(result.fields?.map(f=>`${f.field}: ${f.message}`).join('; ')||result.message||result.error||'Unable to generate report');}render(result.report,result.replay);$('status').textContent=result.replay?'Retrieved the saved report.':'Report saved. Your shortlist is ready.';
 }catch(error){$('status').className='error';$('status').textContent=error.message;}finally{busy=false;$('submit').disabled=false;$('reset').disabled=false;}
});
async function history(){showView(true);$('history').textContent='Loading saved reports…';try{const r=await fetch('/api/reports');const data=await r.json();if(!r.ok)throw new Error(data.error);$('history').innerHTML=data.reports.length?data.reports.map((report,i)=>`<article class="history-row"><div><h3>${escape(report.normalized_preferences.customer_name||'Verification enquiry')}</h3><p>${escape(new Date(report.completed_at).toLocaleString())} · ${report.shortlist.length} vehicles · ${escape(report.priority)} priority</p></div><button class="secondary" data-index="${i}">Open report ↗</button></article>`).join(''):'No saved reports yet. Create your first enquiry.';$('history').querySelectorAll('button').forEach(b=>b.onclick=()=>{showView(false);render(data.reports[Number(b.dataset.index)],true);});}catch(error){$('history').textContent=error.message;}}
$('new-tab').onclick=()=>showView(false);$('history-tab').onclick=history;$('refresh').onclick=history;$('reset').onclick=()=>{form.reset();newId();$('status').textContent='Ready for a new enquiry.';form.elements.customer_name.focus();};newId();

let lookupSequence=0;
function clearLookup(){lookupSequence++;$('lookup-models').replaceChildren();$('lookup-status').textContent='Explore real models for your preferred make. Reference data only; your shortlist uses available inventory.';$('lookup').disabled=false;}
form.elements.preferred_make.addEventListener('input',clearLookup);
$('reset').addEventListener('click',clearLookup);
$('lookup').onclick=async()=>{
 const make=form.elements.preferred_make.value.trim(),sequence=++lookupSequence;
 if(!make){$('lookup-status').textContent='Select a preferred make first, such as BMW.';return;}
 $('lookup').disabled=true;$('lookup-models').replaceChildren();$('lookup-status').textContent='Looking up '+make+' models through n8n…';
 try{const r=await fetch('/api/vehicle-lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({make}),signal:AbortSignal.timeout(25000)});const data=await r.json();if(sequence!==lookupSequence)return;if(!r.ok||!data.ok)throw new Error(data.error||'Reference lookup unavailable. You can still build your shortlist.');
 $('lookup-status').textContent=data.models.length?`${data.models.length} ${data.make} reference models from NHTSA vPIC. Not a list of available stock.`:'No reference models found for this make. You can still build your inventory shortlist.';
 for(const model of data.models){const span=document.createElement('span');span.textContent=model;$('lookup-models').append(span);}
 const source=document.createElement('a');source.href='https://vpic.nhtsa.dot.gov/api/';source.target='_blank';source.rel='noopener noreferrer';source.textContent=' Source: NHTSA vPIC';$('lookup-status').append(source);
 }catch(error){if(sequence===lookupSequence)$('lookup-status').textContent=error.name==='TimeoutError'?'Reference lookup timed out. You can still build your shortlist.':error.message;}finally{if(sequence===lookupSequence)$('lookup').disabled=false;}
};

function listingSource(v){if(!v.source_url)return '';let url;try{url=new URL(v.source_url);if(url.protocol!=='https:'||url.hostname!=='uae.yallamotor.com')return '';}catch{return '';}
return `<p class="specs">Dubai · ${escape(v.regional_specs||'')} · Advertised in source snapshot</p><p class="hint">Observed ${escape(String(v.source_observed_at).slice(0,10))} · Confirm current price and availability</p><a class="secondary source-link" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">View YallaMotor listing ↗</a>`;}
$('cars-tab').onclick=async()=>{showView(false);$('enquiry-view').hidden=true;$('new-tab').classList.remove('active');$('cars-tab').classList.add('active');$('cars-view').hidden=false;$('cars').textContent='Loading Dubai listings from Supabase…';try{const r=await fetch('/api/cars');const data=await r.json();if(!r.ok)throw new Error(data.error);$('cars').innerHTML=data.cars.map(v=>`<article class="vehicle"><div class="vehicle-top"><h3>${escape(v.make)} ${escape(v.model)}</h3><strong class="price"><small>AED</small> ${money(v.asking_price_aed)}</strong></div><p class="specs">${escape(v.model_year)} · ${money(v.mileage_km)} km · ${escape(v.body_type)}</p>${listingSource(v)}</article>`).join('')||'No complete listing snapshots available.';}catch(e){$('cars').textContent=e.message;}};

async function loadCatalogMakes(){
 const select=form.elements.preferred_make;
 try{const r=await fetch('/api/cars');const data=await r.json();if(!r.ok||!Array.isArray(data.cars))throw new Error('Catalog unavailable');
 catalogMakes=[...new Set(data.cars.filter(v=>typeof v.make==='string'&&v.make.trim()&&v.asking_price_aed>0&&v.status==='advertised').map(v=>v.make.trim()))].sort();
 select.replaceChildren(new Option('Any make',''));for(const make of catalogMakes)select.add(new Option(make,make));select.disabled=false;
 $('make-status').textContent='Only makes with cars in the Dubai catalog are listed.';
 }catch{select.replaceChildren(new Option('Any make',''));select.disabled=false;$('make-status').textContent='Could not load catalog makes. You can search across all makes.';}
}
loadCatalogMakes();
