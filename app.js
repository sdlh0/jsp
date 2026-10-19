
const $=s=>document.querySelector(s);
const KEY='moncap_v1';
let S=null,view='today';
const today=()=>dk(new Date());
function dk(d){const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function addDays(k,n){const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return dk(d)}
function monday(k){const d=new Date(k+'T12:00:00');const w=(d.getDay()+6)%7;d.setDate(d.getDate()-w);return dk(d)}
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const def=()=>({goals:[],tasks:[],journal:{},settings:{pin:null,salt:null,wake:'09:00',lastExport:null},updatedAt:0});

function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('moncap',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbGet(){try{const db=await idb();return await new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get(KEY);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)})}catch(e){return null}}
async function idbSet(v){try{const db=await idb();db.transaction('kv','readwrite').objectStore('kv').put(v,KEY)}catch(e){}}
function lsGet(){try{return JSON.parse(localStorage.getItem(KEY))}catch(e){return null}}
function save(){S.updatedAt=Date.now();const j=JSON.stringify(S);try{localStorage.setItem(KEY,j)}catch(e){}idbSet(j)}
async function load(){
  const a=lsGet();let b=null;const raw=await idbGet();try{b=raw?JSON.parse(raw):null}catch(e){}
  const best=[a,b].filter(Boolean).sort((x,y)=>y.updatedAt-x.updatedAt)[0];
  S=Object.assign(def(),best||{});S.settings=Object.assign(def().settings,S.settings);
  if(best)save();
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
}
async function hash(p,salt){const b=new TextEncoder().encode(salt+p);const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}

async function init(){
  await load();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  $('#lock').classList.remove('hidden');
  $('#lockMsg').textContent=S.settings.pin?'Entre ton code PIN.':'Première fois : choisis un code PIN (4 chiffres minimum).';
  $('#pinBtn').textContent=S.settings.pin?'Entrer':'Créer le PIN';
  $('#pinBtn').onclick=unlock;$('#pin').onkeydown=e=>{if(e.key==='Enter')unlock()};
}
async function unlock(){
  const p=$('#pin').value;if(p.length<4){$('#lockMsg').textContent='4 caractères minimum.';return}
  if(!S.settings.pin){S.settings.salt=uid()+uid();S.settings.pin=await hash(p,S.settings.salt);save()}
  else if(await hash(p,S.settings.salt)!==S.settings.pin){$('#lockMsg').textContent='Mauvais code.';$('#pin').value='';return}
  $('#lock').classList.add('hidden');$('#app').classList.remove('hidden');$('#nav').classList.remove('hidden');
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{view=b.dataset.v;render()});
  render();
}

function streak(){let n=0,k=today();if(!S.journal[k])k=addDays(k,-1);while(S.journal[k]){n++;k=addDays(k,-1)}return n}
function activeGoals(){return S.goals.filter(g=>!g.done)}
function goalPct(g){return g.steps.length?Math.round(100*g.steps.filter(s=>s.done).length/g.steps.length):0}
function render(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===view));
  $('#view').innerHTML=({today:vToday,goals:vGoals,week:vWeek,journal:vJournal,settings:vSettings})[view]();
  window.scrollTo(0,0);
}
function taskRow(t){return `<div class="row ${t.done?'done':''}"><input type="checkbox" ${t.done?'checked':''} onchange="tog('${t.id}')"><span>${t.priority?'⭐ ':''}${esc(t.text)}</span><button class="del" onclick="delT('${t.id}')">×</button></div>`}
function vToday(){
  const k=today(),ts=S.tasks.filter(t=>t.date===k);
  const main=ts.find(t=>t.priority);
  return `<h2>Aujourd'hui</h2><p class="muted">${k} · Série journal : ${streak()} jour(s) · Réveil visé : ${esc(S.settings.wake)}</p>
  <div class="card"><h3>Priorité du jour</h3>${main?taskRow(main):'<p class="muted">Aucune priorité définie.</p>'}
  ${main?'':`<input id="np" placeholder="La chose la plus importante aujourd'hui"><button onclick="addT(true)">Définir</button>`}</div>
  <div class="card"><h3>Autres tâches (3 max)</h3>${ts.filter(t=>!t.priority).map(taskRow).join('')||'<p class="muted">Rien pour l\'instant.</p>'}
  ${ts.filter(t=>!t.priority).length<3?`<input id="nt" placeholder="Nouvelle tâche"><button onclick="addT(false)">Ajouter</button>`:''}</div>
  <div class="card"><h3>Objectifs actifs</h3>${activeGoals().map(g=>`<div>${esc(g.title)} — ${goalPct(g)}%<div class="bar"><i style="width:${goalPct(g)}%"></i></div></div>`).join('<br>')||'<p class="muted">Aucun objectif. Va dans Objectifs.</p>'}</div>
  ${S.journal[k]?'':'<div class="card warn">Pense au journal du soir.</div>'}${exportWarn()}`;
}
function exportWarn(){const l=S.settings.lastExport;if(!l||(Date.now()-l)>7*864e5)return '<div class="card warn">Sauvegarde conseillée : va dans Réglages → Exporter.</div>';return ''}
function addT(p){const el=$(p?'#np':'#nt');const v=el.value.trim();if(!v)return;S.tasks.push({id:uid(),date:today(),text:v,done:false,priority:p});save();render()}
function tog(id){const t=S.tasks.find(x=>x.id===id);t.done=!t.done;save();render()}
function delT(id){S.tasks=S.tasks.filter(x=>x.id!==id);save();render()}

function vGoals(){
  const act=activeGoals();
  return `<h2>Objectifs</h2><p class="muted">3 actifs maximum pour rester concentré.</p>
  ${act.map(g=>`<div class="card"><h3>${esc(g.title)} (${goalPct(g)}%)</h3>
  ${g.steps.map(s=>`<div class="row ${s.done?'done':''}"><input type="checkbox" ${s.done?'checked':''} onchange="togS('${g.id}','${s.id}')"><span>${esc(s.text)}</span></div>`).join('')}
  <input id="st${g.id}" placeholder="Nouvelle étape"><button onclick="addS('${g.id}')">+ Étape</button>
  <button class="sec" onclick="finG('${g.id}')">Terminé</button><button class="del" onclick="delG('${g.id}')">Supprimer</button></div>`).join('')}
  ${act.length<3?`<div class="card"><input id="ng" placeholder="Nouvel objectif (ex : Obtenir le permis)"><button onclick="addG()">Créer</button></div>`:'<p class="muted">Limite atteinte : termine ou supprime un objectif pour en ajouter un.</p>'}
  ${S.goals.filter(g=>g.done).length?`<h3>Terminés</h3>${S.goals.filter(g=>g.done).map(g=>`<div class="muted">✓ ${esc(g.title)}</div>`).join('')}`:''}`;
}
function addG(){const v=$('#ng').value.trim();if(!v)return;S.goals.push({id:uid(),title:v,steps:[],done:false});save();render()}
function addS(id){const v=$('#st'+id).value.trim();if(!v)return;S.goals.find(g=>g.id===id).steps.push({id:uid(),text:v,done:false});save();render()}
function togS(g,s){const x=S.goals.find(a=>a.id===g).steps.find(a=>a.id===s);x.done=!x.done;save();render()}
function finG(id){S.goals.find(g=>g.id===id).done=true;save();render()}
function delG(id){if(confirm('Supprimer cet objectif ?')){S.goals=S.goals.filter(g=>g.id!==id);save();render()}}

function vWeek(){
  const m=monday(today()),days=[...Array(7)].map((_,i)=>addDays(m,i)),names=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const wt=S.tasks.filter(t=>days.includes(t.date)),dn=wt.filter(t=>t.done).length;
  const wj=days.filter(d=>S.journal[d]).length;
  const scores=days.map(d=>S.journal[d]?.score).filter(x=>x);
  const avg=scores.length?(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1):'-';
  return `<h2>Semaine</h2><div class="card"><div class="big">${wt.length?Math.round(100*dn/wt.length):0}%</div><p class="muted">${dn}/${wt.length} tâches faites · ${wj}/7 journaux · note moyenne ${avg}</p></div>
  ${days.map((d,i)=>`<div class="card ${d===today()?'':''}"><b>${names[i]} ${d.slice(5)}</b>${S.tasks.filter(t=>t.date===d).map(taskRow).join('')||'<p class="muted">—</p>'}
  <input id="w${d}" placeholder="Planifier une tâche"><button class="sec" onclick="planT('${d}')">Ajouter</button></div>`).join('')}`;
}
function planT(d){const v=$('#w'+d).value.trim();if(!v)return;S.tasks.push({id:uid(),date:d,text:v,done:false,priority:false});save();render()}

function vJournal(){
  const k=today(),e=S.journal[k]||{};
  const past=Object.keys(S.journal).sort().reverse().filter(x=>x!==k).slice(0,14);
  return `<h2>Journal du soir</h2><div class="card"><p class="muted">${k}</p>
  <label>Heure de réveil</label><input id="jw" type="time" value="${esc(e.wake||'')}">
  <label>Ce que j'ai fait</label><textarea id="jd">${esc(e.did||'')}</textarea>
  <label>Ce qui m'a bloqué</label><textarea id="jb">${esc(e.blocked||'')}</textarea>
  <label>Note de la journée (1-10)</label><input id="js" type="number" min="1" max="10" value="${esc(e.score||'')}">
  <button onclick="saveJ()">Enregistrer</button></div>
  ${past.map(d=>{const x=S.journal[d];return `<div class="card"><b>${d}</b> · ${x.score||'-'}/10 · réveil ${esc(x.wake||'-')}<p>${esc(x.did)}</p><p class="muted">Blocage : ${esc(x.blocked)}</p></div>`}).join('')}`;
}
function saveJ(){S.journal[today()]={wake:$('#jw').value,did:$('#jd').value,blocked:$('#jb').value,score:Number($('#js').value)||0};save();alert('Enregistré');render()}

function vSettings(){
  return `<h2>Réglages</h2><div class="card"><h3>Sauvegarde</h3>
  <p class="muted">Vider l'historique ne supprime en général pas les données si tu ne coches pas « données de sites ». Une sauvegarde fichier reste la vraie sécurité.</p>
  <button onclick="exp()">Exporter (fichier)</button>
  <input id="imp" type="file" accept=".json" onchange="impF(this)"></div>
  <div class="card"><h3>Réveil visé</h3><input id="sw" type="time" value="${esc(S.settings.wake)}"><button onclick="setWake()">Enregistrer</button></div>
  <div class="card"><h3>Sécurité</h3><button class="sec" onclick="chPin()">Changer le PIN</button><button class="del" onclick="wipe()">Tout effacer</button></div>`;
}
function setWake(){S.settings.wake=$('#sw').value;save();alert('OK')}
function exp(){const b=new Blob([JSON.stringify(S,null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='moncap-sauvegarde-'+today()+'.json';a.click();S.settings.lastExport=Date.now();save()}
function impF(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.goals||!d.tasks)throw 0;if(confirm('Remplacer toutes les données actuelles ?')){S=Object.assign(def(),d);save();alert('Importé');render()}}catch(e){alert('Fichier invalide')}};r.readAsText(f)}
async function chPin(){const p=prompt('Nouveau PIN (4 min.)');if(!p||p.length<4)return;S.settings.salt=uid()+uid();S.settings.pin=await hash(p,S.settings.salt);save();alert('PIN changé')}
function wipe(){if(confirm('Effacer toutes les données ?')&&confirm('Vraiment ? Irréversible.')){S=def();save();location.reload()}}
init();
