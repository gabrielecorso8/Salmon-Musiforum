import { getChatGPTUser } from '../../chatgpt-auth';
import { env } from 'cloudflare:workers';
const OWNER=((env as unknown as { MUSIFORUM_OWNER_EMAIL?: string }).MUSIFORUM_OWNER_EMAIL || '').toLowerCase();
export async function GET(){const u=await getChatGPTUser();if(!u)return Response.json({authenticated:false,admin:false});const email=u.email.toLowerCase();let admin=email===OWNER;if(!admin&&env.DB){const row=await env.DB.prepare('SELECT email FROM editors WHERE email = ?').bind(email).first();admin=!!row;}return Response.json({authenticated:true,admin,owner:email===OWNER,email},{headers:{'Cache-Control':'no-store'}})}
