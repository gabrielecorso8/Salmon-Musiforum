// Editorial drafts and event materials are separate from the public current album.
let workspace={draft:null,library:[]}, workRevision=null, archiveLibrary=[];
const albumKey=()=>`${data.artist} — ${data.title}`;
const workspaceBase=renderWorkspace;
renderWorkspace=function(){workspaceBase();document.getElementById('album-fields').insertAdjacentHTML('beforeend',seriesSelect('data-key="series"',data.series));installCopyPanel();const tabs=document.querySelector('.admin-tabs');tabs.insertAdjacentHTML('afterbegin','<button onclick="adminTab(\'library\');renderLibrary()">Libreria</button><button onclick="adminTab(\'archiveadmin\');renderArchiveAdmin()">Archivio</button><button onclick="adminTab(\'seriesadmin\');renderSeriesAdmin()">Miniserie</button>');document.querySelector('#admin-album').insertAdjacentHTML('beforebegin','<div id="admin-library" class="admin-panel hidden"></div><div id="admin-archiveadmin" class="admin-panel hidden"></div><div id="admin-seriesadmin" class="admin-panel hidden"></div>');document.querySelector('.admin-header p').textContent='Prepara una bozza, poi pubblicala quando è pronta.';document.querySelectorAll('.admin-header button,.admin-savebar button').forEach(b=>{b.textContent='Pubblica sul sito';b.onclick=publishContent});document.querySelector('.admin-savebar').insertAdjacentHTML('beforeend','<button class="pill" onclick="saveDraft()">Salva bozza</button><button class="pill" onclick="previewDraft()">Anteprima</button>');document.querySelector('#workspace-tracks').insertAdjacentHTML('beforebegin','<button class="pill" type="button" onclick="importTracklist()">Importa scaletta e durate</button><p class="muted">Usa una scaletta preparata o cerca l’album su Apple Music. Verifica che sia la stessa edizione riprodotta.</p>');document.querySelector('#admin-album > p').insertAdjacentHTML('afterend','<p class="muted">Importa un file LRC, SRT, VTT o TXT per preparare i testi e le traduzioni.</p>');loadWorkspace()};
let workspaceLoaded=false,activeDraftId=null,saveTimer=null,saveInFlight=null,saveAgain=false;
function restoreDamagedLotus(album){
 if(!album||String(album.title).toLowerCase()!=='lotus'||String(album.artist).toLowerCase()!=='little simz')return album;
 const tracks=album.tracks||[];const damaged=!album.article&&!album.articleTitle&&!album.description&&tracks.length===1&&!tracks[0]?.original&&!tracks[0]?.translation;
 return damaged?{...album,...structuredClone(window.LOTUS_DATA),editionId:album.editionId||'lotus-restored',recoveredFromOriginal:true}:album;
}
function draftSnapshot(){captureFields();return {album:structuredClone(data),events:structuredClone(events),blocks:structuredClone(blocks),copy:structuredClone(pageCopy),updatedAt:new Date().toISOString()}}
function draftId(){return data.editionId||'album:'+albumIdentity(data.artist,data.title)}
function showDraftList(){const target=document.getElementById('draft-list');if(!target)return;let list=Object.entries(workspace.drafts||{}).sort((a,b)=>String(b[1].updatedAt||'').localeCompare(String(a[1].updatedAt||'')));target.innerHTML=list.length?list.map(([id,d])=>'<div class="library-item"><div><strong>'+ehtml(d.album?.artist||'Artista')+' · '+ehtml(d.album?.title||'Album')+'</strong><small>Bozza salvata · '+ehtml(d.updatedAt?new Date(d.updatedAt).toLocaleString('it-IT'):'')+'</small></div><button class="pill" onclick="restoreDraft('+JSON.stringify(id).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+')">Apri bozza</button><button class="pill" onclick="activateDraft('+JSON.stringify(id).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+')">Pubblica come prossimo</button><button class="textlink" onclick="deleteDraft('+JSON.stringify(id).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+')">Elimina</button></div>').join(''):'<p class="muted">Ancora nessuna bozza salvata.</p>'}
async function loadWorkspace(){if(workspaceLoaded){showDraftList();return}try{let [r,h]=await Promise.all([fetch('/api/workspace',{cache:'no-store'}),fetch('/history-data.json')]);if(!r.ok)throw Error();let result=await r.json();workRevision=result.updatedAt;workspace=result.data||{draft:null,library:[]};workspace.library=Array.isArray(workspace.library)?workspace.library:[];workspace.drafts=workspace.drafts&&typeof workspace.drafts==='object'?workspace.drafts:{};if(workspace.draft?.album){const d=workspace.draft;const key=d.album.editionId||'legacy:'+albumIdentity(d.album.artist,d.album.title);if(!workspace.drafts[key])workspace.drafts[key]=d;delete workspace.draft}archiveLibrary=h.ok?await h.json():[];workspaceLoaded=true;activeDraftId=draftId();await prepareFutureDrafts();refreshSeriesChoices();showDraftList();if(data.recoveredFromOriginal)(document.getElementById('admin-message').textContent='Lotus è stato ricostruito dalla copia originale disponibile; controlla i contenuti e pubblica per confermare.',scheduleDraftSave())}catch{document.getElementById('admin-message').textContent='Impossibile caricare le bozze: le modifiche non vengono salvate. Ricarica e riprova.'}}
async function prepareFutureDrafts(){
 try{const r=await fetch('/api/prepared-tracks',{cache:'no-store'});if(!r.ok)return;const prepared=await r.json();let added=false;
 for(const [key,tracks] of Object.entries(prepared)){const [artist,title]=key.split('|');const identity=albumIdentity(artist,title);const item=archiveLibrary.find(a=>a.n>=97&&a.n<=103&&albumIdentity(a.artist,a.title)===identity);if(!item||(workspace.hiddenLibrary||[]).includes(String(item.n))||(workspace.removedPreparedDrafts||[]).includes(identity)||Object.values(workspace.drafts||{}).some(d=>albumIdentity(d.album?.artist,d.album?.title)===identity))continue;
 const id='prepared:'+item.n;workspace.drafts[id]={album:{title,artist,year:String(item.year||''),editionId:id,description:'',articleTitle:'',article:'',imageUrl:item.image||'',tracks:tracks.map(t=>({...t,durationVerified:true,original:'',translation:'',notes:''}))},events:structuredClone(events),blocks:[],copy:structuredClone(pageCopy),updatedAt:new Date().toISOString()};added=true;
 }
 if(added)await persistWorkspace();
 }catch(e){const msg=document.getElementById('admin-message');if(msg)msg.textContent='Alcune scalette non sono state preparate: '+e.message}
}
async function persistWorkspace(){const r=await fetch('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:workspace,revision:workRevision})});const j=await r.json();if(!r.ok)throw Error(j.error||'Salvataggio non riuscito');workRevision=j.updatedAt}
async function saveDraft(){
 if(!workspaceLoaded){document.getElementById('save-status').textContent='Attendi il caricamento delle bozze.';return false}
 if(saveInFlight){saveAgain=true;try{await saveInFlight}catch{return false}return saveAgain?saveDraft():true}
 clearTimeout(saveTimer);let snap=draftSnapshot(), id=activeDraftId||draftId(); workspace.drafts[id]=snap;
 const status=document.getElementById('save-status');if(status)status.textContent='Salvataggio bozza…';
 saveAgain=false;saveInFlight=persistWorkspace();try{await saveInFlight;if(status)status.textContent='Bozza salvata · non pubblicata';showDraftList()}catch(e){if(status)status.textContent='Bozza non salvata: '+e.message;saveAgain=false;return false}finally{saveInFlight=null}
 if(saveAgain)return saveDraft();return true;
}
function scheduleDraftSave(){if(!workspaceLoaded||!document.getElementById('admin')?.classList.contains('active'))return;clearTimeout(saveTimer);const status=document.getElementById('save-status');if(status)status.textContent='Modifiche da salvare…';saveTimer=setTimeout(()=>saveDraft(),1200)}
async function restoreDraft(id){if(!workspace.drafts?.[id])return;if(!await saveDraft())return;const d=workspace.drafts[id];data=structuredClone(d.album);events=structuredClone(d.events);blocks=structuredClone(d.blocks);pageCopy=structuredClone(d.copy||pageCopy);activeDraftId=id;renderWorkspace()}
function previewDraft(){captureFields();refreshPage();originalShow('reader');let notice=document.createElement('div');notice.className='draft-preview';notice.innerHTML='Anteprima della bozza <button class="pill" onclick="location.reload()">Esci dall’anteprima</button>';document.querySelector('header').after(notice)}
function libraryAvailableAlbums(catalog,space){
 const draftKeys=new Set(Object.values(space.drafts||{}).map(d=>albumIdentity(d.album?.artist,d.album?.title)));
 const seen=new Set();return [...catalog.filter(x=>x.n>=96&&!(space.hiddenLibrary||[]).includes(String(x.n))).map(x=>({artist:x.artist,title:x.title,year:x.year,image:x.image,n:x.n})),...(space.library||[])].filter(a=>{const key=albumIdentity(a.artist,a.title);if(draftKeys.has(key)||seen.has(key))return false;seen.add(key);return true});
}
function renderLibrary(){const root=document.getElementById('admin-library');if(!root)return;let candidates=libraryAvailableAlbums(archiveLibrary,workspace);root.innerHTML='<h3>Bozze salvate</h3><p class="muted">Ogni album resta separato e privato finché non lo pubblichi.</p><div id="draft-list"></div><h3>Libreria album</h3><p class="muted">Scegli un disco già previsto per creare un evento oppure aggiungi un album. Le modifiche sono in bozza finché non pubblichi.</p><div class="library-list">'+candidates.map((a,i)=>'<div class="library-item"><div><strong>'+ehtml(a.artist)+' · '+ehtml(a.title)+'</strong><small>'+ehtml(a.year||'')+'</small></div><button class="pill" onclick="eventFromLibrary('+i+')">Crea evento</button><button class="textlink" onclick="albumFromLibrary('+i+')">Prepara album</button><button class="textlink" onclick="deleteLibraryAlbum('+i+')">Rimuovi</button></div>').join('')+'</div><h3>Aggiungi un album</h3><div class="editor"><label class="field">Artista<input id="lib-artist"></label><label class="field">Album<input id="lib-title"></label><label class="field">Anno<input id="lib-year"></label><label class="field full">Copertina: URL<input id="lib-image" type="url"></label></div>'+imageDropzone('#lib-image','Carica copertina album')+'<button class="pill dark" onclick="addLibraryAlbum()">Aggiungi alla libreria</button>';window.libraryChoices=candidates;showDraftList()}
async function addLibraryAlbum(){let a={artist:document.getElementById('lib-artist').value.trim(),title:document.getElementById('lib-title').value.trim(),year:document.getElementById('lib-year').value.trim(),image:document.getElementById('lib-image').value.trim()};if(!a.artist||!a.title){alert('Inserisci artista e titolo.');return}if(a.image&&!imageLink(a.image)){alert('Copertina non valida.');return}const key=albumIdentity(a.artist,a.title);if(Object.values(workspace.drafts||{}).some(d=>albumIdentity(d.album?.artist,d.album?.title)===key)||[...archiveLibrary.filter(x=>x.n>=96&&!(workspace.hiddenLibrary||[]).includes(String(x.n))),...workspace.library].some(x=>albumIdentity(x.artist,x.title)===key)){alert('Questo album è già presente nella libreria o tra le bozze.');return}workspace.library.push(a);try{await persistWorkspace();renderLibrary()}catch(e){workspace.library.pop();alert(e.message)}}
function eventFromLibrary(i){captureFields();let a=libraryChoices[i];events.push({date:'',place:'',artist:a.artist,album:a.title,year:a.year||'',url:'',detail:'',imageUrl:a.image||''});adminTab('events');renderEventEditor();document.querySelector('#workspace-events details:last-child').open=true;document.querySelector('#workspace-events details:last-child').scrollIntoView({behavior:'smooth'})}
async function albumFromLibrary(i){if(!workspaceLoaded){alert('Attendi il caricamento delle bozze.');return}let a=libraryChoices[i];if(!a)return;if(!await saveDraft())return;const existing=Object.entries(workspace.drafts||{}).find(([,d])=>albumIdentity(d.album?.artist,d.album?.title)===albumIdentity(a.artist,a.title));if(existing){alert('Esiste già una bozza per questo album.');renderLibrary();return}data={title:a.title,artist:a.artist,year:a.year,editionId:crypto.randomUUID(),description:'',articleTitle:'',article:'',imageUrl:a.image||'',tracks:[{title:'Nuova traccia',duration:180,original:'',translation:'',notes:'',syncOriginal:'',syncTranslation:''}]};blocks=[];activeDraftId=data.editionId;renderWorkspace();await saveDraft()}

async function deleteDraft(id){
 if(!workspace.drafts?.[id]||!confirm('Eliminare definitivamente questa bozza? Il contenuto pubblicato non verrà modificato.'))return;
 clearTimeout(saveTimer);if(saveInFlight){try{await saveInFlight}catch{alert('Attendi il salvataggio e riprova.');return}}
 const previous=workspace.drafts[id],oldRemoved=[...(workspace.removedPreparedDrafts||[])];const key=albumIdentity(previous.album?.artist,previous.album?.title);workspace.removedPreparedDrafts=[...new Set([...oldRemoved,key])];delete workspace.drafts[id];
 try{await persistWorkspace();if(id===activeDraftId){alert('Bozza eliminata. Verrà ricaricato il contenuto pubblicato.');location.reload()}else renderLibrary()}catch(e){workspace.drafts[id]=previous;workspace.removedPreparedDrafts=oldRemoved;alert(e.message)}
}
async function deleteLibraryAlbum(i){
 const a=libraryChoices[i];if(!a||!confirm('Rimuovere '+a.artist+' · '+a.title+' dalla libreria? Gli eventi e le bozze esistenti non verranno eliminati.'))return;
 if(!await saveDraft())return;
 const oldLibrary=workspace.library.slice(),oldHidden=[...(workspace.hiddenLibrary||[])];
 if(a.n!=null){workspace.hiddenLibrary=[...oldHidden,String(a.n)]}else{const index=workspace.library.indexOf(a);if(index<0)return;workspace.library.splice(index,1)}
 try{await persistWorkspace();renderLibrary()}catch(e){workspace.library=oldLibrary;workspace.hiddenLibrary=oldHidden;alert(e.message)}
}
async function activateDraft(id){
 const d=workspace.drafts?.[id];if(!d?.album?.artist||!d.album.title){alert('Completa artista e titolo della bozza.');return}
 if(!confirm('Pubblicare '+d.album.artist+' · '+d.album.title+' come MusiForum principale? L’album attuale verrà archiviato automaticamente.'))return;
 if(!await saveDraft())return;
 const selected=workspace.drafts[id];if(!selected)return;
 data=structuredClone(selected.album);blocks=structuredClone(selected.blocks||[]);activeDraftId=id;
 renderWorkspace();await publishContent();
}
async function importTracklist(){
 captureFields();if(!data.artist?.trim()||!data.title?.trim()){alert('Inserisci prima artista e titolo.');return}
 if(data.tracks.some(t=>t.original||t.translation||t.notes)&&!confirm('Sostituire la scaletta? I testi e le note presenti in questa bozza saranno rimossi.'))return;
 const targetId=activeDraftId;try{const r=await fetch('/api/album-tracks?'+new URLSearchParams({artist:data.artist,album:data.title}));const result=await r.json();if(!r.ok)throw Error(result.error);if(activeDraftId!==targetId)throw Error('Hai cambiato bozza: ripeti l’importazione.');data.tracks=result.tracks;renderTracks();await saveDraft();alert('Scaletta importata. Verifica che corrisponda alla versione riprodotta.') }catch(e){alert(e.message)}
}
// Lettura manuale: nessun timer o scorrimento automatico.
updateStatus=function(){};

// Menu follows the same single-page navigation as the rest of the app.
async function menuGo(target){
  document.querySelector('.nav-menu').open=false;
  if(target==='archive'){openHistory();return}
  if(target==='admin'){show('admin');return}
  await show('home');requestAnimationFrame(()=>document.getElementById(target)?.scrollIntoView({behavior:'smooth'}));
}
document.addEventListener('click',e=>{const m=document.querySelector('.nav-menu');if(m?.open&&!m.contains(e.target))m.open=false});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=document.querySelector('.nav-menu');if(m?.open){m.open=false;m.querySelector('summary')?.focus()}}});

let swipeOrigin=null;
document.addEventListener('touchstart',e=>{if(e.target.closest('.lyrics')&&e.touches.length===1)swipeOrigin={x:e.touches[0].clientX,y:e.touches[0].clientY};else swipeOrigin=null},{passive:true});
document.addEventListener('touchend',e=>{if(!swipeOrigin||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-swipeOrigin.x,dy=e.changedTouches[0].clientY-swipeOrigin.y;swipeOrigin=null;if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.4)return;const tabs=['original','translation'],next=Math.max(0,Math.min(1,tabs.indexOf(tab)+(dx<0?1:-1)));if(tabs[next]!==tab){setTab(tabs[next]);}},{passive:true});

// Changes are saved privately; publishing remains an explicit separate action.
document.addEventListener('input',e=>{if(e.target.closest('#admin'))scheduleDraftSave()});
document.addEventListener('change',e=>{if(e.target.closest('#admin'))scheduleDraftSave()});
for(const name of ['addWorkspaceTrack','removeTrackWorkspace','addBlock','removeBlock','moveBlock','addEvent','removeEvent','toggleArchivedEvent','importTrackText']){const original=window[name];if(typeof original==='function')window[name]=function(...args){const result=original.apply(this,args);if(result&&typeof result.then==='function')result.finally(scheduleDraftSave);else scheduleDraftSave();return result}}

// Keep the active editor separate from what visitors see, and save before switching views.
const workspaceShow=show;
show=async function(id){
 if(id!=='admin'&&document.getElementById('admin')?.classList.contains('active')){
  if(!await saveDraft())return;
  try{const response=await fetch('/api/content',{cache:'no-store'});if(!response.ok)throw Error();const result=await response.json();if(result.data){data=restoreDamagedLotus(result.data.album);events=result.data.events;blocks=result.data.blocks;if(!data.videoBlocksMigrated&&albumIdentity(data.artist,data.title)===albumIdentity('Little Simz','Lotus')){if(!blocks.some(b=>vimeoId(b.value)==='1060602260'))blocks.push({type:'video',value:'https://vimeo.com/1060602260',caption:'Flood / Little Simz'});data.videoBlocksMigrated=true}pageCopy=result.data.copy||{};publishedArchive=result.data.archive||[];refreshPage()}}
  catch{const status=document.getElementById('save-status');if(status)status.textContent='Bozza salvata, ma il sito pubblico non è disponibile. Riprova.';return}
 }
 return workspaceShow(id);
};
const publishExplicit=publishContent;
publishContent=async function(){if(!await saveDraft())return;return publishExplicit()};

function renderSeriesAdmin(){
 const root=document.getElementById('admin-seriesadmin');if(!root)return;
 const closed=workspace.closedSeries||[];workspace.closedSeries=[];const names=allSeries();workspace.closedSeries=closed;
 root.innerHTML='<h3>Gestisci le miniserie</h3><p class="muted">Chiudi una miniserie per nasconderla dalle scelte future. Gli album già associati restano invariati. Puoi riaprirla in qualsiasi momento.</p>'+names.map((n,i)=>'<div class="library-item"><div><strong>'+ehtml(n)+'</strong><small>'+(closed.includes(seriesKey(n))?'Chiusa':'Aperta')+'</small></div><button class="pill" onclick="toggleSeriesStatus('+i+')">'+(closed.includes(seriesKey(n))?'Riapri':'Chiudi')+'</button></div>').join('');window.adminSeriesNames=names;
}
async function toggleSeriesStatus(i){const name=window.adminSeriesNames?.[i];if(!name||!await saveDraft())return;const old=[...(workspace.closedSeries||[])],key=seriesKey(name);workspace.closedSeries=old.includes(key)?old.filter(x=>x!==key):[...old,key];try{await persistWorkspace();refreshSeriesChoices();renderSeriesAdmin()}catch(e){workspace.closedSeries=old;alert(e.message)}}
async function renderArchiveAdmin(){
 const root=document.getElementById('admin-archiveadmin');if(!root)return;root.innerHTML='<p>Caricamento archivio…</p>';
 try{await Promise.all([loadCatalog(),loadArchiveEdits()]);rebuildHistory();window.adminArchiveItems=historyAlbums.filter(a=>archiveStatus(a)==='past'&&!(a.date&&a.date>=italyToday())&&albumIdentity(a.artist,a.title)!==albumIdentity(data.artist,data.title));root.innerHTML='<h3>Modifica l’archivio</h3><p class="muted">Le modifiche sono pubblicate subito e non sostituiscono il MusiForum principale.</p><label class="field">Cerca un album<input type="search" id="admin-archive-search" oninput="filterAdminArchive()" placeholder="Artista o album"></label><div id="admin-archive-list"></div>';filterAdminArchive()}catch(e){root.textContent='Impossibile caricare l’archivio: '+e.message}
}
function filterAdminArchive(){const q=(document.getElementById('admin-archive-search')?.value||'').toLocaleLowerCase('it');document.getElementById('admin-archive-list').innerHTML=window.adminArchiveItems.map((a,i)=>({a,i})).filter(({a})=>(a.artist+' '+a.title).toLocaleLowerCase('it').includes(q)).map(({a,i})=>'<div class="library-item"><div><strong>'+ehtml(a.artist)+' · '+ehtml(a.title)+'</strong><small>'+ehtml(a.year||'')+'</small></div><button class="pill" onclick="editArchivedAlbum('+i+')">Modifica</button></div>').join('')||'<p>Nessun album trovato.</p>'}
function editArchivedAlbum(i){const a=window.adminArchiveItems[i];if(!a)return;const fields=[['artist','Artista'],['title','Album'],['year','Anno'],['date','Data evento'],['place','Luogo'],['series','Miniserie'],['image','URL copertina'],['note','Note'],['detail','Descrizione evento'],['spotifyUrl','Spotify'],['appleUrl','Apple Music'],['soundcloudUrl','SoundCloud']];const root=document.getElementById('admin-archive-list');root.innerHTML='<button class="pill" onclick="filterAdminArchive()">Torna alla lista</button><h3>Modifica scheda</h3><div class="editor">'+fields.map(([k,label])=>'<label class="field">'+label+'<input id="archive-edit-'+k+'" '+(k==='date'?'type="date"':'')+' value="'+ehtml(a[k]||'')+'"></label>').join('')+'</div><button class="pill dark" onclick="saveArchivedAlbum('+i+')">Salva nell’archivio</button><p id="archive-edit-status" aria-live="polite"></p>'}
async function saveArchivedAlbum(i){const a=window.adminArchiveItems[i];if(!a)return;const fields=['artist','title','year','date','place','series','image','note','detail','spotifyUrl','appleUrl','soundcloudUrl'];const edit={};for(const k of fields)edit[k]=document.getElementById('archive-edit-'+k).value.trim();if(!edit.artist||!edit.title){alert('Inserisci artista e album.');return}for(const k of ['image','spotifyUrl','appleUrl','soundcloudUrl'])if(edit[k]&&!validLink(edit[k])){alert('Controlla il collegamento '+k+'.');return}const key=archiveEditKey(a),next={...archiveEdits,[key]:edit};const status=document.getElementById('archive-edit-status');status.textContent='Salvataggio…';try{const r=await fetch('/api/archive',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:next,revision:archiveEditRevision})});const x=await r.json();if(!r.ok)throw Error(x.error);archiveEdits=next;archiveEditRevision=x.updatedAt;Object.assign(a,edit);status.textContent='Modifiche pubblicate nell’archivio.'}catch(e){status.textContent=e.message}}

const previousRenderForNavigation=renderReader;renderReader=function(){previousRenderForNavigation();let nav=document.getElementById('lyrics-navigation');if(!nav)return;nav.innerHTML='<button class="pill" '+(index===0?'disabled':'')+' onclick="navigateLyrics(-1)">Brano precedente</button><span>'+(index+1)+' / '+data.tracks.length+'</span><button class="pill" '+(index>=data.tracks.length-1?'disabled':'')+' onclick="navigateLyrics(1)">Brano successivo</button>'};
function navigateLyrics(delta){const next=Math.max(0,Math.min(data.tracks.length-1,index+delta));if(next===index)return;selectTrack(next);document.getElementById('track-title').scrollIntoView({block:'center',behavior:'smooth'})}

function sponsorMarkup(){const logos=[['sponsorImage','sponsorName'],['sponsorImage2','sponsorName2'],['sponsorImage3','sponsorName3']].map(([url,name])=>{const src=imageLink(data[url]||'');return src?'<img src="'+ehtml(src)+'" alt="'+ehtml(data[name]||'Sponsor')+'">':''}).join('');return (data.eventHeading?'<h3>'+ehtml(data.eventHeading)+'</h3>':'')+(logos?'<div class="sponsor-logos">'+logos+'</div>':'')}
const priorReaderForSponsor=renderReader;renderReader=function(){priorReaderForSponsor();const article=document.getElementById('article'),heading=document.getElementById('event-sponsor');const hasBlocks=Array.isArray(blocks)&&blocks.length>0;article.classList.toggle('hidden',!data.article&&!data.articleTitle&&!hasBlocks);heading.innerHTML=sponsorMarkup()};
const priorRefreshSponsor=refreshPage;refreshPage=function(){priorRefreshSponsor();document.getElementById('home-event-sponsor').innerHTML=sponsorMarkup()};

const renderHomeBeforeSessionNumber=renderHome;renderHome=function(){renderHomeBeforeSessionNumber();const match=catalog.find(a=>albumIdentity(a.artist,a.title)===albumIdentity(data.artist,data.title));const value=String(data.eventNumber||((match?.n>0&&match.n<=103)?match.n:'')).trim();const heading=document.getElementById('home-title');heading.textContent=value?'N. '+value:'';};
const refreshBeforeTextCtas=refreshPage;refreshPage=function(){refreshBeforeTextCtas();const primary=document.querySelector('.intro-actions button'),secondary=document.querySelector('.album-info button');if(primary)primary.textContent='Scopri i testi';if(secondary)secondary.textContent='Scopri i testi'};

// Provide a non-gesture alternative and identify the active language.
const previousSetTab=setTab;setTab=function(value){previousSetTab(value);const label=document.getElementById('language-label'),hint=document.getElementById('swipe-direction');if(label)label.textContent=value==='original'?'Testo originale':'Traduzione';if(hint)hint.textContent=value==='original'?'Fai swipe per le traduzioni':'Fai swipe per il testo originale'};
document.addEventListener('keydown',e=>{if(!e.target.matches('.lyrics'))return;if(e.key==='ArrowLeft'&&tab==='original'){e.preventDefault();setTab('translation')}else if(e.key==='ArrowRight'&&tab==='translation'){e.preventDefault();setTab('original')}});
