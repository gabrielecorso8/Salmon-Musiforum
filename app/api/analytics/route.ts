import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
const allowed=new Set(['page_view','reader_view','archive_view','subscription_monthly','subscription_yearly','booking_link','booking_phone']);
const headers={'Cache-Control':'no-store'};
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return new Response(null,{status:403});
 try{
  const user=await getChatGPTUser();const email=user?.email?.toLowerCase();
  const owner=((env as unknown as {MUSIFORUM_OWNER_EMAIL?:string}).MUSIFORUM_OWNER_EMAIL||'').toLowerCase();
  if(email&&(email===owner||await env.DB.prepare('SELECT email FROM editors WHERE email=?').bind(email).first()))return new Response(null,{status:204,headers});
  const text=await req.text(); if(text.length>128)return new Response(null,{status:413});
  const body=JSON.parse(text);if(!body||Object.keys(body).length!==1||!allowed.has(body.event))return new Response(null,{status:400});
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const key='analytics-v2:'+day+':'+body.event;
  await env.DB.prepare("INSERT INTO documents (key,value,updated_at) VALUES (?,'1',?) ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT),updated_at=excluded.updated_at").bind(key,new Date().toISOString()).run();
  return new Response(null,{status:204,headers});
 }catch{return new Response(null,{status:503,headers})}
}
export async function GET(){
 const u=await getChatGPTUser();const email=u?.email?.toLowerCase();const owner=((env as unknown as {MUSIFORUM_OWNER_EMAIL?:string}).MUSIFORUM_OWNER_EMAIL||'').toLowerCase();
 if(!email||!(email===owner||await env.DB.prepare('SELECT email FROM editors WHERE email=?').bind(email).first()))return Response.json({error:'Accesso riservato'},{status:403,headers});
 try{const rows=await env.DB.prepare("SELECT key,value FROM documents WHERE key LIKE 'analytics-v2:%' ORDER BY key DESC LIMIT 1830").all<{key:string,value:string}>();
 const totals:Record<string,number>={};for(const row of rows.results||[]){const event=row.key.split(':')[2];if(allowed.has(event))totals[event]=(totals[event]||0)+(Number(row.value)||0)}
 return Response.json({totals},{headers});}catch{return Response.json({error:'Statistiche non disponibili'},{status:503,headers})}
}
