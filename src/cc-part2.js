(()=>{ 'use strict';

/* ============================================================
   Cuentas Claras — motor de datos
   Dinero: enteros en centavos. Fechas: 'YYYY-MM-DD' local.
   ============================================================ */

const $  = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id'+Date.now()+Math.random().toString(36).slice(2,8));

/* ---------- Monedas ---------- */
const CURRENCIES = [
  ['USD','Dólar estadounidense','en-US'], ['EUR','Euro','es-ES'], ['MXN','Peso mexicano','es-MX'],
  ['COP','Peso colombiano','es-CO'], ['ARS','Peso argentino','es-AR'], ['CLP','Peso chileno','es-CL'],
  ['PEN','Sol peruano','es-PE'], ['VES','Bolívar venezolano','es-VE'], ['BOB','Boliviano','es-BO'],
  ['UYU','Peso uruguayo','es-UY'], ['PYG','Guaraní paraguayo','es-PY'], ['GTQ','Quetzal guatemalteco','es-GT'],
  ['HNL','Lempira hondureño','es-HN'], ['NIO','Córdoba nicaragüense','es-NI'], ['CRC','Colón costarricense','es-CR'],
  ['PAB','Balboa panameño','es-PA'], ['DOP','Peso dominicano','es-DO'], ['BRL','Real brasileño','pt-BR'],
  ['GBP','Libra esterlina','en-GB'], ['CAD','Dólar canadiense','en-CA'],
];
const curLocale = c => (CURRENCIES.find(x=>x[0]===c)||[,,'es'])[2];

let _fmt=null,_fmtKey='';
function moneyFmt(){
  const k = DB.settings.currency;
  if(_fmtKey!==k){ _fmt = new Intl.NumberFormat(curLocale(k), {style:'currency', currency:k}); _fmtKey=k; }
  return _fmt;
}
const curDecimals = ()=> moneyFmt().resolvedOptions().maximumFractionDigits;
function fmtMoney(cents, {sign=false}={}){
  const v = cents/100;
  const s = moneyFmt().format(Math.abs(v));
  if(sign) return (cents<0?'−':'+') + s;
  return cents<0 ? '−'+s : s;
}
function decSep(){ return new Intl.NumberFormat(curLocale(DB.settings.currency)).format(1.1).replace(/\d/g,''); }
function milSep(){ return new Intl.NumberFormat(curLocale(DB.settings.currency)).format(1000).replace(/\d/g,'') || '.'; }
function fmtCompact(cents){
  const v = Math.abs(cents/100); const neg = cents<0?'−':'';
  const d = decSep();
  const f = (n)=>{ const s=(Math.round(n*10)/10).toFixed(1).replace('.',d); return s.endsWith(d+'0')?s.slice(0,-2):s; };
  if(v>=1e6) return neg+f(v/1e6)+' M';
  if(v>=1e4) return neg+f(v/1e3)+' k';
  return neg+new Intl.NumberFormat(curLocale(DB.settings.currency),{maximumFractionDigits:0}).format(v);
}
/* número plano para CSV (coma o punto según locale, sin agrupar) */
function plainNum(cents){
  const dd = 2;
  let s = (cents/100).toFixed(dd);
  if(decSep()===',') s = s.replace('.',',');
  return s;
}

/* ---------- Fechas (siempre locales) ---------- */
const p2 = n => String(n).padStart(2,'0');
const dateKey = d => `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
const todayKey = () => dateKey(new Date());
const parseKey = k => { const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); };
const monthOf = k => k.slice(0,7);
const thisMonth = () => todayKey().slice(0,7);
const daysInMonth = ym => { const [y,m]=ym.split('-').map(Number); return new Date(y,m,0).getDate(); };
const addMonths = (ym,n) => { const [y,m]=ym.split('-').map(Number); const d=new Date(y,m-1+n,1); return `${d.getFullYear()}-${p2(d.getMonth()+1)}`; };
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_AB = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS_AB = ['dom','lun','mar','mié','jue','vie','sáb'];
function monthLabel(ym,short=false){ const [y,m]=ym.split('-').map(Number); const name = short?MESES_AB[m-1]:MESES[m-1]; const yy = (y===new Date().getFullYear()&&!short)?'':' '+(short?String(y).slice(2):y); return short? name+(y===new Date().getFullYear()?'':' '+String(y).slice(2)) : name.charAt(0).toUpperCase()+name.slice(1)+yy; }
function dayLabel(k){
  const t=todayKey();
  if(k===t) return 'Hoy';
  const y=new Date(); y.setDate(y.getDate()-1);
  if(k===dateKey(y)) return 'Ayer';
  const d=parseKey(k);
  return `${DIAS_AB[d.getDay()]} ${d.getDate()} ${MESES_AB[d.getMonth()]}${d.getFullYear()!==new Date().getFullYear()?' '+d.getFullYear():''}`;
}
function shortDate(k){ const d=parseKey(k); return `${d.getDate()} ${MESES_AB[d.getMonth()]}`; }

/* ---------- Categorías por defecto ---------- */
/* color = índice de --c0..--c12 ; grupo: nec/des/aho (gasto) · base/aho/excl (ingreso) */
const DEFAULT_CATS = [
  {id:'c_super', nombre:'Supermercado',  emoji:'🛒', color:2,  tipo:'g', grupo:'nec'},
  {id:'c_rest',  nombre:'Restaurantes',  emoji:'🍔', color:1,  tipo:'g', grupo:'des'},
  {id:'c_trans', nombre:'Transporte',    emoji:'🚌', color:6,  tipo:'g', grupo:'nec'},
  {id:'c_hogar', nombre:'Hogar',         emoji:'🏠', color:0,  tipo:'g', grupo:'nec'},
  {id:'c_serv',  nombre:'Servicios',     emoji:'💡', color:3,  tipo:'g', grupo:'nec'},
  {id:'c_subs',  nombre:'Suscripciones', emoji:'📱', color:8,  tipo:'g', grupo:'des'},
  {id:'c_salud', nombre:'Salud',         emoji:'💊', color:7,  tipo:'g', grupo:'nec'},
  {id:'c_edu',   nombre:'Educación',     emoji:'🎓', color:9,  tipo:'g', grupo:'nec'},
  {id:'c_ocio',  nombre:'Ocio',          emoji:'🎬', color:4,  tipo:'g', grupo:'des'},
  {id:'c_ropa',  nombre:'Ropa',          emoji:'👕', color:11, tipo:'g', grupo:'des'},
  {id:'c_regalo',nombre:'Regalos',       emoji:'🎁', color:10, tipo:'g', grupo:'des'},
  {id:'c_ahorro',nombre:'Ahorro e inversión', emoji:'💰', color:5, tipo:'g', grupo:'aho'},
  {id:'c_otros', nombre:'Otros',         emoji:'📦', color:-1, tipo:'g', grupo:'des', fija:true},
  {id:'i_sal',   nombre:'Salario',       emoji:'💼', color:2,  tipo:'i', grupo:'base'},
  {id:'i_free',  nombre:'Freelance y negocio', emoji:'💻', color:0, tipo:'i', grupo:'base'},
  {id:'i_bono',  nombre:'Bono',          emoji:'🎉', color:3,  tipo:'i', grupo:'base'},
  {id:'i_inv',   nombre:'Rendimientos',  emoji:'🏦', color:5,  tipo:'i', grupo:'aho'},
  {id:'i_reg',   nombre:'Regalo recibido', emoji:'🎁', color:10, tipo:'i', grupo:'base'},
  {id:'i_reemb', nombre:'Reembolso y otros', emoji:'💸', color:-1, tipo:'i', grupo:'excl', fija:true},
];
const catColorVar = c => c.color<0 ? 'var(--cx)' : `var(--c${c.color})`;

/* ---------- Estado ---------- */
const LS_KEY = 'cuentas-claras-v1';
let DB = null;
let storageOK = true;

function freshDB(){
  return {
    v:1,
    settings:{ currency:null, theme:'auto', onboarded:false, lastAccount:'a_efec', lastExport:null, budgetsTouched:false, celebradas:[] },
    accounts:[ {id:'a_efec', nombre:'Efectivo', emoji:'💵', saldoInicial:0, archivada:false} ],
    cats: DEFAULT_CATS.map(c=>({...c})),
    tx:[],
    budgets:{},           /* {'YYYY-MM': {catId:cents}} */
    metas:[],             /* {id,nombre,emoji,objetivo,fechaLimite,creado,demo} */
    fijos:[],             /* {id,tipo,monto,cat,cuenta,dia,nota,activo,nextDue,demo} */
    usage:{},             /* catId -> veces usada (para ordenar la grilla) */
  };
}
function loadDB(){
  let raw=null;
  try{
    raw = localStorage.getItem(LS_KEY);
    localStorage.setItem('cc-probe','1'); localStorage.removeItem('cc-probe');
  }catch(e){ storageOK = false; }
  if(raw){
    try{ DB = migrate(JSON.parse(raw)); }
    catch(e){
      DB = freshDB();
      try{ localStorage.setItem(LS_KEY+'-rescate', raw); }catch(_){}
      setTimeout(()=>snack('Tus datos guardados estaban dañados; se guardó una copia de rescate.', null, null, 8000), 600);
    }
  }
  DB = DB || freshDB();
}
function migrate(db){
  /* Sanea TODO lo que entra (localStorage o respaldo importado): ids, emojis,
     montos, fechas y referencias. Es la única frontera de confianza. */
  const base = freshDB();
  const sid = v => String(v??'').replace(/[^\w.-]/g,'').slice(0,40);
  const stx = (v,n) => String(v??'').replace(/[<>&"'`=]/g,'').slice(0,n);  /* solo para lo que se pinta crudo (emoji) */
  const txt = (v,n) => String(v??'').slice(0,n);                            /* nombres y notas: esc() al renderizar */
  const fecha = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v||'')) ? String(v) : null;
  const cents = v => { const n=Math.round(+v); return Number.isFinite(n)? n : 0; };
  db = (db && typeof db==='object') ? db : {};
  db.settings = {...base.settings, ...(db.settings||{})};
  if(!Array.isArray(db.settings.celebradas)) db.settings.celebradas=[];
  if(!(typeof db.settings.currency==='string' && CURRENCIES.some(c=>c[0]===db.settings.currency))) db.settings.currency=null;
  db.settings.theme = ['auto','light','dark'].includes(db.settings.theme)? db.settings.theme : 'auto';
  for(const k of ['accounts','cats','tx','metas','fijos']) if(!Array.isArray(db[k])) db[k]=[];
  db.accounts = db.accounts.filter(a=>a&&typeof a==='object').map(a=>({
    id:sid(a.id)||uid(), nombre:txt(a.nombre,24)||'Cuenta', emoji:stx(a.emoji,8)||'💵',
    saldoInicial:cents(a.saldoInicial), archivada:!!a.archivada }));
  if(!db.accounts.length) db.accounts.push({id:'a_efec', nombre:'Efectivo', emoji:'💵', saldoInicial:0, archivada:false});
  db.cats = db.cats.filter(c=>c&&typeof c==='object').map(c=>({
    id:sid(c.id)||uid(), nombre:txt(c.nombre,26)||'Categoría', emoji:stx(c.emoji,8)||'🏷️',
    color:(Number.isInteger(c.color)&&c.color>=0&&c.color<=11)? c.color : -1,
    tipo:c.tipo==='i'?'i':'g', grupo:['nec','des','aho','base','excl'].includes(c.grupo)? c.grupo : (c.tipo==='i'?'base':'des'),
    fija:!!c.fija, archivada:!!c.archivada }));
  for(const dc of DEFAULT_CATS) if(!db.cats.some(c=>c.id===dc.id)) db.cats.push({...dc});
  const accIds = new Set(db.accounts.map(a=>a.id));
  const catIds = new Set(db.cats.map(c=>c.id));
  db.tx = db.tx.filter(x=>x&&typeof x==='object').map(x=>({
    id:sid(x.id)||uid(), tipo:['g','i','t'].includes(x.tipo)? x.tipo:'g',
    monto:Math.abs(cents(x.monto)), fecha:fecha(x.fecha),
    cat: x.cat==null? null : sid(x.cat),
    cuenta:sid(x.cuenta), cuentaDestino: x.cuentaDestino!=null? sid(x.cuentaDestino):undefined,
    nota:txt(x.nota,140), creado:Number.isFinite(+x.creado)? +x.creado : 0,
    metaId: x.metaId!=null? sid(x.metaId):undefined, fijoId: x.fijoId!=null? sid(x.fijoId):undefined,
    demo: x.demo? true:undefined,
  })).filter(x=> x.monto>0 && x.fecha
    && (x.tipo!=='t' || (accIds.has(x.cuenta) && accIds.has(x.cuentaDestino) && x.cuenta!==x.cuentaDestino)));
  for(const x of db.tx){
    if(!accIds.has(x.cuenta)) x.cuenta = db.accounts[0].id;
    if(x.tipo==='t') x.cat=null;
    else if(x.cat==null || !catIds.has(x.cat)) x.cat = x.tipo==='g'?'c_otros':'i_reemb';
  }
  db.tx.sort((a,b)=> a.fecha===b.fecha ? ((a.creado||0)-(b.creado||0)) : (a.fecha<b.fecha?-1:1));
  db.metas = db.metas.filter(m=>m&&typeof m==='object'&&cents(m.objetivo)>0).map(m=>({
    id:sid(m.id)||uid(), nombre:txt(m.nombre,30)||'Meta', emoji:stx(m.emoji,8)||'🎯',
    objetivo:cents(m.objetivo), fechaLimite:fecha(m.fechaLimite), creado:Number.isFinite(+m.creado)? +m.creado : Date.now(),
    demo:m.demo?true:undefined }));
  db.fijos = db.fijos.filter(f=>f&&typeof f==='object'&&cents(f.monto)>0).map(f=>({
    id:sid(f.id)||uid(), tipo:f.tipo==='i'?'i':'g', monto:cents(f.monto),
    cat: catIds.has(sid(f.cat))? sid(f.cat) : 'c_otros',
    cuenta: accIds.has(sid(f.cuenta))? sid(f.cuenta) : db.accounts[0].id,
    dia:Math.min(31,Math.max(1,Math.round(+f.dia)||1)), nota:txt(f.nota,40),
    activo:f.activo!==false, nextDue:fecha(f.nextDue), demo:f.demo?true:undefined }));
  const bClean={};
  if(db.budgets && typeof db.budgets==='object' && !Array.isArray(db.budgets))
    for(const [ym,map] of Object.entries(db.budgets)){
      if(!/^\d{4}-\d{2}$/.test(ym) || !map || typeof map!=='object' || Array.isArray(map)) continue;
      const m2={};
      for(const [k,v] of Object.entries(map)){ const kk=sid(k); if(catIds.has(kk) && cents(v)>0) m2[kk]=cents(v); }
      if(Object.keys(m2).length) bClean[ym]=m2;
    }
  db.budgets=bClean;
  const u2={};
  if(db.usage && typeof db.usage==='object')
    for(const [k,v] of Object.entries(db.usage)){ const kk=sid(k); if(catIds.has(kk)) u2[kk]=Math.max(0,Math.round(+v)||0); }
  db.usage=u2;
  if(!db.accounts.some(a=>a.id===db.settings.lastAccount)) db.settings.lastAccount = db.accounts[0].id;
  return db;
}
let _saveT=null;
function save(){
  if(!storageOK) return;
  clearTimeout(_saveT);
  _saveT = setTimeout(()=>{
    try{ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }
    catch(e){ storageOK=false; snack('No se pudo guardar en este navegador. Exporta un respaldo.', null, null, 8000); try{ render(); }catch(_){} }
  }, 250);
}
function flushSave(){
  if(!storageOK || !DB) return;
  clearTimeout(_saveT);
  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }catch(e){}
}
addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) flushSave(); });

/* ---------- Consultas básicas ---------- */
const cats = tipo => DB.cats.filter(c=>!c.archivada && (!tipo || c.tipo===tipo));
const cat = id => DB.cats.find(c=>c.id===id) || DB.cats.find(c=>c.id==='c_otros');
const account = id => DB.accounts.find(a=>a.id===id) || DB.accounts[0];
const activeAccounts = ()=> DB.accounts.filter(a=>!a.archivada);
const txOfMonth = ym => DB.tx.filter(t=>monthOf(t.fecha)===ym);
const inRange = (t,d1,d2) => t.fecha>=d1 && t.fecha<=d2;

function sumTipo(list, tipo){ return list.reduce((s,t)=>s+(t.tipo===tipo?t.monto:0),0); }
function gastosMes(ym){ return sumTipo(txOfMonth(ym),'g'); }
function ingresosMes(ym){ return sumTipo(txOfMonth(ym),'i'); }
function ingresosBase(list){
  return list.reduce((s,t)=>s+((t.tipo==='i' && cat(t.cat).grupo!=='excl')?t.monto:0),0);
}
function porCategoria(list, tipo='g'){
  const m = new Map();
  for(const t of list) if(t.tipo===tipo){ const id=cat(t.cat).id; m.set(id,(m.get(id)||0)+t.monto); }
  return [...m.entries()].map(([id,total])=>({cat:cat(id),total})).sort((a,b)=>b.total-a.total);
}
function accountBalance(id){
  let s = account(id).saldoInicial;
  for(const t of DB.tx){
    if(t.tipo==='g' && t.cuenta===id) s-=t.monto;
    else if(t.tipo==='i' && t.cuenta===id) s+=t.monto;
    else if(t.tipo==='t'){ if(t.cuenta===id) s-=t.monto; if(t.cuentaDestino===id) s+=t.monto; }
  }
  return s;
}
function totalBalance(){ return activeAccounts().reduce((s,a)=>s+accountBalance(a.id),0); }

/* acumulado diario de gastos de un mes → [{d,acum}] hasta 'hasta' (día) */
function acumuladoDiario(ym, hastaDia){
  const dim = daysInMonth(ym);
  const lim = Math.min(hastaDia||dim, dim);
  const perDay = new Array(dim+1).fill(0);
  for(const t of txOfMonth(ym)) if(t.tipo==='g') perDay[+t.fecha.slice(8,10)] += t.monto;
  const out=[]; let acc=0;
  for(let d=1; d<=lim; d++){ acc+=perDay[d]; out.push({d, acum:acc}); }
  return out;
}
/* serie mensual [{ym, ing, gas}] últimos n meses (incluye actual) */
function serieMensual(n){
  const out=[]; const cur=thisMonth();
  for(let i=n-1;i>=0;i--){ const ym=addMonths(cur,-i); out.push({ym, ing:ingresosMes(ym), gas:gastosMes(ym)}); }
  return out;
}

/* ---------- Presupuestos (con herencia mensual) ---------- */
function effectiveBudget(ym){
  if(DB.budgets[ym]) return {map:DB.budgets[ym], heredado:null};
  for(let i=1;i<=36;i++){
    const k = addMonths(ym,-i);
    if(DB.budgets[k]) return {map:DB.budgets[k], heredado:k};
  }
  return {map:{}, heredado:null};
}
function setBudget(ym, catId, cents){
  const eff = effectiveBudget(ym);
  if(!DB.budgets[ym]) DB.budgets[ym] = {...eff.map};
  if(cents>0) DB.budgets[ym][catId]=cents; else delete DB.budgets[ym][catId];
  DB.settings.budgetsTouched = true;
  save();
}
function budgetTotal(ym){ const {map}=effectiveBudget(ym); return Object.values(map).reduce((a,b)=>a+b,0); }
function gastoCat(ym, catId){ return txOfMonth(ym).reduce((s,t)=>s+((t.tipo==='g'&&t.cat===catId)?t.monto:0),0); }
/* redondeo amable para sugerencias */
function niceRound(cents){
  if(cents<=0) return 0;
  const v=cents/100;
  const mag = v>=100000?10000: v>=10000?1000: v>=1000?100: v>=100?10:1;
  return Math.ceil(v/mag)*mag*100;
}
function sugerirPresupuesto(ym){
  const prev3 = [1,2,3].map(i=>addMonths(ym,-i));
  const sug = {};
  for(const c of cats('g')){
    if(c.id==='c_ahorro') continue;
    const tot = prev3.reduce((s,m)=>s+gastoCat(m,c.id),0);
    const meses = prev3.filter(m=>txOfMonth(m).length>0).length || 1;
    const avg = tot/meses;
    if(avg>0) sug[c.id]=niceRound(avg);
  }
  return sug;
}

/* ---------- Insights ---------- */
function insightsMes(ym){
  const t = todayKey(); const esActual = ym===thisMonth();
  const dia = esActual ? +t.slice(8,10) : daysInMonth(ym);
  const dim = daysInMonth(ym);
  const gas = gastosMes(ym);
  const promDiario = dia>0 ? Math.round(gas/dia) : 0;
  const proy = esActual ? gas + promDiario*(dim-dia) : gas;
  const prevYm = addMonths(ym,-1);
  const prevAlDia = txOfMonth(prevYm).reduce((s,x)=>s+((x.tipo==='g'&&+x.fecha.slice(8,10)<=Math.min(dia,daysInMonth(prevYm)))?x.monto:0),0);
  const bt = budgetTotal(ym);
  const paraHoy = (esActual && bt>0) ? Math.max(0, Math.round((bt-gas)/Math.max(1,(dim-dia+1)))) : null;
  return {gas, promDiario, proy, prevAlDia, budget:bt, paraHoy, dia, dim};
}
function racha(){
  const dias = new Set(DB.tx.filter(t=>!t.demo && t.creado).map(t=>dateKey(new Date(t.creado))));
  let n=0; const d=new Date();
  if(!dias.has(dateKey(d))) d.setDate(d.getDate()-1);   /* la racha no se rompe hasta acabar el día */
  while(dias.has(dateKey(d))){ n++; d.setDate(d.getDate()-1); }
  return n;
}

/* ---------- Movimientos ---------- */
function addTx({tipo, monto, cat:catId, cuenta, cuentaDestino, fecha, nota, metaId, fijoId, demo, auto}){
  const tx = {
    id:uid(), tipo, monto:Math.round(monto),
    cat: tipo==='t' ? null : (catId || (tipo==='g'?'c_otros':'i_reemb')),
    cuenta: cuenta || DB.settings.lastAccount || DB.accounts[0].id,
    fecha: fecha || todayKey(),
    nota: (nota||'').slice(0,140),
    creado: Date.now(),
  };
  if(tipo==='t') tx.cuentaDestino = cuentaDestino;
  if(metaId) tx.metaId = metaId;
  if(fijoId) tx.fijoId = fijoId;
  if(demo) tx.demo = true;
  DB.tx.push(tx);
  DB.tx.sort((a,b)=> a.fecha===b.fecha ? (a.creado-b.creado) : (a.fecha<b.fecha?-1:1));
  if(!auto){
    if(tx.cat) DB.usage[tx.cat]=(DB.usage[tx.cat]||0)+1;
    DB.settings.lastAccount = tx.cuenta;
  }
  save();
  return tx;
}
function updateTx(id, patch){
  const t = DB.tx.find(x=>x.id===id); if(!t) return;
  Object.assign(t, patch);
  DB.tx.sort((a,b)=> a.fecha===b.fecha ? ((a.creado||0)-(b.creado||0)) : (a.fecha<b.fecha?-1:1));
  save();
}
function deleteTx(id){
  const i = DB.tx.findIndex(x=>x.id===id); if(i<0) return null;
  const [t] = DB.tx.splice(i,1); save(); return t;
}
function restoreTx(t){ if(DB.tx.some(x=>x.id===t.id)) return; DB.tx.push(t); DB.tx.sort((a,b)=> a.fecha===b.fecha ? ((a.creado||0)-(b.creado||0)) : (a.fecha<b.fecha?-1:1)); save(); }

/* ---------- Fijos (recurrentes) ---------- */
function nextDueFrom(dia, fromKey){
  const from = parseKey(fromKey);
  const mk = `${from.getFullYear()}-${p2(from.getMonth()+1)}`;
  const dim = daysInMonth(mk);
  if(Math.min(dia,dim) > from.getDate()) return `${mk}-${p2(Math.min(dia,dim))}`;
  const nm = addMonths(mk,1);
  return `${nm}-${p2(Math.min(dia,daysInMonth(nm)))}`;
}
function postFijos(){
  const hoy = todayKey(); let n=0;
  for(const f of DB.fijos){
    if(!f.activo) continue;
    let guard=0;
    while(f.nextDue && f.nextDue<=hoy && guard++<60){
      addTx({tipo:f.tipo, monto:f.monto, cat:f.cat, cuenta:f.cuenta, fecha:f.nextDue, nota:f.nota, fijoId:f.id, demo:f.demo, auto:true});
      const after = addMonths(monthOf(f.nextDue),1);
      f.nextDue = `${after}-${p2(Math.min(f.dia,daysInMonth(after)))}`;
      n++;
    }
  }
  if(n>0){ save(); toast(`Se registraron ${n} movimiento${n>1?'s':''} fijo${n>1?'s':''} 🔁`); }
  return n;
}

/* ---------- Metas ---------- */
function metaProgreso(m){
  let s=0;
  for(const t of DB.tx) if(t.metaId===m.id) s += t.tipo==='g'? t.monto : -t.monto;
  return Math.max(0,s);
}
function metaAporteSugerido(m){
  if(!m.fechaLimite) return null;
  const falta = m.objetivo - metaProgreso(m);
  if(falta<=0) return 0;
  const hoy=parseKey(todayKey()), lim=parseKey(m.fechaLimite);
  const meses = Math.max(1, (lim.getFullYear()-hoy.getFullYear())*12 + (lim.getMonth()-hoy.getMonth()) + (lim.getDate()>=hoy.getDate()?0: -1) + 1);
  return Math.ceil(falta/meses);
}

/* ---------- Exportar / importar ---------- */
async function saveFile(filename, data, kind, reintento){
  if(window.claude?.downloads){
    try{
      await window.claude.downloads.save({filename, data});
      DB.settings.lastExport = Date.now(); save();
      toast('Respaldo guardado ✓');
      return;
    }catch(e){
      if(e?.code==='declined') return;
      if(e?.code==='extension_not_enabled' && !reintento){ return saveFile(filename+'.txt', data, kind, true); }
      if(e?.code==='rate_limited'){ toast('Espera un momento e intenta de nuevo.'); return; }
      /* cae al plan B con Blob */
    }
  }
  const blob = new Blob([data], {type: kind||'application/octet-stream'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 800);
  DB.settings.lastExport = Date.now(); save();
}
function exportJSON(){
  const data = JSON.stringify({app:'cuentas-claras', exportado:new Date().toISOString(), db:DB}, null, 1);
  saveFile(`cuentas-claras-respaldo-${todayKey()}.json`, data, 'application/json');
}
function exportCSV(){
  const sep = decSep()===',' ? ';' : ',';
  const rows=[['fecha','tipo','categoria','cuenta','cuenta_destino','nota','monto','moneda','id']];
  for(const t of [...DB.tx].sort((a,b)=>a.fecha<b.fecha?-1:1)){
    const tipo = t.tipo==='g'?'gasto':t.tipo==='i'?'ingreso':'transferencia';
    const catN = t.tipo==='t' ? 'Transferencia' : cat(t.cat).nombre;
    const monto = plainNum(t.tipo==='g' ? -t.monto : t.monto);
    rows.push([t.fecha, tipo, catN, account(t.cuenta).nombre, t.tipo==='t'?account(t.cuentaDestino).nombre:'', t.nota||'', monto, DB.settings.currency, t.id]);
  }
  const csv = '\uFEFF'+rows.map(r=>r.map(c=>{ c=String(c); return (c.includes(sep)||c.includes('"')||c.includes('\n')) ? '"'+c.replace(/"/g,'""')+'"' : c; }).join(sep)).join('\r\n');
  saveFile(`cuentas-claras-movimientos-${todayKey()}.csv`, csv, 'text/csv');
}
function importJSON(file, modo){
  const rd = new FileReader();
  rd.onload = ()=>{
    try{
      const obj = JSON.parse(rd.result);
      const db = obj.db || obj;
      if(!Array.isArray(db.tx) || !db.settings) throw new Error('formato');
      if(modo==='replace'){
        DB = migrate(db);
      }else{
        if(db.settings?.currency && DB.settings.currency && db.settings.currency!==DB.settings.currency){
          toast(`El respaldo está en ${db.settings.currency} y tus datos en ${DB.settings.currency}. Usa «Reemplazar» para no mezclar monedas.`);
          return;
        }
        const ids = new Set(DB.tx.map(t=>t.id));
        for(const t of db.tx) if(!ids.has(t.id)) DB.tx.push(t);
        for(const c of db.cats||[]) if(!DB.cats.some(x=>x.id===c.id)) DB.cats.push(c);
        for(const a of db.accounts||[]) if(!DB.accounts.some(x=>x.id===a.id)) DB.accounts.push(a);
        for(const m of db.metas||[]) if(!DB.metas.some(x=>x.id===m.id)) DB.metas.push(m);
        for(const f of db.fijos||[]) if(!DB.fijos.some(x=>x.id===f.id)) DB.fijos.push(f);
        for(const [ym,map] of Object.entries(db.budgets||{})) if(!DB.budgets[ym]) DB.budgets[ym]=map;
        DB = migrate(DB);
      }
      save(); render();
      toast('Datos importados ✓');
    }catch(e){ toast('El archivo no es un respaldo válido de Cuentas Claras.'); }
  };
  rd.readAsText(file);
}

/* ---------- Datos de ejemplo ---------- */
function mulberry(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function cargarDemo(){
  if(DB.tx.some(t=>t.demo)) return;
  const R = mulberry(20260803);
  const hoyD = parseKey(todayKey());
  const K = curDecimals()===0 ? 10000 : 100;          /* magnitudes razonables por moneda */
  const push=(y,mo,d,tipo,monto,catId,nota)=>{
    const dim=new Date(y,mo+1,0).getDate();
    const dk=dateKey(new Date(y,mo,Math.min(d,dim)));
    if(dk>todayKey()) return null;
    let m=Math.round(monto); if(curDecimals()===0) m=Math.round(m/100)*100;
    const tx=addTx({tipo, monto:m, cat:catId, fecha:dk, nota:nota||'', demo:true, auto:true});
    tx.creado=parseKey(dk).getTime()+10*3600e3; return tx;
  };
  const meses=[];
  for(let m=2;m>=0;m--){ const b=new Date(hoyD.getFullYear(),hoyD.getMonth()-m,1); meses.push([b.getFullYear(),b.getMonth()]); }
  for(const [y,mo] of meses){
    push(y,mo,1,'i',1400*K,'i_sal','Pago de nómina');
    if(R()<.75) push(y,mo,12+Math.floor(R()*6),'i',(120+R()*180)*K,'i_free','Proyecto freelance');
    push(y,mo,2,'g',480*K,'c_hogar','Alquiler');
    push(y,mo,5,'g',(60+R()*25)*K,'c_serv','Luz y agua');
    push(y,mo,6,'g',32*K,'c_serv','Internet');
    push(y,mo,9,'g',11*K,'c_subs','Streaming');
    for(let w=0;w<4;w++){
      push(y,mo,3+w*7,'g',(55+R()*40)*K,'c_super','Mercado semanal');
      if(R()<.8) push(y,mo,4+w*7,'g',(9+R()*18)*K,'c_rest',['Almuerzo','Café con amigos','Pizza','Sushi'][Math.floor(R()*4)]);
      if(R()<.7) push(y,mo,5+w*7,'g',(4+R()*9)*K,'c_trans',['Bus','Gasolina','Taxi'][Math.floor(R()*3)]);
      if(R()<.4) push(y,mo,6+w*7,'g',(10+R()*25)*K,'c_ocio',['Cine','Concierto','Videojuego'][Math.floor(R()*3)]);
    }
    if(R()<.6) push(y,mo,15,'g',(20+R()*45)*K,'c_ropa','Compras');
    if(R()<.5) push(y,mo,18,'g',(15+R()*30)*K,'c_salud','Farmacia');
    if(R()<.35) push(y,mo,21,'g',(15+R()*30)*K,'c_regalo','Regalo cumpleaños');
  }
  const meta = {id:uid(), nombre:'Vacaciones', emoji:'🏖️', objetivo:1200*K, fechaLimite:addMonths(thisMonth(),5)+'-15', creado:Date.now(), demo:true};
  DB.metas.push(meta);
  { const [y1,m1]=meses[1], [y2,m2]=meses[2];
    const a1=push(y1,m1,3,'g',150*K,'c_ahorro','Abono meta'); if(a1) a1.metaId=meta.id;
    const a2=push(y2,m2,3,'g',150*K,'c_ahorro','Abono meta'); if(a2) a2.metaId=meta.id; }
  if(Object.keys(DB.budgets).length===0){
    DB.budgets[thisMonth()] = {c_super:280*K, c_rest:120*K, c_trans:60*K, c_hogar:500*K, c_serv:110*K, c_subs:20*K, c_ocio:80*K, c_ropa:60*K, c_salud:60*K};
    DB.settings.demoBudget = true;
  }
  if(!DB.fijos.some(f=>f.demo)){
    DB.fijos.push({id:uid(), tipo:'g', monto:480*K, cat:'c_hogar', cuenta:DB.accounts[0].id, dia:2, nota:'Alquiler', activo:true, nextDue:nextDueFrom(2, todayKey()), demo:true});
  }
  save();
}
function quitarDemo(){
  DB.tx = DB.tx.filter(t=>!t.demo);
  DB.metas = DB.metas.filter(m=>!m.demo);
  DB.fijos = DB.fijos.filter(f=>!f.demo);
  if(DB.settings.demoBudget && !DB.settings.budgetsTouched) DB.budgets={};
  delete DB.settings.demoBudget;
  save();
}
const hayDemo = ()=> DB.tx.some(t=>t.demo) || DB.metas.some(m=>m.demo) || DB.fijos.some(f=>f.demo);

/* ---------- Snackbar / toast / undo ---------- */
function snack(msg, actionLabel, fn, ms=6000){
  const wrap = $('#snackwrap');
  const el = document.createElement('div');
  el.className='snack';
  const span = document.createElement('span'); span.textContent = msg; el.appendChild(span);
  if(actionLabel){
    const b=document.createElement('button'); b.textContent=actionLabel;
    b.onclick=()=>{ fn&&fn(); kill(); };
    el.appendChild(b);
  }
  wrap.appendChild(el);
  const kill=()=>{ el.classList.add('bye'); setTimeout(()=>el.remove(),220); };
  setTimeout(kill, ms);
}
const toast = m => snack(m, null, null, 3200);
