import {readFile} from 'node:fs/promises';
const host='127.0.0.1',port=Number(process.env.PITLANE_APP_PORT||3080);
const db=process.env.PITLANE_SUPABASE_URL,key=process.env.PITLANE_SUPABASE_SERVICE_KEY;
const webhook=process.env.PITLANE_WEBHOOK_URL,secret=process.env.PITLANE_WEBHOOK_SECRET;
if(!db||!key)throw new Error('Configure Supabase server environment variables');
const headers={apikey:key,Authorization:`Bearer ${key}`};
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
export default async function handler(req,res){
 try {
  const url=new URL(req.url,`http://${host}:${port}`);
  const validHost=process.env.VERCEL?req.headers.host?.endsWith('.vercel.app'):[`${host}:${port}`,`localhost:${port}`].includes(req.headers.host);
  if(!validHost)return reply(res,403,{error:'invalid_host'});
  if(req.headers.origin&&![(process.env.VERCEL?'https://':'http://')+req.headers.host].includes(req.headers.origin))return reply(res,403,{error:'invalid_origin'});
  if(req.method==='POST'&&['/api/enquiries','/api/vehicle-lookup'].includes(url.pathname)){
   if(!req.headers['content-type']?.startsWith('application/json'))return reply(res,415,{error:'Use application/json'});
   let raw=typeof req.body==='object'?JSON.stringify(req.body):typeof req.body==='string'?req.body:'';if(!raw)for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)return reply(res,413,{error:'Enquiry too large'});}
   let body;try{body=JSON.parse(raw)}catch{return reply(res,400,{error:'Invalid JSON'})}
   if(!webhook||!secret)return reply(res,503,{error:'Hosted n8n connection is awaiting setup. The Dubai catalog is available now.'});
   const target=url.pathname==='/api/vehicle-lookup'?new URL('/webhook/pitlane/vehicle-lookup',webhook).href:webhook;
   const upstream=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json','X-Pitlane-Webhook-Secret':secret},body:JSON.stringify(body),signal:AbortSignal.timeout(110000)});
   const data=await upstream.json();return reply(res,upstream.status,data);
  }
  if(req.method==='GET'&&url.pathname==='/api/cars'){
   const upstream=await fetch(db+'/rest/v1/market_listings?status=eq.advertised&asking_price_aed=gt.0&select=*&order=asking_price_aed.asc&limit=100',{headers,signal:AbortSignal.timeout(10000)});
   if(!upstream.ok)return reply(res,503,{error:'Dubai catalog is temporarily unavailable'});
   return reply(res,200,{cars:await upstream.json(),mode:'demo_snapshot'});
  }
  if(req.method==='GET'&&url.pathname==='/api/reports'){
   const upstream=await fetch(db+'/rest/v1/enquiry_reports?select=*&order=completed_at.desc&limit=50',{headers,signal:AbortSignal.timeout(10000)});
   if(!upstream.ok)return reply(res,503,{error:'Report history is temporarily unavailable'});
   return reply(res,200,{reports:await upstream.json()});
  }
  const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
  if(req.method==='GET'&&files[url.pathname]){
   const [file,type]=files[url.pathname];res.writeHead(200,{'Content-Type':type+'; charset=utf-8','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"});return res.end(await readFile(new URL('./public/'+file,import.meta.url)));
  }
  reply(res,404,{error:'Not found'});
 }catch(error){reply(res,503,{error:error.name==='TimeoutError'?'Request timed out. Retry with the same request ID.':'Service unavailable. Check that n8n is running and retry.'});}
}

