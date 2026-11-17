const normalize = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export async function GET(request: Request) {
  const u = new URL(request.url), artist = (u.searchParams.get('artist') || '').trim().slice(0, 160), album = (u.searchParams.get('album') || '').trim().slice(0, 160);
  if (!artist || !album) return Response.json({});
  try {
    const query = new URL('https://itunes.apple.com/search');
    query.searchParams.set('term', artist + ' ' + album); query.searchParams.set('entity', 'album'); query.searchParams.set('country', 'IT'); query.searchParams.set('limit', '30');
    const r = await fetch(query.toString(), {signal: AbortSignal.timeout(5000)}); if (!r.ok) throw Error('lookup failed');
    const j = await r.json() as {results?: Array<{artistName?: string; collectionName?: string; collectionViewUrl?: string}>};
    const item = j.results?.find(x => normalize(x.artistName || '') === normalize(artist) && normalize(x.collectionName || '') === normalize(album));
    const link = item?.collectionViewUrl || '';
    if (!/^https:\/\/(music|itunes)\.apple\.com\//.test(link)) return Response.json({});
    return Response.json({apple: link}, {headers: {'Cache-Control': 'public, max-age=86400'}});
  } catch { return Response.json({}); }
}
