let historyAlbums = [];
let historySort = 'desc';
let historyScope = 'past';
let historyDisplay = 'chronological';
const historyEsc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

async function openHistory() {
  await show('archive');
  const root = document.getElementById('history-grid');
  try {
    await Promise.all([loadCatalog(), loadArchiveEdits()]);
    rebuildHistory();
    renderHistory();
  } catch {
    root.textContent = copyText('archive.error');
  }
}

function filteredHistory() {
  const query = document.getElementById('history-search').value.trim().toLocaleLowerCase('it');
  const found = historyAlbums.filter(album =>
    archiveStatus(album) === 'past' && !(album.date && album.date >= italyToday()) && !(album.n >= 96 && album.n <= 103 && !album.date) && albumIdentity(album.artist, album.title) !== albumIdentity(data.artist, data.title) &&
    [album.artist, album.title, album.year, album.note, album.place].some(value =>
      String(value || '').toLocaleLowerCase('it').includes(query)));
  const direction = historySort === 'desc' ? -1 : 1;
  return found.sort((a, b) => {
    const dateA = a.date || a.archivedAt || '';
    const dateB = b.date || b.archivedAt || '';
    return direction * (dateA.localeCompare(dateB) || a.n - b.n);
  });
}

function seriesName(album) {
  if (album.series?.trim()) return album.series.trim();
  const match = String(album.note || '').match(/(?:La|L['’])\s*([^:]*?miniserie)\s*:\s*([^,(]+)/i);
  return match ? (match[1] + ': ' + match[2]).trim() : copyText('archive.special');
}

function historyLabel(value) { return String(value || '').replace(/\]\(https?:\/\/[^)]+\)/g, '').replace(/^\[/, ''); }

function historyCard(album) {
  const image = imageLink(album.image);
  const date = album.date ? new Date(album.date + 'T12:00:00').toLocaleDateString('it-IT') : '';
  return '<button class="history-card" onclick="showHistoryDetail(' + Number(album.n) + ')">' +
    '<span class="history-art"><span class="history-fallback" aria-hidden="true">' +
    historyEsc(album.artist.slice(0, 1)) + '</span>' +
    (image ? '<img src="' + historyEsc(image) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
    (album.n <= 103 ? '<span class="history-number">N. ' + String(album.n).padStart(2, '0') + '</span>' : '') +
    '</span><span class="history-artist">' + historyEsc(historyLabel(album.artist)) + '</span><strong>' +
    historyEsc(album.title) + '</strong><span class="history-year">' + historyEsc(album.year) +
    (date ? ' · ' + historyEsc(date) : '') + '</span></button>';
}

function renderHistory() {
  const items = filteredHistory();
  const root = document.getElementById('history-grid');
  root.classList.toggle('grouped-history', historyDisplay === 'series');
  document.getElementById('history-count').textContent =
    copyText(items.length === 1 ? 'archive.one' : 'archive.many', { count: items.length });
  if (historyDisplay === 'chronological') {
    root.innerHTML = items.map(historyCard).join('') || '<p class="history-empty">' + historyEsc(copyText('archive.empty')) + '</p>';
    return;
  }
  const groups = new Map();
  for (const item of items) {
    const name = seriesName(item);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }
  const searching = Boolean(document.getElementById('history-search').value.trim());
  root.innerHTML = [...groups].map(([name, albums], index) =>
    '<details class="series-group" ' + (index === 0 || searching ? 'open' : '') +
    '><summary><span>' + historyEsc(name) + '</span><small>' +
    historyEsc(copyText(albums.length === 1 ? 'archive.one' : 'archive.many', { count: albums.length })) +
    '</small></summary><div class="series-grid">' + albums.map(historyCard).join('') + '</div></details>'
  ).join('') || '<p class="history-empty">' + historyEsc(copyText('archive.empty')) + '</p>';
}

function historySearch() { renderHistory(); }
function historyView(value) { historyDisplay = value; renderHistory(); }
function historyOrder(value) { historySort = value; renderHistory(); }
function historyFilter(value) { historyScope = value; renderHistory(); }

function showHistoryDetail(n) {
  const album = historyAlbums.find(item => item.n === n);
  if (!album) return;
  const dialog = document.getElementById('history-dialog');
  const image = imageLink(album.image);
  const current = albumIdentity(album.artist, album.title) === albumIdentity(data.artist, data.title);
  const date = album.date ? new Date(album.date + 'T12:00:00').toLocaleDateString('it-IT') : '';
  const details = [date, album.place, album.detail, album.note].filter(Boolean);
  document.getElementById('history-detail').innerHTML =
    '<div class="history-detail-art">' +
    (image ? '<img src="' + historyEsc(image) + '" alt="Copertina di ' + historyEsc(album.title) + '">' :
      '<span>' + historyEsc(album.artist.slice(0, 1)) + '</span>') +
    '</div><div class="history-detail-body"><div class="micro">' + historyEsc(copyText('archive.detail')) +
    '</div><h2>' + historyEsc(album.title) + '</h2><p class="history-detail-artist">' +
    historyEsc(historyLabel(album.artist)) + (album.year ? ' · ' + historyEsc(album.year) : '') + '</p>' +
    (details.length ? '<p class="history-note">' + details.map(historyEsc).join('<br>') + '</p>' : '') +
    '<div class="archive-platforms"><div class="micro">ASCOLTA IL DISCO</div><div class="platform-links" id="archive-platform-links"></div></div>' +
    (current ? '<button class="pill dark" onclick="document.getElementById(&quot;history-dialog&quot;).close();show(&quot;reader&quot;)">' +
      historyEsc(copyText('events.reader')) + '</button>' : '') + '</div>';
  dialog.showModal();
  const destination = document.getElementById('archive-platform-links');
  const identity = albumIdentity(album.artist, album.title);
  const links = {spotify: album.spotifyUrl, apple: album.appleUrl, soundcloud: album.soundcloudUrl};
  if (identity === albumIdentity('Little Simz', 'Lotus')) Object.assign(links, {
    spotify: links.spotify || 'https://open.spotify.com/album/0ofdTvYtx4LpsVjemJt71X',
    apple: links.apple || 'https://music.apple.com/us/album/lotus/1794880972',
    soundcloud: links.soundcloud || 'https://soundcloud.com/littlesimz/sets/lotus-392626479'
  });
  const draw = () => {
    if (!destination.isConnected) return;
    const labels = {spotify:'Spotify',apple:'Apple Music',soundcloud:'SoundCloud'};
    const allowed = {spotify:['open.spotify.com'],apple:['music.apple.com','itunes.apple.com'],soundcloud:['soundcloud.com','www.soundcloud.com']};
    const normal = Object.entries(links).filter(([k,v]) => {
      try { const u=new URL(v); return u.protocol==='https:' && allowed[k].includes(u.hostname); } catch { return false; }
    }).map(([k,v])=>'<a href="'+historyEsc(v)+'" target="_blank" rel="noopener">'+labels[k]+'</a>');
    const extra = (Array.isArray(album.extraLinks)?album.extraLinks:[]).filter(item=>{
      try{const u=new URL(item.url);return u.protocol==='https:'&&(['open.spotify.com','music.apple.com','www.qobuz.com','qobuz.com'].includes(u.hostname)||u.hostname.endsWith('.bandcamp.com'))}catch{return false}
    }).map(item=>'<a href="'+historyEsc(item.url)+'" target="_blank" rel="noopener">'+historyEsc(item.label)+'</a>');
    destination.innerHTML = [...normal,...extra].join('') || '<span class="muted">'+historyEsc(album.unavailableNote||'Nessun collegamento disponibile.')+'</span>';
  };
  draw();
  if (!links.apple) fetch('/api/album-links?artist='+encodeURIComponent(historyLabel(album.artist))+'&album='+encodeURIComponent(album.title)).then(r=>r.ok?r.json():{}).then(result=>{if(result.apple){links.apple=result.apple;draw()}}).catch(()=>{});
}
