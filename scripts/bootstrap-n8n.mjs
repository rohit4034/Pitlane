import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:5678';
let ready=false;for(let i=0;i<30;i++){try{if((await fetch(base+'/healthz')).ok){ready=true;break}}catch{} await new Promise(r=>setTimeout(r,1000));}
if(!ready)throw new Error('n8n is not ready on port 5678');
const setup=await fetch(base+'/rest/owner/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@pitlane.local',firstName:'Pitlane',lastName:'Demo',password:process.env.N8N_OWNER_PASSWORD})});
if(!setup.ok&&setup.status!==400)throw new Error(`Owner setup failed: HTTP ${setup.status}`);
const login=await fetch(base+'/rest/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emailOrLdapLoginId:'owner@pitlane.local',password:process.env.N8N_OWNER_PASSWORD})});
if(!login.ok)throw new Error(`Owner login failed: HTTP ${login.status}`);
console.log('Owner account verified.');
function docker(args,input){try{return execFileSync('docker',['compose','exec','-T','n8n',...args],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']})}catch(error){throw new Error('n8n CLI import failed: '+String(error.stderr||'').slice(-1000));}}
const credentials=readFileSync('.credentials/n8n-credentials.json');
docker(['sh','-c','umask 077; cat > /tmp/pitlane-credentials.json; n8n import:credentials --input=/tmp/pitlane-credentials.json; result=$?; rm -f /tmp/pitlane-credentials.json; exit "$result"'],credentials);
console.log('Imported encrypted server-side credentials.');
for(const file of ['pitlane-errors.json','pitlane-enquiry.json','pitlane-vehicle-lookup.json']){console.log(docker(['n8n','import:workflow',`--input=/files/workflows/${file}`]).trim());}
writeFileSync('evidence/n8n-import.json',JSON.stringify({importedAt:new Date().toISOString(),instance:base,workflows:['PitlaneErrors01','PitlaneEnquiry01','PitlaneLookup01'],credentials:['Pitlane Supabase','Pitlane Webhook Secret']},null,2));
console.log('Workflows imported. Publish the main workflow before production webhook tests.');
