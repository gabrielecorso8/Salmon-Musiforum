import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';

const maxBytes = 900_000;
const mediaId = /^[a-f0-9-]{36}$/;

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'Richiesta non autorizzata' }, { status: 403 });
  }
  const user = await getChatGPTUser();
  const email = user?.email?.toLowerCase();
  if (!email) return Response.json({ error: 'Accedi per caricare immagini' }, { status: 401 });
  if (!env.DB || !env.BUCKET) {
    return Response.json({ error: 'Archivio immagini non disponibile' }, { status: 503 });
  }
  if (email !== ((env as unknown as { MUSIFORUM_OWNER_EMAIL?: string }).MUSIFORUM_OWNER_EMAIL || '').toLowerCase() &&
      !await env.DB.prepare('SELECT email FROM editors WHERE email = ?').bind(email).first()) {
    return Response.json({ error: 'Accesso riservato agli amministratori' }, { status: 403 });
  }
  if (request.headers.get('content-type') !== 'image/jpeg') {
    return Response.json({ error: 'Formato immagine non valido' }, { status: 415 });
  }
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'Immagine mancante' }, { status: 400 });
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return Response.json({ error: 'Immagine troppo grande' }, { status: 413 });
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  if (size < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) {
    return Response.json({ error: 'File JPEG non valido' }, { status: 415 });
  }
  const id = crypto.randomUUID();
  await env.BUCKET.put(id, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  return Response.json({ url: '/api/media?id=' + id });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!mediaId.test(id) || !env.BUCKET) return new Response(null, { status: 404 });
  const image = await env.BUCKET.get(id);
  if (!image) return new Response(null, { status: 404 });
  return new Response(image.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
