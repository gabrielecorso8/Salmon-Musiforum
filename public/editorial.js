// Shared editorial data, cover uploads and timed-text imports.
let pageCopy = {};
let publishedArchive = [];
let archiveEdits = {}, archiveEditRevision = null;
async function loadArchiveEdits(){const r=await fetch("/api/archive",{cache:"no-store"});if(!r.ok)throw Error("Archivio non disponibile");const x=await r.json();archiveEdits=x.data||{};archiveEditRevision=x.updatedAt||null}
function archiveEditKey(a){return a._archiveKey||(a.n<=103?"catalog:"+a.n:"album:"+albumIdentity(a.artist,a.title)+":"+(a.eventDate||a.date||""))}
let catalog = [];
let catalogRequest;

function loadCatalog() {
  if (!catalogRequest) {
    catalogRequest = Promise.all([fetch('/history-data.json'),fetch('/streaming-verified.json').then(r=>r.ok?r.json():{}).catch(()=>({}))]).then(async ([response,links]) => {
      if (!response.ok) throw Error('Archivio non disponibile');
      const items=await response.json();return catalog=items.map(a=>({...a,...(links[a.n]||{})}));
    }).catch(error => {
      catalogRequest = null;
      throw error;
    });
  }
  return catalogRequest;
}

function italyToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
}

function albumIdentity(artist, album) {
  return [artist, album].map(value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()).join('|');
}

function eventCover(event) {
  const key = albumIdentity(event.artist, event.album);
  const fromCatalog = catalog.find(album => albumIdentity(album.artist, album.title) === key);
  const currentCover = key === albumIdentity(data.artist, data.title) ? data.imageUrl : '';
  return imageLink(event.imageUrl) || imageLink(fromCatalog?.image) || imageLink(currentCover);
}

function rebuildHistory() {
  historyAlbums = catalog.map(album => ({ ...album }));
  const allEvents = [...publishedArchive, ...events];
  for (const [i, event] of allEvents.entries()) {
    if (!event.artist || !event.album) continue;
    const key = albumIdentity(event.artist, event.album);
    const match = historyAlbums.find(album =>
      albumIdentity(album.artist, album.title) === key &&
      (!album.eventDate || !event.date || album.eventDate === event.date));
    const details = {
      series: event.series || match?.series,
      date: event.date || match?.date,
      eventDate: event.date || match?.eventDate,
      archivedAt: event.archivedAt || match?.archivedAt,
      archived: Boolean(event.archived || match?.archived),
      place: event.place || match?.place,
      detail: event.detail || match?.detail,
      url: event.url || match?.url, spotifyUrl:event.spotifyUrl || match?.spotifyUrl, appleUrl:event.appleUrl || match?.appleUrl, soundcloudUrl:event.soundcloudUrl || match?.soundcloudUrl,
      image: event.imageUrl || match?.image || eventCover(event),
      year: event.year || match?.year,
    };
    if (match) Object.assign(match, details);
    else historyAlbums.push({
      n: 1000 + i, artist: event.artist, title: event.album,
      note: '', ...details,
    });
  }
  for(const album of historyAlbums){album._archiveKey=archiveEditKey(album);const edit=archiveEdits[album._archiveKey];if(edit)Object.assign(album,edit)}
}

function archiveStatus(album) {
  if (album.archived || (album.date && album.date < italyToday())) return 'past';
  if (album.date) return 'future';
  if (album.n <= 95) return 'past';
  return 'undated';
}

const copyDefaults = new Map();
const dynamicCopy = {
  'hero.action': ['Scopri {album}', 'Home · pulsante album'],
  'events.empty': ['Nessun appuntamento in programma.', 'Calendario · lista vuota'],
  'events.booking': ['Dettagli e prenotazione', 'Calendario · prenotazione'],
  'events.reader': ['Articolo e testi', 'Calendario · articolo'],
  'events.archive': ['Esplora l’archivio dei MusiForum', 'Calendario · pulsante archivio'],
  'events.free': ['Gratis', 'Calendario · ingresso gratuito'],
  'events.subscribers': ['solo per abbonati', 'Calendario · accesso abbonati'],
  'events.price': ['Ingresso', 'Calendario · prezzo'],
  'archive.one': ['{count} disco', 'Archivio · conteggio singolare'],
  'archive.many': ['{count} dischi', 'Archivio · conteggio plurale'],
  'archive.error': ['Non riusciamo a caricare l’archivio. Riprova tra poco.', 'Archivio · errore'],
  'archive.detail': ['MUSIFORUM / ARCHIVIO', 'Archivio · scheda disco'],
  'reader.timed': ['Tempi importati', 'Lettore · sincronizzazione importata'],
  'reader.estimate': ['Scorrimento stimato', 'Lettore · scorrimento stimato'],
  'archive.empty': ['Nessun disco trovato. Prova un altro titolo o artista.', 'Archivio · lista vuota'],
  'archive.special': ['Eventi speciali e altre serate', 'Archivio · eventi singoli'],
  'reader.follow': ['Segui l’ascolto', 'Lettore · segui'],
  'reader.resume': ['Torna all’ascolto', 'Lettore · riprendi'],
  'reader.idle': ['In attesa dell’ascolto', 'Lettore · in attesa'],
  'reader.live': ['In ascolto: {track}', 'Lettore · brano in ascolto'],
  'reader.offline': ['Connessione alla diretta non disponibile', 'Lettore · errore connessione'],
  'reader.inactive': ['Nessuna diretta attiva', 'Lettore · diretta inattiva'],
  'reader.track': ['TRACCIA {number}', 'Lettore · etichetta traccia'],
  'reader.empty': ['Nessun contenuto inserito.', 'Lettore · testo assente'],
  'reader.articleTitle': ['La storia del disco', 'Lettore · titolo articolo predefinito'],
  'reader.articleEmpty': ['Articolo da preparare.', 'Lettore · articolo assente'],
};
for (const [key, [value, label]] of Object.entries(dynamicCopy)) copyDefaults.set(key, { value, label });

function collectCopyDefaults() {
  document.querySelectorAll('[data-page-copy]').forEach(element => {
    const key = element.dataset.pageCopy;
    const fragment = element.cloneNode(true);
    fragment.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    const value = (element.dataset.copyAttribute
      ? element.getAttribute(element.dataset.copyAttribute)
      : fragment.textContent).trim();
    copyDefaults.set(key, { value, label: element.dataset.copyLabel || key });
  });
}

function copyText(key, values = {}) {
  let result = typeof pageCopy[key] === 'string' ? pageCopy[key] : copyDefaults.get(key)?.value || '';
  for (const [name, value] of Object.entries(values)) result = result.replaceAll('{' + name + '}', value);
  return result;
}

function applyPageCopy() {
  for (const element of document.querySelectorAll('[data-page-copy]')) {
    const value = copyText(element.dataset.pageCopy);
    if (element.dataset.copyAttribute) element.setAttribute(element.dataset.copyAttribute, value);
    else element.textContent = value;
  }
}

function installCopyPanel() {
  const tabs = document.querySelector('.admin-tabs');
  tabs.insertAdjacentHTML('beforeend', '<button onclick="adminTab(&quot;copy&quot;)">Copy pagina</button>');
  const groupNames = { nav: 'Navigazione', hero: 'Home', album: 'Album', events: 'Calendario',
    story: 'Storia', subscribe: 'Abbonamento', footer: 'Footer', archive: 'Archivio', reader: 'Lettore' };
  const sections = Object.entries(groupNames).map(([prefix, name]) => {
    const fields = [...copyDefaults.entries()].filter(([key]) => key.startsWith(prefix + '.'));
    return '<details class="admin-track"><summary>' + name + '</summary><div class="editor">' +
      fields.map(([key, field]) => '<label class="field full">' + ehtml(field.label) +
        '<textarea rows="2" data-copy-field="' + ehtml(key) + '">' + ehtml(copyText(key)) +
        '</textarea></label>').join('') + '</div></details>';
  });
  document.querySelector('#admin-album').insertAdjacentHTML('beforebegin',
    '<section id="admin-copy" class="admin-panel hidden"><h3>Testi del sito</h3>' +
    '<p class="muted">Modifica titoli, descrizioni, pulsanti e messaggi della pagina. ' +
    'Conserva i segnaposto come {album}, {track} e {number} dove vuoi mostrare il valore corrente.</p>' +
    sections.join('') + '</section>');
}

async function imageFile(file) {
  if (!file || !file.type.startsWith('image/')) throw Error('Scegli un file immagine.');
  if (file.size > 20_000_000) throw Error('Scegli un’immagine inferiore a 20 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    context.fillStyle = '#f3efe7';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(Error('Impossibile convertire l’immagine.')), 'image/jpeg', .82));
  } finally {
    bitmap.close();
  }
}

function imageDropzone(selector, label) {
  return '<div class="upload-zone field full" data-upload-target="' + historyEsc(selector) +
    '" ondragover="event.preventDefault();this.classList.add(&quot;drag-over&quot;)" ' +
    'ondragleave="this.classList.remove(&quot;drag-over&quot;)" ondrop="dropImage(event,this)">' +
    '<label>' + historyEsc(label) + '<input type="file" accept="image/*" onchange="chooseImage(this)"></label>' +
    '<small>Trascina un’immagine qui o sceglila dal dispositivo</small><output aria-live="polite"></output></div>';
}

function dropImage(event, zone) {
  event.preventDefault();
  zone.classList.remove('drag-over');
  uploadCover(zone, event.dataTransfer.files[0]);
}

function chooseImage(input) {
  uploadCover(input.closest('.upload-zone'), input.files[0]);
  input.value = '';
}

async function uploadCover(zone, file) {
  if (!file) return;
  const output = zone.querySelector('output');
  const target = document.querySelector(zone.dataset.uploadTarget);
  if (!target) return;
  if (zone.dataset.busy) return;
  zone.dataset.busy = 'true';
  output.textContent = 'Caricamento…';
  try {
    const blob = await imageFile(file);
    const response = await fetch('/api/media', {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob,
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Caricamento non riuscito.');
    if (!target.isConnected) return;
    target.value = result.url;
    captureFields();
    zone.querySelector('img')?.remove();
    const preview = document.createElement('img');
    preview.src = result.url;
    preview.alt = 'Anteprima caricata';
    zone.append(preview);
    output.textContent = 'Caricata. Salva la bozza o pubblica per usare questa immagine.';
  } catch (error) {
    output.textContent = error.message || 'Caricamento non riuscito.';
  } finally {
    delete zone.dataset.busy;
  }
}

function parseTimedText(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows = [];
  const offset = Number(text.match(/^\[offset:\s*([+-]?\d+)\]/im)?.[1] || 0) / 1000;
  for (const line of text.split('\n')) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const words = line.slice(stamps.at(-1).index + stamps.at(-1)[0].length)
      .replace(/<\d+:\d+(?:[.:]\d+)?>/g, '').trim();
    if (!words) continue;
    for (const stamp of stamps) {
      rows.push({ time: Math.max(0, Number(stamp[1]) * 60 + Number(stamp[2].replace(':', '.')) + offset), text: words });
    }
  }
  if (rows.length) return rows.sort((a, b) => a.time - b.time);
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const index = lines.findIndex(line => line.includes('-->'));
    if (index < 0) continue;
    const start = lines[index].trim().split(/\s+/, 1)[0].replace(',', '.');
    if (!/^(?:\d{1,3}:)?\d{2}:\d{2}\.\d{1,3}$/.test(start)) continue;
    const seconds = start.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
    const words = lines.slice(index + 1).join('\n').replace(/<\/?[a-z][^>]*>/gi, '').trim();
    if (words) rows.push({ time: seconds, text: words });
  }
  return rows.sort((a, b) => a.time - b.time);
}

async function importTrackText(input, index, kind) {
  const output = input.parentElement.querySelector('output');
  const file = input.files[0];
  if (!file) return;
  if (file.size > 150_000) { output.textContent = 'File troppo grande.'; return; }
  const raw = await file.text();
  if (!input.isConnected) return;
  const timed = parseTimedText(raw);
  if (!timed.length && !/\.txt$/i.test(file.name)) {
    output.textContent = 'Nessun tempo riconosciuto. Usa LRC, SRT, VTT o TXT.';
    input.value = '';
    return;
  }
  const target = document.querySelector('[data-track="' + index + '"][data-field="' + kind + '"]');
  target.value = timed.length ? timed.map(row => row.text).join('\n\n') : raw.trim();
  captureFields();
  data.tracks[index][kind === 'original' ? 'timingOriginal' : 'timingTranslation'] =
    timed.map(row => row.time);
  output.textContent = timed.length ? timed.length + ' blocchi temporizzati importati.' : 'Testo importato.';
  input.value = '';
}

function usePlainTiming(index, kind, button) {
  delete data.tracks[index][kind === 'original' ? 'timingOriginal' : 'timingTranslation'];
  button.parentElement.querySelector('output').textContent = 'Scorrimento stimato attivo.';
}

function timingImport(index, kind, label) {
  const key = kind === 'original' ? 'timingOriginal' : 'timingTranslation';
  const count = data.tracks[index]?.[key]?.length || 0;
  return '<div class="upload-zone field"><label>' + label +
    '<input type="file" accept=".lrc,.srt,.vtt,.txt" onchange="importTrackText(this,' + index +
    ',&quot;' + kind + '&quot;)"></label><button class="textlink" type="button" onclick="usePlainTiming(' +
    index + ',&quot;' + kind + '&quot;,this)">Usa la durata del brano</button>' +
    '<output aria-live="polite">' + (count ? count + ' blocchi temporizzati' : '') + '</output></div>';
}

function seriesKey(value){return String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('it')}
function allSeries(){const map=new Map();function add(v){v=String(v||'').trim().replace(/\s+/g,' ');if(v&&!map.has(seriesKey(v)))map.set(seriesKey(v),v)}for(const a of catalog){const m=String(a.note||'').match(/(?:La|L['’])\s*([^:]*?miniserie)\s*:\s*([^,(]+)/i);if(m)add((m[1]+': '+m[2]).trim());add(a.series)}for(const e of events)add(e.series);add(data.series);for(const v of workspace.series||[])add(v);for(const draft of Object.values(workspace.drafts||{})){add(draft.album?.series);for(const e of draft.events||[])add(e.series)}return [...map.values()].filter(n=>!(workspace.closedSeries||[]).includes(seriesKey(n))).sort((a,b)=>a.localeCompare(b,'it'))}
function seriesSelect(attrs,current){const names=allSeries();if(current&&!names.some(n=>seriesKey(n)===seriesKey(current)))names.push(current);const selected=names.find(n=>seriesKey(n)===seriesKey(current))||'';return '<label class="field full">Miniserie<select class="series-select" '+attrs+' onchange="chooseSeries(this)"><option value="">Nessuna miniserie</option>'+names.map(n=>'<option value="'+ehtml(n)+'" '+(n===selected?'selected':'')+'>'+ehtml(n)+'</option>').join('')+'<option value="__new__">+ Crea una miniserie</option></select></label>'}
function refreshSeriesChoices(){for(const select of document.querySelectorAll('.series-select')){const prev=select.value;let names=allSeries();if(prev&&prev!=='__new__'&&!names.some(n=>seriesKey(n)===seriesKey(prev)))names.push(prev);select.innerHTML='<option value="">Nessuna miniserie</option>'+names.map(n=>'<option value="'+ehtml(n)+'">'+ehtml(n)+'</option>').join('')+'<option value="__new__">+ Crea una miniserie</option>';select.value=names.find(n=>seriesKey(n)===seriesKey(prev))||''}}
function chooseSeries(select){if(select.value!=='__new__'){select.dataset.lastValue=select.value;return}let value=prompt('Nome della nuova miniserie:');if(!value||!value.trim()){select.value=select.dataset.lastValue||'';return}value=value.trim().replace(/\s+/g,' ');const existing=allSeries().find(n=>seriesKey(n)===seriesKey(value));value=existing||value;if(!existing){workspace.series=Array.isArray(workspace.series)?workspace.series:[];workspace.series.push(value)}const option=document.createElement('option');option.value=value;option.textContent=value;select.add(option,select.options[select.options.length-1]);select.value=value;select.dataset.lastValue=value;refreshSeriesChoices();select.value=value;scheduleDraftSave()}
