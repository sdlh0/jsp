const $=s=>document.querySelector(s);
const KEY='moncap_v1',APP_VERSION=3;
let S=null,view='today',lenis=null,toastTimer=null;
const today=()=>dk(new Date());
function dk(d){const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function addDays(k,n){const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return dk(d)}
function monday(k){const d=new Date(k+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return dk(d)}
const uid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2,11);
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const def=()=>({version:APP_VERSION,goals:[],tasks:[],journal:{},gamification:{xp:0,credits:0,awards:{},rewards:[],claimed:[],lastCelebration:null},settings:{pin:null,salt:null,wake:'09:00',lastExport:null,sound:true,motion:true},updatedAt:0});

function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('moncap',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('kv'))r.result.createObjectStore('kv')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbGet(){try{const db=await idb();return await new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get(KEY);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)})}catch{return null}}
async function idbSet(v){try{const db=await idb();db.transaction('kv','readwrite').objectStore('kv').put(v,KEY)}catch{}}
function lsGet(){try{return JSON.parse(localStorage.getItem(KEY))}catch{return null}}
function save(){S.updatedAt=Date.now();S.version=APP_VERSION;const j=JSON.stringify(S);try{localStorage.setItem(KEY,j)}catch{}idbSet(j)}
function migrate(data){const d=def(),x=Object.assign(d,data||{});x.settings=Object.assign(d.settings,data?.settings||{});x.gamification=Object.assign(d.gamification,data?.gamification||{});x.gamification.awards=x.gamification.awards||{};x.gamification.rewards=x.gamification.rewards||[];x.gamification.claimed=x.gamification.claimed||[];x.goals=Array.isArray(x.goals)?x.goals:[];x.tasks=Array.isArray(x.tasks)?x.tasks:[];x.journal=x.journal||{};return x}
async function load(){const a=lsGet();let b=null,raw=await idbGet();try{b=raw?JSON.parse(raw):null}catch{}const best=[a,b].filter(Boolean).sort((x,y)=>(y.updatedAt||0)-(x.updatedAt||0))[0];S=migrate(best);if(best)save();if(navigator.storage?.persist)navigator.storage.persist()}
async function hash(p,salt){const b=new TextEncoder().encode(salt+p),h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}

async function init(){
  await load();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js?v=3').catch(()=>{});
  $('#lock').classList.remove('hidden');
  $('#lockMsg').textContent=S.settings.pin?'Entre ton code PIN pour reprendre ta progression.':'Première visite : choisis un code PIN de 4 caractères minimum.';
  $('#pinBtn').textContent=S.settings.pin?'Entrer':'Créer mon PIN';
  $('#pinBtn').onclick=unlock;$('#pin').onkeydown=e=>{if(e.key==='Enter')unlock()};
  animateIn('.lock-card');
}
async function unlock(){
  const p=$('#pin').value;if(p.length<4){$('#lockMsg').textContent='Ton code doit contenir au moins 4 caractères.';shake('.lock-card');return}
  if(!S.settings.pin){S.settings.salt=uid()+uid();S.settings.pin=await hash(p,S.settings.salt);save()}
  else if(await hash(p,S.settings.salt)!==S.settings.pin){$('#lockMsg').textContent='Ce code ne correspond pas.';$('#pin').value='';shake('.lock-card');return}
  $('#lock').classList.add('hidden');$('#shell').classList.remove('hidden');
  document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>go(b.dataset.v));
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=e=>{e.preventDefault();go(b.dataset.nav)});
  initLenis();render();
}
function initLenis(){if(window.Lenis&&!matchMedia('(prefers-reduced-motion:reduce)').matches){try{lenis=new Lenis({autoRaf:true,smoothWheel:true,duration:.8})}catch{}}}
function go(v){view=v;render();history.replaceState(null,'','#'+v)}

function levelInfo(){const step=150,xp=S.gamification.xp||0,level=Math.floor(xp/step)+1,inside=xp%step;return{level,inside,needed:step,pct:Math.round(inside/step*100)}}
function completionStreak(){let n=0,k=today();const has=d=>S.tasks.some(t=>t.date===d&&t.done)||!!S.journal[d];if(!has(k))k=addDays(k,-1);while(has(k)){n++;k=addDays(k,-1)}return n}
function activeGoals(){return S.goals.filter(g=>!g.done)}
function goalPct(g){return g.steps?.length?Math.round(100*g.steps.filter(s=>s.done).length/g.steps.length):0}
function dailyTasks(k=today()){return S.tasks.filter(t=>t.date===k)}
function award(key,xp,title,big=false){if(S.gamification.awards[key])return false;S.gamification.awards[key]={at:Date.now(),xp,title};S.gamification.xp+=xp;S.gamification.credits+=Math.max(1,Math.round(xp/5));save();if(big)celebrate(title,xp);else{toast(`+${xp} XP · ${title}`);successSound(false)}return true}
function updateHeader(){const l=levelInfo();$('#levelBadge').textContent=`NIV. ${l.level}`;$('#headerXp').style.width=l.pct+'%'}
function render(){
  document.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===view));
  const fn={today:vToday,goals:vGoals,week:vWeek,journal:vJournal,profile:vProfile}[view]||vToday;
  $('#view').innerHTML=fn();updateHeader();window.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>animateView());
}
function animateView(){if(!S.settings.motion||!window.gsap)return;gsap.from('#view > *',{opacity:0,y:14,duration:.42,stagger:.045,ease:'power3.out',clearProps:'all'})}
function animateIn(sel){if(window.gsap)gsap.from(sel,{opacity:0,y:18,scale:.98,duration:.6,ease:'power3.out'})}
function shake(sel){if(window.gsap)gsap.fromTo(sel,{x:-7},{x:7,duration:.07,repeat:5,yoyo:true,clearProps:'x'})}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
function successSound(big=false){if(!S.settings.sound)return;try{const A=window.AudioContext||window.webkitAudioContext,c=new A(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.setValueAtTime(big?520:440,c.currentTime);o.frequency.exponentialRampToValueAtTime(big?880:660,c.currentTime+.16);g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.1,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.25);o.start();o.stop(c.currentTime+.26)}catch{}}

function taskRow(t){return `<div class="task ${t.done?'done':''}" data-task="${t.id}"><button class="check" onclick="tog('${t.id}')" aria-label="${t.done?'Rouvrir':'Terminer'} ${esc(t.text)}"></button><span class="task-text">${t.priority?'<span class="tag">CAP</span> ':''}${esc(t.text)}</span><button class="icon-btn" onclick="delT('${t.id}')" aria-label="Supprimer">×</button></div>`}
function pageHead(title,sub,extra=''){return `<header class="page-head"><div><p class="eyebrow">${extra||'MON CAP'}</p><h2>${title}</h2><p class="muted">${sub}</p></div></header>`}
function vToday(){
  const k=today(),ts=dailyTasks(k),done=ts.filter(t=>t.done).length,main=ts.find(t=>t.priority),l=levelInfo();
  return `${pageHead('Aujourd’hui',new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(new Date()),'PASSE À L’ACTION')}
  <section class="stats"><div class="stat"><strong>${done}/${ts.length}</strong><span>Tâches</span></div><div class="stat"><strong>${completionStreak()}</strong><span>Série</span></div><div class="stat"><strong>${S.gamification.credits}</strong><span>Crédits</span></div></section>
  <section class="card hero-card raised"><div><span class="tag">PRIORITÉ ABSOLUE</span></div>${main?`<div><p class="hero-copy ${main.done?'muted':''}">${esc(main.text)}</p><div class="actions"><button class="btn primary" onclick="tog('${main.id}')">${main.done?'Rouvrir':'Mission accomplie'}</button></div></div>`:`<div><p class="hero-empty">Décide de l’action qui rendrait cette journée utile, même si tu ne faisais rien d’autre.</p><div class="add-line"><input id="np" maxlength="120" placeholder="Ex. Appeler l’auto-école"><button class="btn primary" onclick="addT(true)">Fixer mon cap</button></div></div>`}</section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">EXÉCUTION</p><h3>Trois actions maximum</h3></div><span class="tag">${done}/${ts.length}</span></div>${ts.filter(t=>!t.priority).map(taskRow).join('')||'<p class="muted">Ajoute uniquement ce qui mérite réellement ton temps.</p>'}${ts.filter(t=>!t.priority).length<3?`<div class="add-line"><input id="nt" maxlength="120" placeholder="Nouvelle action"><button class="btn ghost" onclick="addT(false)">Ajouter</button></div>`:''}</section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">TRAJECTOIRE</p><h3>Objectifs actifs</h3></div><span class="muted">${activeGoals().length}/3</span></div>${activeGoals().map(g=>`<div style="margin-top:1rem"><div class="goal-title"><strong>${esc(g.title)}</strong><span class="muted">${goalPct(g)}%</span></div><div class="progress"><i style="width:${goalPct(g)}%"></i></div></div>`).join('')||'<p class="muted">Définis jusqu’à trois directions dans l’onglet Objectifs.</p>'}</section>
  ${!S.journal[k]?'<div class="notice">Ton bilan de ce soir débloquera 20 XP et une réponse privée du coach.</div>':''}${exportWarn()}`
}
function exportWarn(){const l=S.settings.lastExport;return(!l||Date.now()-l>7*864e5)?'<div class="notice">Dernière sécurité : exporte une sauvegarde dans Progression.</div>':''}
function addT(priority,date=today()){const el=$(priority?'#np':'#nt'),v=el?.value.trim();if(!v)return;if(priority&&dailyTasks(date).some(t=>t.priority)){toast('Une seule priorité par jour.');return}S.tasks.push({id:uid(),date,text:v,done:false,priority});save();render()}
function tog(id){const t=S.tasks.find(x=>x.id===id);if(!t)return;t.done=!t.done;if(t.done){const gained=award('task:'+id,t.priority?35:12,t.priority?'Priorité accomplie':'Action terminée',t.priority);if(!gained)toast('Action terminée. XP déjà attribués.')}save();render()}
function delT(id){S.tasks=S.tasks.filter(x=>x.id!==id);save();render()}

function vGoals(){const act=activeGoals();return `${pageHead('Objectifs','Trois directions. Pas quinze distractions.','GARDE LE CAP')}${act.map(g=>`<section class="card goal"><div class="goal-title"><div><p class="eyebrow">OBJECTIF</p><strong>${esc(g.title)}</strong></div><span class="tag">${goalPct(g)}%</span></div><div class="progress"><i style="width:${goalPct(g)}%"></i></div><div style="margin-top:1rem">${(g.steps||[]).map(s=>`<label class="goal-step"><input type="checkbox" ${s.done?'checked':''} onchange="togS('${g.id}','${s.id}')"><span class="${s.done?'muted':''}">${esc(s.text)}</span></label>`).join('')||'<p class="muted">Découpe cet objectif en prochaines actions concrètes.</p>'}</div><div class="add-line"><input id="st${g.id}" maxlength="120" placeholder="Prochaine étape"><button class="btn ghost" onclick="addS('${g.id}')">Ajouter</button></div><div class="actions"><button class="btn primary small" onclick="finG('${g.id}')">Objectif atteint</button><button class="btn danger small" onclick="delG('${g.id}')">Supprimer</button></div></section>`).join('')}${act.length<3?`<section class="card"><p class="eyebrow">NOUVELLE DIRECTION</p><h3>Quel résultat veux-tu obtenir ?</h3><div class="add-line"><input id="ng" maxlength="100" placeholder="Ex. Obtenir le permis"><button class="btn primary" onclick="addG()">Créer</button></div></section>`:'<div class="notice">Tu as atteint la limite. Termine un objectif avant d’en ouvrir un autre.</div>'}${S.goals.some(g=>g.done)?`<section class="card"><h3>Victoires</h3>${S.goals.filter(g=>g.done).map(g=>`<p style="margin-top:.75rem">✓ ${esc(g.title)}</p>`).join('')}</section>`:''}`}
function addG(){const v=$('#ng')?.value.trim();if(!v||activeGoals().length>=3)return;S.goals.push({id:uid(),title:v,steps:[],done:false});save();render()}
function addS(id){const v=$('#st'+id)?.value.trim(),g=S.goals.find(x=>x.id===id);if(!v||!g)return;g.steps.push({id:uid(),text:v,done:false});save();render()}
function togS(gid,sid){const s=S.goals.find(g=>g.id===gid)?.steps.find(x=>x.id===sid);if(!s)return;s.done=!s.done;if(s.done)award('step:'+sid,18,'Étape franchie');save();render()}
function finG(id){const g=S.goals.find(x=>x.id===id);if(!g)return;if(!confirm(`Confirmer que « ${g.title} » est réellement atteint ?`))return;g.done=true;award('goal:'+id,120,'Objectif atteint',true);save();render()}
function delG(id){if(confirm('Supprimer définitivement cet objectif ?')){S.goals=S.goals.filter(g=>g.id!==id);save();render()}}

function vWeek(){
  const m=monday(today()),days=[...Array(7)].map((_,i)=>addDays(m,i)),names=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'],wt=S.tasks.filter(t=>days.includes(t.date)),dn=wt.filter(t=>t.done).length,pct=wt.length?Math.round(100*dn/wt.length):0,wj=days.filter(d=>S.journal[d]).length;
  return `${pageHead('Cette semaine','Mesure les actes, pas les intentions.','RYTHME')}
  <section class="card raised week-overview"><div class="score-ring" style="--p:${pct}"><strong>${pct}%</strong></div><div><h3>${dn} action${dn>1?'s':''} terminée${dn>1?'s':''}</h3><p class="muted">${wt.length} planifiée${wt.length>1?'s':''} · ${wj}/7 bilans</p></div></section>
  ${days.map((d,i)=>`<section class="card week-day ${d===today()?'today':''}"><div class="week-date"><div><p class="eyebrow">${d===today()?'AUJOURD’HUI':'JOUR '+(i+1)}</p><h3>${names[i]} ${d.slice(8)}</h3></div><span class="muted">${S.tasks.filter(t=>t.date===d&&t.done).length}/${S.tasks.filter(t=>t.date===d).length}</span></div><div style="margin-top:.75rem">${S.tasks.filter(t=>t.date===d).map(taskRow).join('')||'<p class="muted">Aucune action planifiée.</p>'}</div><div class="add-line"><input id="w${d}" maxlength="120" placeholder="Planifier une action"><button class="btn ghost" onclick="planT('${d}')">Ajouter</button></div></section>`).join('')}`
}
function planT(d){const v=$('#w'+d)?.value.trim();if(!v)return;S.tasks.push({id:uid(),date:d,text:v,done:false,priority:false});save();render()}

function vJournal(){
  const k=today(),e=S.journal[k]||{},past=Object.keys(S.journal).sort().reverse().filter(x=>x!==k).slice(0,21);
  return `${pageHead('Journal','Un bilan honnête vaut mieux qu’une excuse bien formulée.','LUCIDITÉ')}
  <section class="card raised"><p class="eyebrow">BILAN DU ${k.slice(8)}/${k.slice(5,7)}</p><label for="jw">Heure de réveil</label><input id="jw" type="time" value="${esc(e.wake||'')}"><label for="jd">Ce que j’ai réellement fait</label><textarea id="jd" placeholder="Des faits précis, pas des intentions.">${esc(e.did||'')}</textarea><label for="jb">Ce qui m’a bloqué ou distrait</label><textarea id="jb" placeholder="TikTok, fatigue, peur, manque de plan…">${esc(e.blocked||'')}</textarea><label for="js">Note honnête de la journée</label><input id="js" type="number" min="1" max="10" inputmode="numeric" value="${esc(e.score||'')}"><div class="actions"><button class="btn primary" onclick="saveJ(true)">Enregistrer et analyser</button><button class="btn ghost" onclick="saveJ(false)">Enregistrer</button></div></section>
  ${e.analysis?coachCard(e.analysis):''}
  <section><div class="card-head"><div><p class="eyebrow">HISTORIQUE</p><h3>Tes derniers bilans</h3></div></div>${past.length?past.map(d=>journalCard(d,S.journal[d])).join(''):'<div class="card"><p class="muted">Tes anciens bilans apparaîtront ici avec les réponses du coach.</p></div>'}</section>`
}
function journalCard(d,x){return `<article class="card journal-entry"><div class="entry-meta"><strong>${d}</strong><span>${x.score||'-'}/10 · Réveil ${esc(x.wake||'-')}</span></div><p>${esc(x.did||'Aucune action indiquée.')}</p><p class="muted">Blocage : ${esc(x.blocked||'Non indiqué.')}</p>${x.analysis?`<details style="margin-top:1rem"><summary>Relire la réponse du coach</summary><p class="coach-copy" style="margin-top:.75rem">${esc(x.analysis)}</p></details>`:''}</article>`}
function coachCard(text){return `<section class="card coach"><div class="coach-label">◆ RÉPONSE DU COACH — PRIVÉE ET LOCALE</div><p class="coach-copy">${esc(text)}</p></section>`}
function saveJ(analyze){const wake=$('#jw').value,did=$('#jd').value.trim(),blocked=$('#jb').value.trim(),score=Math.min(10,Math.max(0,Number($('#js').value)||0));if(!did&&!blocked){toast('Écris au moins un fait sur ta journée.');return}const old=S.journal[today()]||{};S.journal[today()]={...old,wake,did,blocked,score};if(analyze)S.journal[today()].analysis=localCoach(S.journal[today()]);award('journal:'+today(),20,'Bilan honnête');save();render();if(analyze)setTimeout(()=>document.querySelector('.coach')?.scrollIntoView({behavior:'smooth',block:'center'}),120)}
function localCoach(e){
  const ts=dailyTasks(),done=ts.filter(t=>t.done),main=ts.find(t=>t.priority),txt=(e.did+' '+e.blocked).toLowerCase(),distraction=/tiktok|réseau|scroll|jeu|youtube|instagram|snap/.test(txt),wakeLate=e.wake&&S.settings.wake&&e.wake>S.settings.wake;
  let a=[];
  if(done.length===ts.length&&ts.length)a.push(`Fait : tu as terminé ${done.length}/${ts.length} actions prévues. Tu as exécuté ce que tu avais décidé.`);
  else if(done.length)a.push(`Fait : tu as terminé ${done.length}/${ts.length} actions. Il y a du mouvement, mais ton plan n’est pas encore tenu jusqu’au bout.`);
  else a.push(`Fait : aucune action planifiée n’est marquée comme terminée. Ne transforme pas une journée vide en histoire compliquée.`);
  if(main&&!main.done)a.push(`Priorité ignorée : « ${main.text} ». Tant qu’elle reste ouverte, le reste compte moins.`);
  if(distraction)a.push(`Tu cites une distraction numérique. Le problème n’est pas le manque de temps : c’est l’accès trop facile à une récompense sans effort.`);
  if(wakeLate)a.push(`Réveil à ${e.wake}, après la cible de ${S.settings.wake}. Demain commence ce soir : téléphone hors du lit et heure de coupure décidée avant de dormir.`);
  if(e.score>=8&&done.length)a.push(`Ta note de ${e.score}/10 est cohérente avec tes actes. Ne cherche pas à être spectaculaire demain : répète.`);
  else if(e.score>=8)a.push(`Tu notes ${e.score}/10 sans action cochée. Vérifie si tu récompenses ton ressenti plutôt que tes résultats.`);
  const next=main&&!main.done?main.text:'choisir une priorité unique dès le réveil';a.push(`Engagement pour demain : ${next}. Fais-le avant TikTok, les jeux ou toute autre consommation.`);
  a.push(`Question : quelle excuse risques-tu d’utiliser demain, et comment vas-tu la rendre impossible ?`);
  return a.join('\n\n')
}

function achievements(){const total=Object.keys(S.gamification.awards).length,goals=S.goals.filter(g=>g.done).length,journals=Object.keys(S.journal).length,streak=completionStreak();return[{name:'Premier pas',desc:'Terminer une action',ok:total>=1},{name:'Régulier',desc:'Atteindre une série de 3 jours',ok:streak>=3},{name:'Lucide',desc:'Écrire 7 bilans',ok:journals>=7},{name:'Finisseur',desc:'Atteindre un objectif',ok:goals>=1},{name:'Inarrêtable',desc:'Gagner 1 000 XP',ok:S.gamification.xp>=1000}]}
function vProfile(){const l=levelInfo(),a=achievements();return `${pageHead('Progression','Récompense les preuves, pas les promesses.','IDENTITÉ')}
  <section class="card profile-hero"><div class="level-orb" style="--level-progress:${l.pct}%"><strong>${l.level}</strong></div><div><p class="eyebrow">NIVEAU ${l.level}</p><h3>${S.gamification.xp} XP au total</h3><p class="muted">${l.inside}/${l.needed} XP avant le niveau suivant</p><div class="progress"><i style="width:${l.pct}%"></i></div><p class="muted" style="margin-top:.5rem">${S.gamification.credits} crédits disponibles</p></div></section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">RÉCOMPENSES RÉELLES</p><h3>Échange tes crédits</h3></div></div>${S.gamification.rewards.map(r=>`<div class="reward"><div><strong>${esc(r.title)}</strong><p class="muted">Coût : ${r.cost} crédits</p></div><button class="btn ${S.gamification.credits>=r.cost?'primary':'ghost'} small" onclick="claimReward('${r.id}')" ${S.gamification.credits<r.cost?'disabled':''}>Réclamer</button></div>`).join('')||'<p class="muted">Crée une récompense saine : une sortie, un achat prévu, un film ou du temps de jeu.</p>'}<div class="add-line"><input id="rewardName" maxlength="80" placeholder="Ma récompense"><input id="rewardCost" style="max-width:92px" type="number" min="5" value="40" aria-label="Coût"><button class="btn ghost" onclick="addReward()">Créer</button></div></section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">SUCCÈS</p><h3>Preuves accumulées</h3></div><span class="tag">${a.filter(x=>x.ok).length}/${a.length}</span></div>${a.map(x=>`<div class="achievement ${x.ok?'unlocked':''}"><span class="achievement-dot"></span><div><strong>${x.name}</strong><p class="muted">${x.desc}</p></div></div>`).join('')}</section>
  <section class="card"><p class="eyebrow">RÉGLAGES</p><h3>Sauvegarde et préférences</h3><label for="sw">Heure de réveil visée</label><input id="sw" type="time" value="${esc(S.settings.wake)}"><div class="actions"><button class="btn primary small" onclick="setWake()">Enregistrer</button><button class="btn ghost small" onclick="toggleSound()">Son : ${S.settings.sound?'activé':'coupé'}</button><button class="btn ghost small" onclick="toggleMotion()">Animations : ${S.settings.motion?'activées':'réduites'}</button></div><div class="actions"><button class="btn ghost small" onclick="exp()">Exporter mes données</button><label class="btn ghost small" style="margin:0">Importer<input id="imp" class="sr-only" type="file" accept=".json" onchange="impF(this)"></label><button class="btn ghost small" onclick="chPin()">Changer le PIN</button></div><div class="actions"><button class="btn danger small" onclick="wipe()">Tout effacer</button></div></section>`}
function addReward(){const title=$('#rewardName')?.value.trim(),cost=Math.max(5,Number($('#rewardCost')?.value)||40);if(!title)return;S.gamification.rewards.push({id:uid(),title,cost});save();render()}
function claimReward(id){const r=S.gamification.rewards.find(x=>x.id===id);if(!r||S.gamification.credits<r.cost)return;if(!confirm(`Dépenser ${r.cost} crédits pour « ${r.title} » ?`))return;S.gamification.credits-=r.cost;S.gamification.claimed.push({id:r.id,title:r.title,cost:r.cost,at:Date.now()});S.gamification.rewards=S.gamification.rewards.filter(x=>x.id!==id);save();celebrate('Récompense débloquée',0);render()}
function setWake(){S.settings.wake=$('#sw').value;save();toast('Heure cible enregistrée.')}
function toggleSound(){S.settings.sound=!S.settings.sound;save();render()}
function toggleMotion(){S.settings.motion=!S.settings.motion;save();render()}
function exp(){const b=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='moncap-sauvegarde-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);S.settings.lastExport=Date.now();save();toast('Sauvegarde exportée.')}
function impF(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.goals||!d.tasks)throw Error();if(confirm('Remplacer les données actuelles par cette sauvegarde ?')){S=migrate(d);save();toast('Données restaurées.');render()}}catch{toast('Ce fichier ne semble pas valide.')}};r.readAsText(f)}
async function chPin(){const p=prompt('Nouveau PIN (4 caractères minimum)');if(!p||p.length<4)return;S.settings.salt=uid()+uid();S.settings.pin=await hash(p,S.settings.salt);save();toast('PIN modifié.')}
function wipe(){if(confirm('Effacer toutes les données de cet appareil ?')&&confirm('Cette action est irréversible sans sauvegarde. Continuer ?')){S=def();save();location.reload()}}

function celebrate(title,xp){if(!S.settings.motion){toast(`${title}${xp?' · +'+xp+' XP':''}`);return}$('#celebrationTitle').textContent=title;$('#celebrationXp').textContent=xp?`+${xp} XP · ${Math.max(1,Math.round(xp/5))} crédits`:'Tu l’as mérité.';$('#celebration').classList.remove('hidden');successSound(true);if(window.gsap)gsap.from('.celebration-card',{scale:.72,opacity:0,y:35,duration:.65,ease:'back.out(1.7)'});confetti()}
function closeCelebration(){$('#celebration').classList.add('hidden')}
function confetti(){const c=$('#confetti'),ctx=c.getContext('2d'),d=devicePixelRatio||1;c.width=innerWidth*d;c.height=innerHeight*d;ctx.scale(d,d);const colors=['#91f7c2','#f4f7f5','#ffb45c'],p=[...Array(75)].map(()=>({x:innerWidth/2,y:innerHeight*.42,vx:(Math.random()-.5)*10,vy:-Math.random()*9-3,g:.22,r:Math.random()*5+2,a:1,c:colors[Math.floor(Math.random()*colors.length)]}));let frame=0;function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);p.forEach(o=>{o.x+=o.vx;o.y+=o.vy;o.vy+=o.g;o.a-=.012;ctx.globalAlpha=Math.max(0,o.a);ctx.fillStyle=o.c;ctx.fillRect(o.x,o.y,o.r,o.r*1.8)});ctx.globalAlpha=1;if(frame++<95)requestAnimationFrame(draw)}draw()}
init();
