
/* ============================================================
   Piezas compartidas de vistas
   ============================================================ */
const view=$('#view');
const fmtKpi = c => Math.abs(c) >= 1e9 ? fmtCompact(c) : fmtMoney(c);
function movLabel(t){
  if(t.tipo==='t') return `${account(t.cuenta).nombre} → ${account(t.cuentaDestino).nombre}`;
  return cat(t.cat).nombre;
}
function buildMovRow(t){
  const b=document.createElement('button'); b.className='mov';
  const c = t.tipo==='t'? null : cat(t.cat);
  b.style.setProperty('--catc', c? catColorVar(c) : 'var(--muted)');
  const emoji = t.tipo==='t' ? '🔁' : c.emoji;
  const extras=[];
  if(t.tipo!=='t' && activeAccounts().length>1) extras.push(`${account(t.cuenta).emoji} ${account(t.cuenta).nombre}`);
  if(t.fijoId) extras.push('fijo 🔁');
  if(t.metaId){ const m=DB.metas.find(x=>x.id===t.metaId); if(m) extras.push(`meta ${m.emoji}`); }
  const sub=[t.nota, extras.join(' · ')].filter(Boolean).join(' · ');
  b.innerHTML=`<span class="emo">${emoji}</span>
    <span class="mid">
      <span class="t1"><span class="nm">${esc(movLabel(t))}</span>${t.demo?'<span class="badge">ejemplo</span>':''}</span>
      ${sub?`<span class="t2">${esc(sub)}</span>`:''}
    </span>
    <span class="amt num ${t.tipo}">${t.tipo==='g'?'−':t.tipo==='i'?'+':''}${fmtMoney(t.monto).replace('−','')}</span>`;
  b.onclick=()=>sheetMov(t);
  return b;
}
function listMovs(container, list){
  let day=null;
  for(const t of list){
    if(t.fecha!==day){
      day=t.fecha;
      const dayTx=list.filter(x=>x.fecha===day);
      const net=dayTx.reduce((s,x)=>s+(x.tipo==='g'?-x.monto:x.tipo==='i'?x.monto:0),0);
      const h=document.createElement('div'); h.className='dayhead';
      h.innerHTML=`<span>${esc(dayLabel(day))}</span><span class="tot num">${net===0?'':fmtMoney(net,{sign:true})}</span>`;
      container.appendChild(h);
    }
    container.appendChild(buildMovRow(t));
  }
}
function monthNav(ym, onChange, {max=thisMonth()}={}){
  const el=document.createElement('div'); el.className='monthnav';
  const prev=document.createElement('button'); prev.innerHTML=ICONS.chevL; prev.setAttribute('aria-label','Mes anterior');
  const next=document.createElement('button'); next.innerHTML=ICONS.chevR; next.setAttribute('aria-label','Mes siguiente');
  const lbl=document.createElement('span'); lbl.className='m'; lbl.textContent=monthLabel(ym);
  prev.onclick=()=>onChange(addMonths(ym,-1));
  next.onclick=()=>onChange(addMonths(ym,1));
  if(max && ym>=max) next.style.visibility='hidden';
  el.append(prev,lbl,next);
  return el;
}
function bannerZone(box){
  if(!storageOK){
    const d=document.createElement('div'); d.className='demobar'; d.style.borderColor='color-mix(in srgb,var(--crit) 40%,var(--border))';
    d.innerHTML=`<span>⚠️</span><span class="sp">Este navegador no permite guardar datos: al cerrar se perderán. Exporta un respaldo.</span>`;
    const btn=document.createElement('button'); btn.textContent='Exportar'; btn.onclick=exportJSON; d.appendChild(btn);
    box.appendChild(d);
  }
  if(hayDemo()){
    const d=document.createElement('div'); d.className='demobar';
    d.innerHTML=`<span>🧪</span><span class="sp">Estás viendo datos de ejemplo.</span>`;
    const btn=document.createElement('button'); btn.textContent='Quitar ejemplo';
    btn.onclick=()=>{ quitarDemo(); render(); toast('Datos de ejemplo eliminados. ¡La app es toda tuya!'); };
    d.appendChild(btn);
    box.appendChild(d);
  }
}

/* ============================================================
   Vista: Inicio
   ============================================================ */
function renderInicio(){
  const box=document.createElement('div'); box.className='viewbox';
  bannerZone(box);
  const ym=thisMonth();
  const ins=insightsMes(ym);
  const ing=ingresosMes(ym), gas=ins.gas, bal=ing-gas;

  /* héroe */
  const hero=document.createElement('section'); hero.className='card hero';
  hero.innerHTML=`
    <div class="lbl">Saldo total ${activeAccounts().length>1?`· ${activeAccounts().length} cuentas`:''}</div>
    <div class="val num" id="heroVal">${fmtMoney(totalBalance())}</div>
    <div class="sub">Balance de ${monthLabel(ym).toLowerCase()}:
      <b class="num" style="color:${bal>=0?'var(--good)':'var(--crit-text)'}">${fmtMoney(bal,{sign:true})}</b></div>`;
  box.appendChild(hero);

  /* primeros pasos */
  if(DB.tx.length===0){
    const e=document.createElement('section'); e.className='card empty';
    e.innerHTML=`<div class="em">✨</div><div class="t">Empieza a tomar el control</div>
      <div class="s">Registra tu primer movimiento con el botón «+». Solo escribe el monto y toca en qué lo gastaste: la app hace el resto.</div>`;
    const r=document.createElement('div'); r.style.cssText='display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
    const b1=document.createElement('button'); b1.className='btn'; b1.innerHTML=ICONS.plus+' Primer movimiento'; b1.onclick=()=>sheetMov();
    const b2=document.createElement('button'); b2.className='btn ghost'; b2.textContent='Ver con datos de ejemplo';
    b2.onclick=()=>{ cargarDemo(); render(); toast('Cargamos 3 meses de ejemplo para que explores 🧪'); };
    r.append(b1,b2); e.appendChild(r); box.appendChild(e);
    view.replaceChildren(box); return;
  }

  /* KPIs */
  const prevYm=addMonths(ym,-1);
  const dIng=ingresosMes(prevYm), dGas=gastosMes(prevYm);
  const delta=(cur,prev,invert)=>{
    if(prev<=0) return `<span class="delta flat">— sin ${invert?'gastos':'datos'} en ${monthLabel(prevYm,true)}</span>`;
    const pc=Math.round((cur-prev)/prev*100);
    const good=invert? pc<=0 : pc>=0;
    const cls=pc===0?'flat':good?'up':'down';
    return `<span class="delta ${cls}">${pc>0?'▲':pc<0?'▼':'•'} ${Math.abs(pc)}% vs ${monthLabel(prevYm,true)}</span>`;
  };
  const kp=document.createElement('div'); kp.className='kpis';
  kp.innerHTML=`
    <div class="kpi"><div class="lbl">Ingresos del mes</div><div class="val num" style="color:var(--good)">${fmtKpi(ing)}</div>${delta(ing,dIng,false)}</div>
    <div class="kpi"><div class="lbl">Gastos del mes</div><div class="val num">${fmtKpi(gas)}</div>${delta(gas,dGas,true)}</div>
    <div class="kpi"><div class="lbl">Gasto promedio diario</div><div class="val num">${fmtKpi(ins.promDiario)}</div><span class="delta flat">proyección: ${fmtKpi(ins.proy)}</span></div>
    <div class="kpi"><div class="lbl">${ins.paraHoy!=null?'Disponible por día':'Racha registrando'}</div>
      ${ins.paraHoy!=null
        ? `<div class="val num">${fmtKpi(ins.paraHoy)}</div><span class="delta flat">para no pasarte del presupuesto</span>`
        : `<div class="val num">🔥 ${racha()} día${racha()===1?'':'s'}</div><span class="delta flat">registra algo cada día</span>`}
    </div>`;
  box.appendChild(kp);

  /* alertas */
  const alerts=document.createElement('div'); alerts.className='alerts';
  const {map:bmap}=effectiveBudget(ym);
  const balerts=Object.entries(bmap).map(([cid,lim])=>({c:cat(cid),lim,g:gastoCat(ym,cid)}))
    .filter(x=>x.lim>0&&x.g/x.lim>=.8).sort((a,b)=>b.g/b.lim-a.g/a.lim).slice(0,3);
  for(const x of balerts){
    const over=x.g>x.lim;
    const d=document.createElement('div'); d.className='alert '+(over?'crit':'warn');
    d.innerHTML=`<span class="ic">${over?'🚨':'⚠️'}</span><span class="txt">${over
      ?`Te pasaste del presupuesto de <b>${esc(x.c.nombre)}</b> por <b class="num">${fmtMoney(x.g-x.lim)}</b>`
      :`Llevas el <b>${Math.round(x.g/x.lim*100)}%</b> del presupuesto de <b>${esc(x.c.nombre)}</b>`}</span>`;
    const go=document.createElement('button'); go.className='linkbtn'; go.textContent='Ver';
    go.onclick=()=>{ location.hash='#/presupuesto'; };
    d.appendChild(go); alerts.appendChild(d);
  }
  const en3dias=(f)=>{ const d=parseKey(f.nextDue); const h=parseKey(todayKey()); return Math.round((d-h)/86400000)<=3; };
  for(const f of DB.fijos.filter(f=>f.activo&&f.nextDue&&en3dias(f)).slice(0,2)){
    const d=document.createElement('div'); d.className='alert';
    d.innerHTML=`<span class="ic">🔁</span><span class="txt"><b>${esc(f.nota||cat(f.cat).nombre)}</b> (${fmtMoney(f.monto)}) se registrará el ${esc(shortDate(f.nextDue))}</span>`;
    alerts.appendChild(d);
  }
  if(DB.tx.filter(t=>!t.demo).length>15 && (!DB.settings.lastExport || Date.now()-DB.settings.lastExport>30*86400000)){
    const d=document.createElement('div'); d.className='alert';
    d.innerHTML=`<span class="ic">💾</span><span class="txt">Tus datos viven solo en este navegador. Haz un respaldo de vez en cuando.</span>`;
    const go=document.createElement('button'); go.className='linkbtn'; go.textContent='Exportar'; go.onclick=exportJSON;
    d.appendChild(go); alerts.appendChild(d);
  }
  if(alerts.children.length) box.appendChild(alerts);

  const grid=document.createElement('div'); grid.className='grid2'; grid.style.marginTop='12px';

  /* ritmo del mes */
  const cmp = ins.prevAlDia>0 ? Math.round((gas-ins.prevAlDia)/ins.prevAlDia*100) : null;
  const ritmoSub = cmp==null ? 'Gasto acumulado día a día'
    : cmp===0 ? 'Vas igual que el mes pasado a esta altura'
    : cmp<0 ? `Llevas ${Math.abs(cmp)}% menos gastado que el mes pasado a esta altura`
    : `Llevas ${cmp}% más gastado que el mes pasado a esta altura`;
  const rc=chartCard({title:'Ritmo del mes', sub:ritmoSub, chartEl:ritmoChart(ym),
    table:{head:['Día','Este mes','Mes anterior'],
      rows:acumuladoDiario(ym,ins.dia).map(p=>{
        const pr=acumuladoDiario(prevYm, daysInMonth(prevYm)).find(x=>x.d===p.d);
        return [String(p.d), fmtMoney(p.acum), pr?fmtMoney(pr.acum):'—'];
      })}});
  rc.classList.add('span2'); grid.appendChild(rc);

  /* dona por categoría */
  const bycat=porCategoria(txOfMonth(ym),'g');
  if(bycat.length){
    const top=bycat.slice(0,6).map(x=>({id:x.cat.id, nombre:x.cat.nombre, emoji:x.cat.emoji, color:cssColor(catColorVar(x.cat)), total:x.total}));
    const resto=bycat.slice(6).reduce((s,x)=>s+x.total,0);
    if(resto>0) top.push({id:null, nombre:'Otras categorías', emoji:'', color:cssColor('var(--cx)'), total:resto});
    grid.appendChild(chartCard({title:'¿En qué se te va?', sub:monthLabel(ym),
      chartEl:donutChart(top, gas, seg=>{ if(seg.id){ S.movs={ym, tipo:'g', cat:seg.id, q:''}; location.hash='#/movs'; } }),
      table:{head:['Categoría','Monto','%'], rows:bycat.map(x=>[x.cat.emoji+' '+x.cat.nombre, fmtMoney(x.total), Math.round(x.total/gas*100)+'%'])}}));
  }

  /* ingresos vs gastos */
  const serie=serieMensual(6);
  grid.appendChild(chartCard({title:'Ingresos vs gastos', sub:'Últimos 6 meses',
    chartEl:columnsChart(serie),
    table:{head:['Mes','Ingresos','Gastos','Balance'], rows:serie.map(s=>[monthLabel(s.ym), fmtMoney(s.ing), fmtMoney(s.gas), fmtMoney(s.ing-s.gas,{sign:true})])}}));

  /* presupuesto resumen */
  const pres=document.createElement('section'); pres.className='card';
  const bt=budgetTotal(ym);
  if(bt>0){
    const items=Object.entries(bmap).map(([cid,lim])=>({c:cat(cid),lim,g:gastoCat(ym,cid)}))
      .filter(x=>x.lim>0).sort((a,b)=>b.g/b.lim-a.g/a.lim).slice(0,3);
    pres.innerHTML=`<div class="card-head"><div><div class="card-title">Presupuesto</div>
      <div class="card-sub">${fmtMoney(gas)} de ${fmtMoney(bt)} · queda <b class="num">${fmtMoney(Math.max(0,bt-gas))}</b></div></div>
      <span class="sp"></span><a class="linkbtn" href="#/presupuesto">Ver todo</a></div>`;
    for(const x of items){
      const pct=x.g/x.lim;
      const col= pct>=1?'var(--crit)': pct>=.8?'var(--warn)': catColorVar(x.c);
      const row=document.createElement('div'); row.className='brow';
      row.innerHTML=`<div class="top"><span class="emo">${x.c.emoji}</span><span class="nm">${esc(x.c.nombre)}</span>
        <span class="st num">${pct>=1?'⚠ excedido':Math.round(pct*100)+'%'}</span></div>
        <div class="meter" style="--mc:${col}"><i style="--w:${Math.min(100,pct*100).toFixed(1)}%"></i></div>`;
      pres.appendChild(row);
    }
  }else{
    pres.innerHTML=`<div class="card-head"><div class="card-title">Presupuesto</div></div>
      <p class="card-sub" style="margin-bottom:10px">Ponle un límite mensual a tus categorías y te avisamos antes de pasarte.</p>`;
    const b=document.createElement('button'); b.className='btn ghost small'; b.textContent='Crear presupuesto';
    b.onclick=()=>{ location.hash='#/presupuesto'; };
    pres.appendChild(b);
  }
  grid.appendChild(pres);

  /* metas resumen */
  if(DB.metas.length){
    const mcard=document.createElement('section'); mcard.className='card';
    mcard.innerHTML=`<div class="card-head"><div class="card-title">Metas</div><span class="sp"></span><a class="linkbtn" href="#/presupuesto?pane=metas">Ver todas</a></div>`;
    for(const m of DB.metas.slice(0,2)){
      const p=metaProgreso(m); const pct=Math.min(1,p/m.objetivo);
      const row=document.createElement('div'); row.className='brow';
      row.innerHTML=`<div class="top"><span class="emo">${m.emoji}</span><span class="nm">${esc(m.nombre)}</span>
        <span class="st num">${Math.round(pct*100)}%</span></div>
        <div class="meter" style="--mc:${pct>=1?'var(--good)':'var(--accent)'}"><i style="--w:${(pct*100).toFixed(1)}%"></i></div>
        <div class="bot"><span class="num">${fmtMoney(p)}</span><span class="num">${fmtMoney(m.objetivo)}</span></div>`;
      mcard.appendChild(row);
    }
    grid.appendChild(mcard);
  }

  /* recientes */
  const rec=document.createElement('section'); rec.className='card';
  rec.innerHTML=`<div class="card-head"><div class="card-title">Recientes</div><span class="sp"></span><a class="linkbtn" href="#/movs">Ver todos</a></div>`;
  const last=[...DB.tx].sort((a,b)=> b.fecha===a.fecha? (b.creado||0)-(a.creado||0) : (b.fecha<a.fecha?-1:1)).slice(0,5);
  for(const t of last) rec.appendChild(buildMovRow(t));
  grid.appendChild(rec);

  box.appendChild(grid);
  view.replaceChildren(box);
  countUp($('#heroVal',hero), totalBalance());
}
function cssColor(varExpr){ return varExpr; } /* los SVG aceptan var() en style */
function countUp(el, cents){
  if(!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t0=performance.now(), dur=520;
  (function f(now){
    const k=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-k,3);
    el.textContent=fmtMoney(Math.round(cents*e));
    if(k<1) requestAnimationFrame(f);
  })(t0);
}

/* ============================================================
   Vista: Movimientos
   ============================================================ */
function renderMovs(){
  const box=document.createElement('div'); box.className='viewbox';
  bannerZone(box);
  box.insertAdjacentHTML('beforeend','<h1 class="view-title">Movimientos</h1>');
  box.appendChild(monthNav(S.movs.ym, ym=>{ S.movs.ym=ym; renderMovs(); }));

  const search=document.createElement('div'); search.className='search';
  search.innerHTML=`${ICONS.search}<input id="movQ" placeholder="Buscar por nota, categoría o monto…" value="${esc(S.movs.q)}">`;
  box.appendChild(search);

  const chips=document.createElement('div'); chips.className='chiprow'; chips.style.marginBottom='10px';
  const tipos=[['all','Todos'],['g','Gastos'],['i','Ingresos'],['t','Transferencias']];
  for(const [k,lbl] of tipos){
    const c=document.createElement('button'); c.className='chip'+(S.movs.tipo===k?' on':''); c.textContent=lbl;
    c.onclick=()=>{ S.movs.tipo=k; if(k==='t'||k==='all') S.movs.cat=null; renderMovs(); };
    chips.appendChild(c);
  }
  const catSel=document.createElement('select'); catSel.className='chip'; catSel.setAttribute('aria-label','Filtrar por categoría');
  catSel.innerHTML=`<option value="">Categoría: todas</option>`+DB.cats.filter(c=>!c.archivada).map(c=>`<option value="${c.id}" ${S.movs.cat===c.id?'selected':''}>${c.emoji} ${esc(c.nombre)}</option>`).join('');
  catSel.onchange=()=>{ S.movs.cat=catSel.value||null; renderMovs(); };
  chips.appendChild(catSel);
  box.appendChild(chips);

  let list=txOfMonth(S.movs.ym);
  if(S.movs.tipo!=='all') list=list.filter(t=>t.tipo===S.movs.tipo);
  if(S.movs.cat) list=list.filter(t=>t.cat===S.movs.cat);
  const q=S.movs.q.trim().toLowerCase();
  const qn=q.replace(',','.');
  if(q) list=list.filter(t=>(t.nota||'').toLowerCase().includes(q)
    || movLabel(t).toLowerCase().includes(q)
    || String(t.monto/100).includes(qn)
    || (t.monto/100).toFixed(2).includes(qn));
  list=[...list].sort((a,b)=> b.fecha===a.fecha? (b.creado||0)-(a.creado||0) : (b.fecha<a.fecha?-1:1));

  const g=sumTipo(list,'g'), i=sumTipo(list,'i');
  const sum=document.createElement('p'); sum.className='card-sub'; sum.style.margin='0 2px 4px';
  sum.innerHTML=`${list.length} movimiento${list.length===1?'':'s'} · Gastos <b class="num">${fmtMoney(g)}</b> · Ingresos <b class="num">${fmtMoney(i)}</b>`;
  box.appendChild(sum);

  if(!list.length){
    const e=document.createElement('div'); e.className='card empty';
    e.innerHTML=`<div class="em">🌱</div><div class="t">Nada por aquí</div><div class="s">${q||S.movs.cat||S.movs.tipo!=='all'?'No hay movimientos con esos filtros en '+monthLabel(S.movs.ym).toLowerCase()+'.':'Aún no registras movimientos en '+monthLabel(S.movs.ym).toLowerCase()+'.'}</div>`;
    box.appendChild(e);
  }else listMovs(box,list);

  view.replaceChildren(box);
  const qi=$('#movQ',box);
  qi.oninput=()=>{ S.movs.q=qi.value; clearTimeout(qi._t); qi._t=setTimeout(()=>{ const pos=qi.selectionStart; renderMovs(); const q2=$('#movQ'); q2.focus(); q2.setSelectionRange(pos,pos); },300); };
}

/* ============================================================
   Vista: Presupuesto (presupuestos · metas · fijos)
   ============================================================ */
function renderPresupuesto(){
  const box=document.createElement('div'); box.className='viewbox';
  bannerZone(box);
  box.insertAdjacentHTML('beforeend','<h1 class="view-title">Planear</h1>');
  const seg=document.createElement('div'); seg.className='seg'; seg.style.marginBottom='14px';
  const panes=[['pres','Presupuesto'],['metas','Metas'],['fijos','Fijos']];
  for(const [k,lbl] of panes){
    const b=document.createElement('button'); b.textContent=lbl; b.classList.toggle('on',S.pane===k); b.setAttribute('aria-pressed',String(S.pane===k));
    b.onclick=()=>{ S.pane=k; renderPresupuesto(); };
    seg.appendChild(b);
  }
  box.appendChild(seg);
  if(S.pane==='pres') paneBudget(box);
  else if(S.pane==='metas') paneMetas(box);
  else paneFijos(box);
  view.replaceChildren(box);
}
function paneBudget(box){
  const ym=S.bym;
  box.appendChild(monthNav(ym, m=>{ S.bym=m; renderPresupuesto(); }, {max:addMonths(thisMonth(),3)}));
  const {map,heredado}=effectiveBudget(ym);
  const bt=Object.values(map).reduce((a,b)=>a+b,0);
  const gas=gastosMes(ym);
  const card=document.createElement('section'); card.className='card';
  if(heredado){
    card.insertAdjacentHTML('beforeend',`<div style="margin-bottom:10px"><span class="badge acc">Copiado de ${esc(monthLabel(heredado).toLowerCase())} · edita cualquier categoría para ajustarlo</span></div>`);
  }
  if(bt>0){
    const pct=gas/bt;
    card.insertAdjacentHTML('beforeend',`
      <div class="row" style="margin-bottom:6px"><b>Total del mes</b><span class="sp"></span>
        <span class="num" style="font-weight:700">${fmtMoney(gas)} <span style="color:var(--muted);font-weight:600">de ${fmtMoney(bt)}</span></span></div>
      <div class="meter" style="--mc:${pct>=1?'var(--crit)':pct>=.8?'var(--warn)':'var(--accent)'}"><i style="--w:${Math.min(100,pct*100).toFixed(1)}%"></i></div>
      <div class="row" style="margin-top:6px;font-size:12.5px;color:var(--muted)">
        <span>${Math.round(pct*100)}% usado</span><span class="sp"></span>
        <span class="num">${pct>=1? 'excedido por '+fmtMoney(gas-bt) : 'queda '+fmtMoney(bt-gas)}</span></div>`);
  }else{
    card.insertAdjacentHTML('beforeend',`<p class="card-sub" style="margin-bottom:8px">Asigna límites mensuales por categoría. Te avisamos al llegar al 80% y al pasarte.</p>`);
    const r=document.createElement('div'); r.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
    const sug=document.createElement('button'); sug.className='btn small'; sug.textContent='Sugerir según mi historial';
    sug.onclick=()=>{
      const s=sugerirPresupuesto(ym);
      if(!Object.keys(s).length){ toast('Aún no hay historial suficiente. Asigna límites tocando cada categoría.'); return; }
      for(const [cid,v] of Object.entries(s)) setBudget(ym,cid,v);
      renderPresupuesto(); toast('Presupuesto sugerido con tu promedio de los últimos 3 meses ✓');
    };
    r.appendChild(sug); card.appendChild(r);
  }
  box.appendChild(card);

  const listCard=document.createElement('section'); listCard.className='card';
  const conB=[], sinB=[];
  for(const c of cats('g')) (map[c.id]>0? conB:sinB).push(c);
  for(const cid of Object.keys(map)){ const c=DB.cats.find(x=>x.id===cid); if(c && c.archivada && map[cid]>0) conB.push(c); }
  conB.sort((a,b)=>(gastoCat(ym,b.id)/(map[b.id]||1))-(gastoCat(ym,a.id)/(map[a.id]||1)));
  for(const c of conB){
    const lim=map[c.id], g=gastoCat(ym,c.id), pct=g/lim;
    const col=pct>=1?'var(--crit)':pct>=.8?'var(--warn)':catColorVar(c);
    const row=document.createElement('button'); row.className='brow'; row.style.cssText='display:block;width:100%;text-align:left';
    row.innerHTML=`<div class="top"><span class="emo">${c.emoji}</span><span class="nm">${esc(c.nombre)}${c.archivada?' <span class="badge">archivada</span>':''}</span>
      <span class="st num">${pct>=1?'⚠ excedido':Math.round(pct*100)+'%'}</span></div>
      <div class="meter" style="--mc:${col}"><i style="--w:${Math.min(100,pct*100).toFixed(1)}%"></i></div>
      <div class="bot"><span class="num">${fmtMoney(g)}</span><span class="num">${pct>=1?'+'+fmtMoney(g-lim):'quedan '+fmtMoney(lim-g)} · límite ${fmtMoney(lim)}</span></div>`;
    row.onclick=()=>sheetPresu(c,ym);
    listCard.appendChild(row);
  }
  if(conB.length && sinB.length) listCard.insertAdjacentHTML('beforeend','<div class="hr"></div>');
  for(const c of sinB){
    const g=gastoCat(ym,c.id);
    const row=document.createElement('button'); row.className='setrow';
    row.innerHTML=`<span class="ic">${c.emoji}</span><span class="mid"><span class="t">${esc(c.nombre)}</span>
      <span class="s num">${g>0? 'gastado: '+fmtMoney(g):'sin movimientos este mes'}</span></span>
      <span class="linkbtn">Asignar</span>`;
    row.onclick=()=>sheetPresu(c,ym);
    listCard.appendChild(row);
  }
  box.appendChild(listCard);
}
function paneMetas(box){
  const btn=document.createElement('button'); btn.className='btn'; btn.style.marginBottom='12px';
  btn.innerHTML=ICONS.plus+' Nueva meta'; btn.onclick=()=>sheetMeta();
  box.appendChild(btn);
  if(!DB.metas.length){
    const e=document.createElement('div'); e.className='card empty';
    e.innerHTML=`<div class="em">🎯</div><div class="t">Ahorra con propósito</div><div class="s">Crea una meta (un viaje, un fondo de emergencia…) y abónale cuando puedas. Verás tu progreso aquí.</div>`;
    box.appendChild(e); return;
  }
  for(const m of DB.metas){
    const p=metaProgreso(m), pct=Math.min(1,p/m.objetivo), done=p>=m.objetivo;
    const card=document.createElement('section'); card.className='metacard';
    let estado='';
    if(done) estado='<span class="badge acc">¡Lograda! 🎉</span>';
    else if(m.fechaLimite){
      const sug=metaAporteSugerido(m);
      const total=parseKey(m.fechaLimite)-((m.creado&&new Date(m.creado))||parseKey(todayKey()));
      const trans=Date.now()-(m.creado||Date.now());
      const ritmoOk = total>0 ? (pct >= Math.min(1,trans/total)*0.9) : true;
      estado=`<span class="badge ${ritmoOk?'acc':'warn'}">${ritmoOk?'vas bien':'en riesgo'}</span>`;
      card.dataset.sug=sug;
    }
    card.innerHTML=`
      <div class="top"><span class="em">${m.emoji}</span>
        <div><div class="nm">${esc(m.nombre)}</div>
        <div class="st">${m.fechaLimite? 'antes del '+shortDate(m.fechaLimite)+(parseKey(m.fechaLimite).getFullYear()!==new Date().getFullYear()?' '+parseKey(m.fechaLimite).getFullYear():''):'sin fecha límite'}</div></div>
        <span class="sp"></span>${estado}</div>
      <div class="meter" style="--mc:${done?'var(--good)':'var(--accent)'};height:12px"><i style="--w:${(pct*100).toFixed(1)}%"></i></div>
      <div class="nums"><span><b class="num">${fmtMoney(p)}</b> ahorrado</span><span class="num">${Math.round(pct*100)}% de ${fmtMoney(m.objetivo)}</span></div>`;
    const foot=document.createElement('div'); foot.className='foot';
    if(!done && m.fechaLimite && metaAporteSugerido(m)>0)
      foot.innerHTML=`<span class="info">Necesitas ~<b class="num">${fmtMoney(metaAporteSugerido(m))}</b>/mes para llegar</span>`;
    else foot.innerHTML=`<span class="info">${done?'Puedes retirar o dejarla como recuerdo ✨':'Abona cuando puedas, sin presión'}</span>`;
    const ab=document.createElement('button'); ab.className='btn small'; ab.textContent='Abonar'; ab.onclick=()=>sheetAbono(m);
    const re=document.createElement('button'); re.className='btn ghost small'; re.textContent='Retirar'; re.onclick=()=>sheetAbono(m,true);
    const ed=document.createElement('button'); ed.className='iconbtn'; ed.style.cssText='width:34px;height:34px'; ed.innerHTML=ICONS.pencil; ed.setAttribute('aria-label','Editar meta'); ed.onclick=()=>sheetMeta(m);
    foot.append(ab,re,ed); card.appendChild(foot);
    box.appendChild(card);
  }
}
function paneFijos(box){
  const btn=document.createElement('button'); btn.className='btn'; btn.style.marginBottom='12px';
  btn.innerHTML=ICONS.plus+' Nuevo fijo'; btn.onclick=()=>sheetFijo();
  box.appendChild(btn);
  if(!DB.fijos.length){
    const e=document.createElement('div'); e.className='card empty';
    e.innerHTML=`<div class="em">🔁</div><div class="t">Configura una vez, olvídate</div><div class="s">Arriendo, nómina, suscripciones… se registrarán solos cada mes el día que elijas.</div>`;
    box.appendChild(e); return;
  }
  const card=document.createElement('section'); card.className='card';
  for(const f of DB.fijos){
    const c=cat(f.cat);
    const row=document.createElement('div'); row.className='setrow';
    const mid=document.createElement('button'); mid.className='mid'; mid.style.cssText='text-align:left;flex:1;min-width:0';
    mid.innerHTML=`<span class="t">${c.emoji} ${esc(f.nota||c.nombre)} <span class="num" style="color:${f.tipo==='i'?'var(--good)':'var(--ink2)'}">· ${f.tipo==='i'?'+':'−'}${fmtMoney(f.monto).replace('−','')}</span></span>
      <span class="s">Día ${f.dia} de cada mes${f.activo&&f.nextDue?` · próximo: ${esc(shortDate(f.nextDue))}`:' · pausado'}</span>`;
    mid.onclick=()=>sheetFijo(f);
    const sw=document.createElement('button'); sw.className='tgl'+(f.activo?' on':''); sw.setAttribute('role','switch');
    sw.setAttribute('aria-checked',String(f.activo)); sw.setAttribute('aria-label','Activar '+(f.nota||cat(f.cat).nombre));
    sw.onclick=()=>{
      f.activo=!f.activo;
      if(f.activo) f.nextDue=nextDueFrom(f.dia, todayKey());
      save(); renderPresupuesto();
    };
    row.append(mid,sw); card.appendChild(row);
  }
  box.appendChild(card);
  box.insertAdjacentHTML('beforeend','<p class="card-sub" style="margin-top:10px;padding:0 4px">Los fijos activos se registran automáticamente al abrir la app cuando llega su fecha. Puedes editarlos o borrarlos como cualquier movimiento.</p>');
}

/* ============================================================
   Vista: Reportes
   ============================================================ */
function renderReportes(){
  const box=document.createElement('div'); box.className='viewbox';
  bannerZone(box);
  box.insertAdjacentHTML('beforeend','<h1 class="view-title">Reportes</h1>');
  const seg=document.createElement('div'); seg.className='seg'; seg.style.marginBottom='14px';
  const rangos=[['mes','Mes'],['3m','3M'],['6m','6M'],['12m','12M'],['todo','Todo']];
  for(const [k,lbl] of rangos){
    const b=document.createElement('button'); b.textContent=lbl; b.classList.toggle('on',S.rep.range===k); b.setAttribute('aria-pressed',String(S.rep.range===k));
    b.onclick=()=>{ S.rep.range=k; renderReportes(); };
    seg.appendChild(b);
  }
  box.appendChild(seg);

  let d1,d2,months,label;
  const cur=thisMonth();
  if(S.rep.range==='mes'){
    box.appendChild(monthNav(S.rep.ym, m=>{ S.rep.ym=m; renderReportes(); }));
    d1=S.rep.ym+'-01'; d2=S.rep.ym+'-'+p2(daysInMonth(S.rep.ym)); months=[S.rep.ym]; label=monthLabel(S.rep.ym);
  }else if(S.rep.range==='todo'){
    const first=DB.tx[0]?.fecha || todayKey();
    d1=first; d2=todayKey();
    months=[]; for(let m=monthOf(first); m<=cur; m=addMonths(m,1)) months.push(m);
    label='Todo el historial';
  }else{
    const n=+S.rep.range.replace('m','');
    months=[]; for(let i=n-1;i>=0;i--) months.push(addMonths(cur,-i));
    d1=months[0]+'-01'; d2=todayKey(); label=`Últimos ${n} meses`;
  }
  const list=DB.tx.filter(t=>inRange(t,d1,d2));
  const ing=sumTipo(list,'i'), gas=sumTipo(list,'g');
  const ingBase=ingresosBase(list);
  const aho=list.reduce((s,t)=>s+((t.tipo==='g'&&cat(t.cat).grupo==='aho')?t.monto:0),0);
  const tasa=ingBase>0? Math.round(aho/ingBase*100):0;

  const kp=document.createElement('div'); kp.className='kpis';
  kp.innerHTML=`
    <div class="kpi"><div class="lbl">Ingresos</div><div class="val num" style="color:var(--good)">${fmtKpi(ing)}</div></div>
    <div class="kpi"><div class="lbl">Gastos</div><div class="val num">${fmtKpi(gas)}</div></div>
    <div class="kpi"><div class="lbl">Balance</div><div class="val num" style="color:${ing-gas>=0?'var(--good)':'var(--crit-text)'}">${ing-gas>=0?'+':''}${fmtKpi(ing-gas).replace('−','−')}</div></div>
    <div class="kpi"><div class="lbl">Tasa de ahorro</div><div class="val num">${ingBase>0?tasa+'%':'—'}</div><span class="delta flat">de tus ingresos</span></div>`;
  kp.style.marginBottom='12px';
  box.appendChild(kp);

  if(!list.length){
    const e=document.createElement('div'); e.className='card empty';
    e.innerHTML=`<div class="em">📊</div><div class="t">Sin datos en este periodo</div><div class="s">Registra movimientos o cambia el rango.</div>`;
    box.appendChild(e); view.replaceChildren(box); return;
  }

  const grid=document.createElement('div'); grid.className='grid2';

  /* top categorías */
  const bycat=porCategoria(list,'g');
  if(bycat.length){
    const items=bycat.slice(0,8).map(x=>({id:x.cat.id, nombre:x.cat.nombre, emoji:x.cat.emoji, color:catColorVar(x.cat), total:x.total}));
    grid.appendChild(chartCard({title:'Top categorías de gasto', sub:label,
      chartEl:topCatsChart(items, it=>{ if(it.id){ S.movs={ym:S.rep.range==='mes'?S.rep.ym:thisMonth(), tipo:'g', cat:it.id, q:''}; location.hash='#/movs'; } }, gas),
      table:{head:['Categoría','Monto','%'], rows:bycat.map(x=>[x.cat.emoji+' '+x.cat.nombre, fmtMoney(x.total), Math.round(x.total/(gas||1)*100)+'%'])}}));
  }

  if(S.rep.range==='mes'){
    /* comparativa vs mes anterior */
    const prevYm=addMonths(S.rep.ym,-1);
    const curBy=new Map(porCategoria(txOfMonth(S.rep.ym),'g').map(x=>[x.cat.id,x.total]));
    const prevBy=new Map(porCategoria(txOfMonth(prevYm),'g').map(x=>[x.cat.id,x.total]));
    const idsCmp=[...new Set([...curBy.keys(),...prevBy.keys()])];
    if(idsCmp.length){
      const card=document.createElement('section'); card.className='card';
      card.innerHTML=`<div class="card-head"><div><div class="card-title">Comparado con ${esc(monthLabel(prevYm).toLowerCase())}</div><div class="card-sub">Gasto por categoría</div></div></div>`;
      const rows=idsCmp.map(id=>({c:cat(id), a:curBy.get(id)||0, b:prevBy.get(id)||0})).sort((x,y)=>y.a-x.a).slice(0,8);
      for(const r of rows){
        const diff=r.a-r.b;
        const pct=r.b>0? Math.round(diff/r.b*100):null;
        const good=diff<=0;
        const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:9px;padding:8px 2px;border-bottom:1px solid var(--border);font-size:13.5px';
        row.innerHTML=`<span>${r.c.emoji}</span><span style="font-weight:650;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.c.nombre)}</span>
          <span class="num" style="font-weight:700">${fmtMoney(r.a)}</span>
          <span class="num" style="font-size:12px;font-weight:700;min-width:74px;text-align:right;color:${diff===0?'var(--muted)':good?'var(--good)':'var(--crit-text)'}">
            ${diff===0?'igual':(good?'▼':'▲')+' '+(pct!=null&&isFinite(pct)?Math.abs(pct)+'%':fmtMoney(Math.abs(diff)))}</span>`;
        card.appendChild(row);
      }
      card.lastChild.style.borderBottom='0';
      grid.appendChild(card);
    }
    /* 50/30/20 */
    grid.appendChild(chartCard({title:'Regla 50/30/20', sub:'Necesidades · deseos · ahorro', chartEl:stack503020(S.rep.ym)}));
    /* calendario */
    grid.appendChild(chartCard({title:'Calendario de gastos', sub:'¿Qué días gastas más?', chartEl:heatmapChart(S.rep.ym),
      table:{head:['Día','Gastado'], rows:acumuladoDiario(S.rep.ym,daysInMonth(S.rep.ym)).map((p,i,arr)=>[String(p.d), fmtMoney(p.acum-(arr[i-1]?.acum||0))]).filter(r=>r[1]!==fmtMoney(0))}}));
  }else{
    /* serie mensual del rango */
    const serie=months.slice(-12).map(ym=>({ym, ing:ingresosMes(ym), gas:gastosMes(ym)}));
    grid.appendChild(chartCard({title:'Ingresos vs gastos', sub:label+(months.length>12?' (últimos 12)':''),
      chartEl:columnsChart(serie),
      table:{head:['Mes','Ingresos','Gastos','Balance'], rows:serie.map(s=>[monthLabel(s.ym), fmtMoney(s.ing), fmtMoney(s.gas), fmtMoney(s.ing-s.gas,{sign:true})])}}));
    /* promedio mensual por categoría */
    const mesesConDatos=months.filter(m=>txOfMonth(m).some(t=>t.tipo==='g')).length||1;
    const avgRows=bycat.map(x=>[x.cat.emoji+' '+x.cat.nombre, fmtMoney(Math.round(x.total/mesesConDatos)), fmtMoney(x.total)]);
    const card=document.createElement('section'); card.className='card';
    card.innerHTML=`<div class="card-head"><div><div class="card-title">Promedio mensual</div><div class="card-sub">${mesesConDatos} mes${mesesConDatos===1?'':'es'} con datos</div></div></div>
      <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Categoría</th><th style="text-align:right">Promedio/mes</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${avgRows.map(r=>`<tr><td>${esc(r[0])}</td><td class="n">${esc(r[1])}</td><td class="n">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>`;
    grid.appendChild(card);
  }
  box.appendChild(grid);
  view.replaceChildren(box);
}

/* ============================================================
   Vista: Ajustes
   ============================================================ */
function renderAjustes(){
  const box=document.createElement('div'); box.className='viewbox';
  bannerZone(box);
  box.insertAdjacentHTML('beforeend','<h1 class="view-title">Ajustes</h1>');

  /* apariencia + moneda */
  const c1=document.createElement('section'); c1.className='card';
  c1.innerHTML=`<div class="card-head"><div class="card-title">Preferencias</div></div>`;
  const temaRow=document.createElement('div'); temaRow.className='setrow';
  temaRow.innerHTML=`<span class="ic">🎨</span><span class="mid"><span class="t">Tema</span></span>`;
  const temaSeg=document.createElement('div'); temaSeg.className='seg'; temaSeg.style.maxWidth='220px';
  for(const [k,lbl] of [['auto','Auto'],['light','Claro'],['dark','Oscuro']]){
    const b=document.createElement('button'); b.textContent=lbl; b.classList.toggle('on',DB.settings.theme===k); b.setAttribute('aria-pressed',String(DB.settings.theme===k));
    b.onclick=()=>{ DB.settings.theme=k; save(); applyTheme(); renderAjustes(); };
    temaSeg.appendChild(b);
  }
  temaRow.appendChild(temaSeg); c1.appendChild(temaRow);
  const monRow=document.createElement('div'); monRow.className='setrow';
  monRow.innerHTML=`<span class="ic">🪙</span><span class="mid"><span class="t">Moneda</span><span class="s">Cambia el formato; no convierte los montos</span></span>`;
  const monSel=document.createElement('select');
  monSel.innerHTML=CURRENCIES.map(c=>`<option value="${c[0]}" ${DB.settings.currency===c[0]?'selected':''}>${c[0]} · ${esc(c[1])}</option>`).join('');
  monSel.onchange=()=>{ DB.settings.currency=monSel.value; _fmtKey=''; save(); render(); toast('Moneda actualizada ✓'); };
  monRow.appendChild(monSel); c1.appendChild(monRow);
  box.appendChild(c1);

  /* cuentas */
  const c2=document.createElement('section'); c2.className='card';
  c2.innerHTML=`<div class="card-head"><div class="card-title">Cuentas</div><span class="sp"></span></div>`;
  const addA=document.createElement('button'); addA.className='linkbtn'; addA.textContent='+ Nueva';
  addA.onclick=()=>sheetCuenta(); c2.querySelector('.card-head').appendChild(addA);
  for(const a of DB.accounts){
    const row=document.createElement('button'); row.className='setrow';
    row.innerHTML=`<span class="ic">${a.emoji}</span><span class="mid"><span class="t">${esc(a.nombre)}${a.archivada?' <span class="badge">archivada</span>':''}</span>
      <span class="s num">Saldo: ${fmtMoney(accountBalance(a.id))}</span></span><span class="chev">${ICONS.chevR}</span>`;
    row.onclick=()=>sheetCuenta(a);
    c2.appendChild(row);
  }
  box.appendChild(c2);

  /* categorías */
  const c3=document.createElement('section'); c3.className='card';
  c3.innerHTML=`<div class="card-head"><div class="card-title">Categorías</div><span class="sp"></span></div>`;
  const addC=document.createElement('button'); addC.className='linkbtn'; addC.textContent='+ Nueva';
  addC.onclick=()=>sheetCategoria(null,'g'); c3.querySelector('.card-head').appendChild(addC);
  for(const [tipo,lbl] of [['g','Gastos'],['i','Ingresos']]){
    c3.insertAdjacentHTML('beforeend',`<p class="card-sub" style="margin:8px 0 6px;font-weight:700">${lbl}</p>`);
    const wrap=document.createElement('div'); wrap.style.cssText='display:flex;flex-wrap:wrap;gap:7px';
    for(const c of DB.cats.filter(x=>x.tipo===tipo)){
      const b=document.createElement('button'); b.className='chip'+(c.archivada?'':'');
      if(c.archivada) b.style.opacity='.5';
      b.innerHTML=`${c.emoji} ${esc(c.nombre)}`;
      b.style.setProperty('border-color','color-mix(in srgb,'+catColorVar(c)+' 45%, transparent)');
      b.onclick=()=>sheetCategoria(c);
      wrap.appendChild(b);
    }
    c3.appendChild(wrap);
  }
  box.appendChild(c3);

  /* datos */
  const c4=document.createElement('section'); c4.className='card';
  c4.innerHTML=`<div class="card-head"><div class="card-title">Tus datos</div></div>
    <p class="card-sub" style="margin-bottom:6px">Todo se guarda solo en este navegador. ${DB.settings.lastExport?`Último respaldo: ${new Date(DB.settings.lastExport).toLocaleDateString('es')}.`:'Aún no has hecho un respaldo.'}</p>`;
  const mkRow=(ic,t,s,fn)=>{
    const r=document.createElement('button'); r.className='setrow';
    r.innerHTML=`<span class="ic">${ic}</span><span class="mid"><span class="t">${t}</span><span class="s">${s}</span></span><span class="chev">${ICONS.chevR}</span>`;
    r.onclick=fn; return r;
  };
  c4.appendChild(mkRow('💾','Exportar respaldo (JSON)','Guarda todo para restaurarlo luego o en otro dispositivo',exportJSON));
  c4.appendChild(mkRow('📄','Exportar movimientos (CSV)','Para Excel o Sheets (solo lectura; para restaurar usa el JSON)',exportCSV));
  const impRow=mkRow('📥','Importar respaldo','Restaura un archivo JSON exportado antes',()=>{ $('#impFile').click(); });
  const impInput=document.createElement('input'); impInput.type='file'; impInput.accept='.json,application/json'; impInput.id='impFile'; impInput.style.display='none';
  impInput.onchange=()=>{
    const f=impInput.files[0]; if(!f) return;
    openSheet(el=>{
      sheetHead(el,'Importar respaldo');
      const b=document.createElement('div'); b.className='sh-body'; el.appendChild(b);
      b.innerHTML=`<p style="padding:4px 4px 12px;color:var(--ink2)">¿Cómo quieres importar <b>${esc(f.name)}</b>?</p>`;
      const r1=document.createElement('button'); r1.className='btn'; r1.style.cssText='width:100%;margin-bottom:8px'; r1.textContent='Reemplazar todo con el respaldo';
      r1.onclick=()=>{ closeSheet(); importJSON(f,'replace'); };
      const r2=document.createElement('button'); r2.className='btn ghost'; r2.style.width='100%'; r2.textContent='Fusionar con mis datos actuales';
      r2.onclick=()=>{ closeSheet(); importJSON(f,'merge'); };
      b.append(r1,r2);
    });
    impInput.value='';
  };
  impRow.appendChild(impInput);
  c4.appendChild(impRow);
  c4.appendChild(mkRow('🧪', hayDemo()?'Quitar datos de ejemplo':'Cargar datos de ejemplo',
    hayDemo()?'Elimina los movimientos marcados como ejemplo':'3 meses ficticios para explorar la app',
    ()=>{ if(hayDemo()){ quitarDemo(); render(); toast('Datos de ejemplo eliminados ✓'); } else { cargarDemo(); render(); toast('Datos de ejemplo cargados 🧪'); } }));
  c4.appendChild(mkRow('🗑️','Borrar todos los datos','Empezar de cero (pide confirmación)',sheetBorrarTodo));
  box.appendChild(c4);

  const c5=document.createElement('section'); c5.className='card';
  c5.innerHTML=`<div class="card-head"><div class="card-title">Acerca de</div></div>
    <p class="card-sub">Cuentas Claras · finanzas personales sin cuentas ni nubes: tus datos son tuyos.<br>
    Racha actual: 🔥 ${racha()} día${racha()===1?'':'s'} registrando.<br>
    Hecha con Claude.</p>`;
  box.appendChild(c5);
  view.replaceChildren(box);
}

/* ============================================================
   Router + navegación
   ============================================================ */
const ROUTES={ inicio:renderInicio, movs:renderMovs, presupuesto:renderPresupuesto, reportes:renderReportes, ajustes:renderAjustes };
let current='inicio';
function route(){
  const h=location.hash.replace(/^#\/?/,'');
  const [name,qs]=h.split('?');
  const params=new URLSearchParams(qs||'');
  current=ROUTES[name]?name:'inicio';
  if(params.get('pane')) S.pane=params.get('pane');
  (ROUTES[current])();
  paintNav();
  scrollTo(0,0);
  tipHide();
}
function render(){ (ROUTES[current]||renderInicio)(); paintNav(); paintStreak(); }
const NAV=[['inicio','Inicio',ICONS.home],['movs','Movimientos',ICONS.list],['presupuesto','Planear',ICONS.wallet],['reportes','Reportes',ICONS.chart]];
function paintNav(){
  const tb=$('#tabbar'); tb.innerHTML='';
  NAV.slice(0,2).forEach(n=>tb.appendChild(tabBtn(n)));
  const hole=document.createElement('span'); tb.appendChild(hole);
  NAV.slice(2).forEach(n=>tb.appendChild(tabBtn(n)));
  const sn=$('#sidenav'); sn.innerHTML='';
  [...NAV,['ajustes','Ajustes',ICONS.gear]].forEach(([k,lbl,ic])=>{
    const a=document.createElement('a'); a.className='navlink'+(current===k?' on':''); a.href='#/'+k;
    a.innerHTML=ic+`<span>${lbl}</span>`;
    sn.appendChild(a);
  });
}
function tabBtn([k,lbl,ic]){
  const b=document.createElement('a'); b.className='tab'+(current===k?' on':''); b.href='#/'+k;
  b.innerHTML=ic+`<span>${lbl}</span>`;
  return b;
}
function paintStreak(){
  const n=racha();
  const chip=$('#streakChip');
  chip.classList.toggle('on', n>=2);
  $('#streakN').textContent=n;
  $('#streakSide').textContent = n>=2? `🔥 Racha: ${n} días registrando` : '';
}

/* ============================================================
   Onboarding
   ============================================================ */
function onboarding(){
  const ob=$('#onboard'); ob.classList.add('on');
  const card=document.createElement('div'); card.className='ob-card';
  card.innerHTML=`
    <div class="logo display">$</div>
    <h1>Cuentas Claras</h1>
    <p class="tag">Escribe cuánto, toca en qué. La app organiza, grafica y te avisa: tú solo vive.</p>
    <p class="q">¿En qué moneda manejas tu dinero?</p>`;
  const grid=document.createElement('div'); grid.className='curgrid';
  let sel=null;
  const mainCurs=['USD','EUR','MXN','COP','ARS','CLP','PEN','VES'];
  const paint=()=>{ $$('.curbtn',grid).forEach(b=>b.classList.toggle('on',b.dataset.c===sel)); ok.disabled=!sel; };
  for(const cc of mainCurs){
    const b=document.createElement('button'); b.className='curbtn'; b.dataset.c=cc; b.textContent=cc;
    b.onclick=()=>{ sel=cc; paint(); };
    grid.appendChild(b);
  }
  card.appendChild(grid);
  const more=document.createElement('div'); more.className='ob-more';
  const msel=document.createElement('select');
  msel.innerHTML=`<option value="">Otra moneda…</option>`+CURRENCIES.filter(c=>!mainCurs.includes(c[0])).map(c=>`<option value="${c[0]}">${c[0]} · ${esc(c[1])}</option>`).join('');
  msel.onchange=()=>{ if(msel.value){ sel=msel.value; paint(); } };
  more.appendChild(msel); card.appendChild(more);
  const ok=document.createElement('button'); ok.className='btn'; ok.style.cssText='width:100%;padding:13px'; ok.textContent='Continuar'; ok.disabled=true;
  ok.onclick=()=>{
    DB.settings.currency=sel; _fmtKey='';
    card.innerHTML=`<div class="logo display">$</div><h1>¿Cómo quieres empezar?</h1>
      <p class="tag">Puedes explorar con datos ficticios y quitarlos cuando quieras, o arrancar limpio.</p>`;
    const b1=document.createElement('button'); b1.className='btn'; b1.style.cssText='width:100%;padding:13px;margin-bottom:10px'; b1.textContent='Explorar con datos de ejemplo';
    const b2=document.createElement('button'); b2.className='btn ghost'; b2.style.cssText='width:100%;padding:13px'; b2.textContent='Empezar de cero';
    const fin=demo=>{
      DB.settings.onboarded=true; save();
      if(demo) cargarDemo();
      ob.classList.remove('on'); ob.textContent='';
      postFijos(); route(); paintStreak();
      if(!demo) setTimeout(()=>toast('Toca el botón «+» para tu primer movimiento 👇'),400);
    };
    b1.onclick=()=>fin(true); b2.onclick=()=>fin(false);
    card.append(b1,b2);
  };
  card.appendChild(ok);
  ob.replaceChildren(card);
}

/* ============================================================
   Arranque
   ============================================================ */
function applyTheme(){
  const t=DB.settings.theme;
  if(t==='auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme',t);
}
function boot(){
  loadDB();
  applyTheme();
  $('#btnSettingsTop').innerHTML=ICONS.gear;
  $('#btnSettingsTop').onclick=()=>{ location.hash='#/ajustes'; };
  $('#fab').innerHTML=ICONS.plus;
  $('#btnNewSide').innerHTML=ICONS.plus+' Nuevo movimiento';
  $('#btnNewSide').onclick=()=>sheetMov();

  /* FAB: toque = nuevo · mantener presionado = repetir último gasto */
  const fab=$('#fab'); let lpT=null;
  fab.addEventListener('pointerdown',()=>{
    lastLong=false;
    lpT=setTimeout(()=>{
      lastLong=true;
      const lastG=[...DB.tx].reverse().find(t=>t.tipo==='g'&&!t.fijoId);
      if(!lastG){ toast('Aún no hay un gasto para repetir.'); return; }
      const nt=addTx({tipo:'g', monto:lastG.monto, cat:lastG.cat, cuenta:lastG.cuenta, nota:lastG.nota});
      render(); saveFx();
      snack(`Repetido: ${cat(nt.cat).emoji} ${cat(nt.cat).nombre} · ${fmtMoney(nt.monto)}`,'Deshacer',()=>{ deleteTx(nt.id); render(); });
    },550);
  });
  const cancel=()=>clearTimeout(lpT);
  fab.addEventListener('pointerup',cancel); fab.addEventListener('pointerleave',cancel);
  fab.addEventListener('pointercancel',cancel); fab.addEventListener('pointermove',cancel);
  fab.addEventListener('click',()=>{ if(!lastLong) sheetMov(); });

  addEventListener('hashchange',route);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){ if(postFijos()>0) render(); paintStreak(); }
  });

  if(!DB.settings.currency){ paintNav(); onboarding(); return; }
  postFijos();
  route(); paintStreak();

  /* validación de paleta en desarrollo: ?valida=1 */
  if(location.search.includes('valida')){
    const cs=getComputedStyle(document.documentElement);
    document.body.dataset.palette=[...Array(13).keys()].map(i=>cs.getPropertyValue('--c'+i).trim()).join(',');
    const th=document.documentElement.dataset.theme;
    const dark = th==='dark' || (th!=='light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.dataset.mode = dark?'dark':'light';
    document.body.dataset.surface = cs.getPropertyValue('--surface').trim();
    const s=document.createElement('script'); s.type='module'; s.src='./validate_palette.js';
    document.body.appendChild(s);
  }
}
boot();

})();
</script>
