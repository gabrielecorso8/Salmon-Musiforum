import { getChatGPTUser } from '../../chatgpt-auth';
import { env } from 'cloudflare:workers';
import prepared from '../album-tracks/prepared.json';
export async function GET(){const user=await getChatGPTUser();const email=user?.email?.toLowerCase();if(!email||email!==((env as unknown as { MUSIFORUM_OWNER_EMAIL?: string }).MUSIFORUM_OWNER_EMAIL || '').toLowerCase()&&!await env.DB.prepare('SELECT email FROM editors WHERE email=?').bind(email).first())return Response.json({error:'Accesso riservato'},{status:403});return Response.json(prepared,{headers:{'Cache-Control':'private, no-store'}})}
