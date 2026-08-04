
/* ============================================================
   Tooltip único (hover + foco de teclado)
   ============================================================ */
const tip = $('#tip');
function tipShow(x, y, title, rows){
  tip.textContent='';
  if(title){ const t=document.createElement('div'); t.className='t-t'; t.textContent=title; tip.appendChild(t); }
  for(const r of rows){
    const d=document.createElement('div'); d.className='t-r';
    if(r.color){ const k=document.createElement('i'); k.className='k'; k.style.background=r.color; d.appendChild(k); }
    const v=document.createElement('span'); v.className='v'; v.textContent=r.v; d.appendChild(v);
    if(r.l){ const l=document.createElement('span'); l.className='l'; l.textContent=r.l; d.appendChild(l); }
    tip.appendChild(d);
  }
  tip.classList.add('on');
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let tx = x+14, ty = y-h-12;
  if(tx+w > innerWidth-8) tx = x-w-14;
  if(tx<8) tx=8;
  if(ty<8) ty = y+18;
  tip.style.left = tx+'px'; tip.style.top = ty+'px';
}
function tipHide(){ tip.classList.remove('on'); }
addEventListener('scroll', tipHide, {passive:true, capture:true});

/* util svg */
const NS='http://www.w3.org/2000/svg';
function sv(tag, attrs, parent){
  const el=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='text'){ el.textContent=v; }
    else if(k==='style'){ el.setAttribute('style',v); }
    else el.setAttribute(k,v);
  }
  if(parent) parent.appendChild(el);
  return el;
}
function niceMax(v){
  if(v<=0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for(const m of [1,1.5,2,2.5,3,4,5,6,8,10]) if(m*p>=v) return m*p;
  return 10*p;
}
/* foco accesible en marcas */
function markFocusable(el, label, onShow){
  el.setAttribute('tabindex','0');
  el.setAttribute('role','img');
  el.setAttribute('aria-label', label);
  el.addEventListener('focus', ()=>{ const r=el.getBoundingClientRect(); onShow(r.left+r.width/2, r.top); });
  el.addEventListener('blur', tipHide);
}

/* ============================================================
   Dona: gastos por categoría (top 6 + Otros)
   ============================================================ */
function donutChart(items, total, onPick){
  const box=document.createElement('div'); box.className='donut-c';
  const svg=sv('svg',{viewBox:'0 0 200 200',class:'donut-svg','aria-hidden':'false'});
  const cx=100, cy=100, R=78, r=52;
  const arc=(a0,a1,color,seg)=>{
    const big = (a1-a0)>Math.PI ? 1:0;
    const x0=cx+R*Math.sin(a0), y0=cy-R*Math.cos(a0);
    const x1=cx+R*Math.sin(a1), y1=cy-R*Math.cos(a1);
    const xi=cx+r*Math.sin(a1), yi=cy-r*Math.cos(a1);
    const xj=cx+r*Math.sin(a0), yj=cy-r*Math.cos(a0);
    const p=sv('path',{
      d:`M${x0} ${y0} A${R} ${R} 0 ${big} 1 ${x1} ${y1} L${xi} ${yi} A${r} ${r} 0 ${big} 0 ${xj} ${yj} Z`,
      class:'seg-arc', style:`fill:${seg.color};stroke:var(--surface);stroke-width:2;stroke-linejoin:round`
    },svg);
    return p;
  };
  let a=0;
  for(const seg of items){
    const frac = seg.total/total;
    const a1 = a + frac*2*Math.PI;
    let p;
    if(items.length===1){
      p=sv('g',{},svg);
      sv('circle',{cx,cy,r:(R+r)/2,fill:'none',stroke:seg.color,'stroke-width':R-r},p);
    }else{
      p=arc(a, Math.max(a1, a+0.02), seg, seg);
    }
    const show=(x,y)=> tipShow(x,y, seg.nombre, [{v:fmtMoney(seg.total), l:Math.round(frac*100)+'%', color:seg.color}]);
    p.addEventListener('pointermove', e=>show(e.clientX,e.clientY));
    p.addEventListener('pointerleave', tipHide);
    p.addEventListener('click', ()=>{ tipHide(); onPick && onPick(seg); });
    markFocusable(p, `${seg.nombre}: ${fmtMoney(seg.total)}, ${Math.round(frac*100)}%`, show);
    a=a1;
  }
  sv('text',{x:cx,y:cy-8,'text-anchor':'middle',class:'dc-lbl',text:'Total gastos'},svg);
  sv('text',{x:cx,y:cy+13,'text-anchor':'middle',class:'dc-val num',text:fmtCompact(total)},svg);
  box.appendChild(svg);
  const ley=document.createElement('div'); ley.className='leyenda-cat';
  for(const seg of items){
    const b=document.createElement('button'); b.className='lcat';
    b.innerHTML=`<i class="sw" style="background:${seg.color}"></i><span class="nm">${seg.emoji?seg.emoji+' ':''}${esc(seg.nombre)}</span><span class="pc num">${Math.round(seg.total/total*100)}%</span><span class="mt num">${fmtMoney(seg.total)}</span>`;
    b.onclick=()=> onPick && onPick(seg);
    ley.appendChild(b);
  }
  box.appendChild(ley);
  return box;
}

/* ============================================================
   Columnas agrupadas: ingresos vs gastos por mes
   ============================================================ */
function columnsChart(serie){
  const W=560, H=210, padL=44, padR=8, padT=12, padB=26;
  const wrap=document.createElement('div'); wrap.className='chart-wrap';
  const svg=sv('svg',{viewBox:`0 0 ${W} ${H}`});
  const max = niceMax(Math.max(1,...serie.map(s=>Math.max(s.ing,s.gas)))/100)*100;
  const iw = (W-padL-padR)/serie.length;
  const y = v => padT + (H-padT-padB) * (1 - v/max);
  for(const f of [0,.5,1]){
    const yy=y(max*f);
    sv('line',{x1:padL,x2:W-padR,y1:yy,y2:yy,class:f===0?'baseline':'gridline'},svg);
    sv('text',{x:padL-6,y:yy+3.5,'text-anchor':'end',class:'axis num',text:fmtCompact(max*f)},svg);
  }
  const bw = Math.min(24, iw/2-6);
  const rTop=4;
  const bar=(x,v,color)=>{
    const hh=Math.max(0,y(0)-y(v));
    const rr=Math.min(rTop,hh);
    return sv('path',{d:`M${x} ${y(0)} v${-(hh-rr)} q0 ${-rr} ${rr} ${-rr} h${bw-2*rr} q${rr} 0 ${rr} ${rr} v${hh-rr} Z`,
      class:'bar', style:`fill:${color}`},svg);
  };
  serie.forEach((s,i)=>{
    const cxx = padL + iw*i + iw/2;
    const b1 = s.ing>0 ? bar(cxx-bw-1, s.ing, 'var(--ing)') : null;
    const b2 = s.gas>0 ? bar(cxx+1, s.gas, 'var(--gas)') : null;
    sv('text',{x:cxx,y:H-8,'text-anchor':'middle',class:'axis',text:monthLabel(s.ym,true)},svg);
    const hit=sv('rect',{x:padL+iw*i,y:padT,width:iw,height:H-padT-padB,fill:'transparent',class:'bar'},svg);
    const show=(x,yy)=> tipShow(x,yy, monthLabel(s.ym), [
      {v:fmtMoney(s.ing), l:'ingresos', color:getComputedStyle(document.documentElement).getPropertyValue('--ing')},
      {v:fmtMoney(s.gas), l:'gastos', color:getComputedStyle(document.documentElement).getPropertyValue('--gas')},
      {v:fmtMoney(s.ing-s.gas,{}), l:'balance'},
    ]);
    hit.addEventListener('pointermove', e=>show(e.clientX,e.clientY));
    hit.addEventListener('pointerleave', tipHide);
    markFocusable(hit, `${monthLabel(s.ym)}: ingresos ${fmtMoney(s.ing)}, gastos ${fmtMoney(s.gas)}`, show);
  });
  wrap.appendChild(svg);
  const ley=document.createElement('div'); ley.className='legend';
  ley.innerHTML=`<span class="lg"><i class="sw" style="--lc:var(--ing)"></i>Ingresos</span>
                 <span class="lg"><i class="sw" style="--lc:var(--gas)"></i>Gastos</span>`;
  wrap.appendChild(ley);
  return wrap;
}

/* ============================================================
   Línea de ritmo: acumulado del mes vs mes anterior
   ============================================================ */
function ritmoChart(ym){
  const wrap=document.createElement('div'); wrap.className='chart-wrap';
  const W=560,H=200,padL=44,padR=14,padT=14,padB=24;
  const svg=sv('svg',{viewBox:`0 0 ${W} ${H}`});
  const dim=daysInMonth(ym);
  const esActual = ym===thisMonth();
  const hoy = esActual? +todayKey().slice(8,10) : dim;
  const cur = acumuladoDiario(ym, hoy);
  const prevYm = addMonths(ym,-1);
  const prev = acumuladoDiario(prevYm, daysInMonth(prevYm));
  const dimX = Math.max(dim, prev.length? daysInMonth(prevYm) : 0);
  const max = niceMax(Math.max(1, cur.at(-1)?.acum||0, prev.at(-1)?.acum||0)/100)*100;
  const x = d => padL + (W-padL-padR)*(d-1)/(dimX-1);
  const y = v => padT + (H-padT-padB)*(1-v/max);
  for(const f of [0,.5,1]){
    const yy=y(max*f);
    sv('line',{x1:padL,x2:W-padR,y1:yy,y2:yy,class:f===0?'baseline':'gridline'},svg);
    sv('text',{x:padL-6,y:yy+3.5,'text-anchor':'end',class:'axis num',text:fmtCompact(max*f)},svg);
  }
  for(const d of [1,7,14,21,dimX]) sv('text',{x:x(d),y:H-6,'text-anchor':'middle',class:'axis num',text:d},svg);
  const path = pts => pts.map((p,i)=>`${i?'L':'M'}${x(p.d).toFixed(1)} ${y(p.acum).toFixed(1)}`).join(' ');
  if(prev.length>1) sv('path',{d:path(prev),fill:'none',stroke:'var(--muted)','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round',opacity:.55},svg);
  if(cur.length){
    sv('path',{d:path(cur)+` L${x(cur.at(-1).d)} ${y(0)} L${x(1)} ${y(0)} Z`,fill:'var(--linea-mes)',opacity:.10},svg);
    sv('path',{d:path(cur),fill:'none',stroke:'var(--linea-mes)','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
    const last=cur.at(-1);
    sv('circle',{cx:x(last.d),cy:y(last.acum),r:5,fill:'var(--linea-mes)',stroke:'var(--surface)','stroke-width':2},svg);
  }
  /* crosshair */
  const cross=sv('line',{x1:0,x2:0,y1:padT,y2:H-padB,stroke:'var(--grid)','stroke-width':1,opacity:0},svg);
  const hit=sv('rect',{x:padL,y:padT,width:W-padL-padR,height:H-padT-padB,fill:'transparent'},svg);
  const pv = getComputedStyle(document.documentElement);
  const showAt=(d, cx, cy)=>{
    cross.setAttribute('x1',x(d)); cross.setAttribute('x2',x(d)); cross.setAttribute('opacity',1);
    const rows=[];
    const c1=cur.find(p=>p.d===d), c0=prev.find(p=>p.d===d);
    if(c1) rows.push({v:fmtMoney(c1.acum), l:'este mes', color:pv.getPropertyValue('--linea-mes')});
    if(c0) rows.push({v:fmtMoney(c0.acum), l:'mes anterior', color:pv.getPropertyValue('--muted')});
    tipShow(cx, cy, `Día ${d}`, rows);
  };
  hit.addEventListener('pointermove', e=>{
    const rect=svg.getBoundingClientRect();
    const px=(e.clientX-rect.left)*(W/rect.width);
    const d=Math.max(1,Math.min(dimX,Math.round(1+(px-padL)/((W-padL-padR)/(dimX-1)))));
    showAt(d, e.clientX, e.clientY);
  });
  hit.addEventListener('pointerleave', ()=>{ cross.setAttribute('opacity',0); tipHide(); });
  markFocusable(hit, `Gasto acumulado de ${monthLabel(ym)}: ${fmtMoney(cur.at(-1)?.acum||0)}${prev.length?`, mes anterior ${fmtMoney(prev.at(-1)?.acum||0)}`:''}`,
    (cx,cy)=>showAt(hoy,cx,cy));
  wrap.appendChild(svg);
  const ley=document.createElement('div'); ley.className='legend';
  ley.innerHTML=`<span class="lg"><i class="ln" style="--lc:var(--linea-mes)"></i>Este mes</span>
                 <span class="lg"><i class="ln" style="--lc:var(--muted)"></i>Mes anterior</span>`;
  wrap.appendChild(ley);
  return wrap;
}

/* ============================================================
   Barras horizontales: top categorías (filas HTML)
   ============================================================ */
function topCatsChart(items, onPick, totalRango){
  const box=document.createElement('div');
  const max = Math.max(1,...items.map(i=>i.total));
  const totalAll = totalRango || items.reduce((s,i)=>s+i.total,0)||1;
  for(const it of items){
    const row=document.createElement('button'); row.className='lcat';
    row.style.gap='10px';
    row.innerHTML=`<span style="font-size:15px;flex:none">${it.emoji||''}</span>
      <span style="flex:1;min-width:0">
        <span style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">
          <span class="nm" style="color:var(--ink)">${esc(it.nombre)}</span>
          <span class="mt num">${fmtMoney(it.total)}</span>
        </span>
        <span class="meter" style="--mc:${it.color};display:block"><i style="--w:${(it.total/max*100).toFixed(1)}%"></i></span>
      </span>
      <span class="pc num" style="flex:none">${Math.round(it.total/totalAll*100)}%</span>`;
    row.onclick=()=> onPick && onPick(it);
    box.appendChild(row);
  }
  return box;
}

/* ============================================================
   Calendario de calor del mes (secuencial)
   ============================================================ */
function heatmapChart(ym){
  const wrap=document.createElement('div'); wrap.className='chart-wrap';
  const dim=daysInMonth(ym);
  const perDay=new Array(dim+1).fill(0);
  for(const t of txOfMonth(ym)) if(t.tipo==='g') perDay[+t.fecha.slice(8,10)]+=t.monto;
  const vals=perDay.filter(v=>v>0).sort((a,b)=>a-b);
  const q = f => vals.length? vals[Math.min(vals.length-1, Math.floor(f*vals.length))] : 0;
  const steps=[q(.18),q(.36),q(.54),q(.72),q(.9)];
  const colorOf = v => v<=0 ? 'var(--surface2)' :
    v<=steps[0]?'var(--sq1)': v<=steps[1]?'var(--sq2)': v<=steps[2]?'var(--sq3)': v<=steps[3]?'var(--sq4)': v<=steps[4]?'var(--sq5)':'var(--sq6)';
  const first=parseKey(ym+'-01');
  const off=(first.getDay()+6)%7; /* lunes=0 */
  const rows=Math.ceil((off+dim)/7);
  const CS=30,G=4,padT=18;
  const W=7*CS+6*G, H=padT+rows*CS+(rows-1)*G;
  const svg=sv('svg',{viewBox:`0 0 ${W} ${H}`,style:'max-width:320px;margin:0 auto'});
  ['L','M','X','J','V','S','D'].forEach((d,i)=> sv('text',{x:i*(CS+G)+CS/2,y:11,'text-anchor':'middle',class:'axis',text:d},svg));
  for(let d=1;d<=dim;d++){
    const idx=off+d-1, col=idx%7, row=Math.floor(idx/7);
    const v=perDay[d];
    const cell=sv('rect',{x:col*(CS+G),y:padT+row*(CS+G),width:CS,height:CS,rx:7,class:'hm-cell',
      style:`fill:${colorOf(v)}`},svg);
    const lum = v>0 && (v>steps[2]);
    sv('text',{x:col*(CS+G)+CS/2,y:padT+row*(CS+G)+CS/2+3.5,'text-anchor':'middle',
      style:`font-size:10px;font-weight:600;pointer-events:none;fill:${v<=0?'var(--muted)':lum?'var(--bg)':'var(--ink2)'}`,text:d},svg);
    const dk=`${ym}-${p2(d)}`;
    const show=(x,y)=> tipShow(x,y, dayLabel(dk), [{v:fmtMoney(v), l:'gastado'}]);
    cell.addEventListener('pointermove',e=>show(e.clientX,e.clientY));
    cell.addEventListener('pointerleave',tipHide);
    markFocusable(cell, `${dayLabel(dk)}: ${fmtMoney(v)}`, show);
  }
  wrap.appendChild(svg);
  return wrap;
}

/* ============================================================
   Barra apilada 50/30/20
   ============================================================ */
function stack503020(ym){
  const ing = ingresosBase(txOfMonth(ym));
  const grupos={nec:0,des:0,aho:0};
  for(const t of txOfMonth(ym)) if(t.tipo==='g'){ const g=cat(t.cat).grupo; if(grupos[g]!=null) grupos[g]+=t.monto; else grupos.des+=t.monto; }
  const escala = Math.max(ing, grupos.nec+grupos.des+grupos.aho);
  const box=document.createElement('div');
  if(ing<=0){
    box.innerHTML=`<p class="card-sub">Registra tus ingresos del mes para ver la regla 50/30/20.</p>`;
    return box;
  }
  const defs=[
    {k:'nec', n:'Necesidades', meta:50, color:'var(--c0)'},
    {k:'des', n:'Deseos',      meta:30, color:'var(--c4)'},
    {k:'aho', n:'Ahorro',      meta:20, color:'var(--c5)'},
  ];
  const bar=document.createElement('div');
  bar.style.cssText='display:flex;height:16px;border-radius:999px;overflow:hidden;gap:2px;background:var(--surface2)';
  for(const d of defs){
    const pc=grupos[d.k]/escala*100;
    if(pc<=0) continue;
    const i=document.createElement('i');
    i.style.cssText=`display:block;height:100%;flex:0 0 ${pc}%;background:${d.color}`;
    i.title=`${d.n}: ${Math.round(pc)}%`;
    bar.appendChild(i);
  }
  box.appendChild(bar);
  const list=document.createElement('div'); list.style.marginTop='10px';
  for(const d of defs){
    const pc=Math.round(grupos[d.k]/ing*100);
    const diff=pc-d.meta;
    const est = d.k==='aho'
      ? (diff>=0?['al día','var(--good)']:['por debajo','var(--muted)'])
      : (diff<=0?['dentro de la meta','var(--good)']:['+'+diff+' pts sobre la meta','var(--crit-text)']);
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 2px;font-size:13px';
    row.innerHTML=`<i class="sw" style="width:10px;height:10px;border-radius:3px;background:${d.color};flex:none"></i>
      <span style="font-weight:650">${d.n}</span>
      <span class="card-sub">meta ${d.meta}%</span>
      <span class="sp"></span>
      <b class="num">${pc}%</b>
      <span style="font-size:12px;font-weight:600;color:${est[1]}">${est[0]}</span>`;
    list.appendChild(row);
  }
  box.appendChild(list);
  box.insertAdjacentHTML('beforeend',`<p class="card-sub" style="margin-top:8px">Sobre ingresos de ${fmtMoney(ing)} este mes. El abono a metas cuenta como ahorro.</p>`);
  return box;
}

/* ============================================================
   Tarjeta de gráfica con vista tabla
   ============================================================ */
function chartCard({title, sub, chartEl, table, extraHead}){
  const c=document.createElement('section'); c.className='card';
  const head=document.createElement('div'); head.className='card-head';
  head.innerHTML=`<div><div class="card-title">${esc(title)}</div>${sub?`<div class="card-sub">${esc(sub)}</div>`:''}</div><span class="sp"></span>`;
  if(extraHead) head.appendChild(extraHead);
  let tbtn=null, showing=false, tblEl=null;
  if(table){
    tbtn=document.createElement('button');
    tbtn.className='iconbtn'; tbtn.style.cssText='width:32px;height:32px';
    tbtn.setAttribute('aria-label','Ver como tabla'); tbtn.setAttribute('aria-pressed','false');
    tbtn.innerHTML=ICONS.table;
    head.appendChild(tbtn);
  }
  c.appendChild(head);
  const body=document.createElement('div');
  body.appendChild(chartEl);
  c.appendChild(body);
  if(table){
    tbtn.onclick=()=>{
      showing=!showing;
      tbtn.setAttribute('aria-pressed', String(showing));
      if(showing){
        if(!tblEl){
          tblEl=document.createElement('div'); tblEl.className='tbl-scroll';
          const t=document.createElement('table'); t.className='tbl';
          t.innerHTML=`<thead><tr>${table.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${table.rows.map(r=>`<tr>${r.map((v,i)=>`<td class="${i>0?'n':''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>`;
          tblEl.appendChild(t);
        }
        body.replaceChildren(tblEl);
      }else body.replaceChildren(chartEl);
    };
  }
  return c;
}

/* ============================================================
   Íconos
   ============================================================ */
const ICONS={
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 6h12M8.5 12h12M8.5 18h12"/><circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>',
  wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11.5a2 2 0 0 1 2 2v.5"/><path d="M3.5 7.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-15z"/><circle cx="16.5" cy="14" r="1.4" fill="currentColor" stroke="none"/></svg>',
  chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3.5"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.35.95a7 7 0 0 0-2.42-1.4L13.7 2.6h-3.4l-.39 2.54a7 7 0 0 0-2.42 1.4l-2.35-.95-2 3.46 2 1.55A7 7 0 0 0 5 12c0 .48.05.94.14 1.4l-2 1.55 2 3.46 2.35-.95a7 7 0 0 0 2.42 1.4l.39 2.54h3.4l.39-2.54a7 7 0 0 0 2.42-1.4l2.35.95 2-3.46-2-1.55c.09-.46.14-.92.14-1.4z"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chevL:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6 8.5 12l6 6"/></svg>',
  chevR:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6l6 6-6 6"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5l-6.5 7L10 19M4 12h16.5"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13.5h10L18 7M10 11v6M14 11v6"/></svg>',
  copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
  table:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9.5 9.5v10M15.5 9.5v10"/></svg>',
  down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12m0 0 5-5m-5 5-5-5"/><path d="M4.5 20h15"/></svg>',
  up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V8m0 0 5 5m-5-5-5 5"/><path d="M4.5 4h15"/></svg>',
  swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v13M7 4 3.5 7.5M7 4l3.5 3.5M17 20V7m0 13 3.5-3.5M17 20l-3.5-3.5"/></svg>',
  pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l.8-3.2L16.6 5a1.8 1.8 0 0 1 2.5 0l0 0a1.8 1.8 0 0 1 0 2.5L7.2 19.2 4 20z"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>',
  backsp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 5h11A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-11L2.5 12 8.5 5z"/><path d="M11.5 9.5l5 5m0-5-5 5"/></svg>',
};

/* ============================================================
   Sheet genérico
   ============================================================ */
const sheet=$('#sheet'), backdrop=$('#backdrop');
let sheetOpen=false, onSheetClose=null, sheetTrigger=null;
function openSheet(build){
  if(sheetOpen){ onSheetClose && onSheetClose(); onSheetClose=null; }
  sheetTrigger=document.activeElement;
  sheet.textContent='';
  sheet.insertAdjacentHTML('beforeend','<div class="grab"></div>');
  build(sheet);
  sheet.classList.add('on'); backdrop.classList.add('on');
  sheetOpen=true;
  document.body.style.overflow='hidden';
  const app=$('#app'); if(app) app.inert=true;
  const f=sheet.querySelector('[autofocus]');
  setTimeout(()=>{ (f||sheet).focus(); },90);
}
function closeSheet(){
  if(!sheetOpen) return;
  sheet.classList.remove('on'); backdrop.classList.remove('on');
  sheetOpen=false;
  document.body.style.overflow='';
  const app=$('#app'); if(app) app.inert=false;
  onSheetClose && onSheetClose(); onSheetClose=null;
  setTimeout(()=>{ if(!sheetOpen) sheet.textContent=''; }, 320);
  if(sheetTrigger && document.contains(sheetTrigger)) sheetTrigger.focus();
  sheetTrigger=null;
}
backdrop.addEventListener('click', closeSheet);
addEventListener('keydown', e=>{ if(e.key==='Escape' && sheetOpen) closeSheet(); });
/* trampa de foco dentro del sheet */
sheet.addEventListener('keydown', e=>{
  if(e.key!=='Tab' || !sheetOpen) return;
  const f=[...sheet.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(x=>x.offsetParent!==null);
  if(!f.length) return;
  const first=f[0], last=f[f.length-1];
  if(e.shiftKey && (document.activeElement===first||document.activeElement===sheet)){ last.focus(); e.preventDefault(); }
  else if(!e.shiftKey && document.activeElement===last){ first.focus(); e.preventDefault(); }
});
function sheetHead(el, title, extra){
  sheet.setAttribute('aria-label', title);
  const h=document.createElement('div'); h.className='sh-head';
  h.innerHTML=`<span class="sh-title">${esc(title)}</span><span class="sp"></span>`;
  if(extra) h.appendChild(extra);
  const x=document.createElement('button'); x.className='iconbtn'; x.setAttribute('aria-label','Cerrar'); x.innerHTML=ICONS.x;
  x.onclick=closeSheet; h.appendChild(x);
  el.appendChild(h);
  return h;
}

/* ============================================================
   Teclado calculadora
   ============================================================ */
function makeKeypad(displayEl, hintEl, onChange){
  const st={ tokens:[], cur:'' };  /* tokens: [num,'+',num,...] ; cur = número en edición */
  const dsep=decSep()||',';
  const dec=curDecimals();
  const fmtEntry = s=>{
    if(s==='') return '0';
    const [i,f]=s.split('.');
    const gi=(+i||0).toLocaleString(curLocale(DB.settings.currency),{maximumFractionDigits:0});
    return f!=null? gi+dsep+f : gi;
  };
  const evalTokens=()=>{
    const seq=[...st.tokens]; if(st.cur!=='') seq.push(st.cur);
    if(!seq.length) return 0;
    if(typeof seq.at(-1)==='string' && isNaN(+seq.at(-1))) seq.pop();
    /* × primero */
    let vals=[+seq[0]||0], ops=[];
    for(let i=1;i<seq.length;i+=2){
      const op=seq[i], n=+seq[i+1]||0;
      if(op==='×') vals[vals.length-1]*=n;
      else { ops.push(op); vals.push(n); }
    }
    let r=vals[0];
    ops.forEach((op,i)=>{ r = op==='+' ? r+vals[i+1] : r-vals[i+1]; });
    return Math.max(0,r);
  };
  const cents=()=> Math.round(evalTokens()*100);
  const paint=()=>{
    const hasExpr=st.tokens.length>0;
    displayEl.classList.toggle('expr',hasExpr);
    let html=`<span class="cur">${esc(currencySymbol())}</span>`;
    for(const t of st.tokens){
      if(t==='+'||t==='−'||t==='×') html+=`<span class="op">${t}</span>`;
      else html+=`<span class="num">${esc(fmtEntry(t))}</span>`;
    }
    html+=`<span class="num">${esc(fmtEntry(st.cur))}</span>`;
    displayEl.innerHTML=html;
    hintEl.textContent = hasExpr ? `= ${fmtMoney(cents())}` : '';
    onChange && onChange(cents());
  };
  const press=k=>{
    if(k>='0'&&k<='9'){
      const [i,f]=st.cur.split('.');
      if(f!=null){ if(f.length>=dec) return; st.cur+=k; }
      else{ if((i||'').replace(/^0+/,'').length>=9) return; st.cur = (st.cur==='0'?'':st.cur)+k; }
    }
    else if(k==='sep'){ if(dec===0) return; if(!st.cur.includes('.')) st.cur=(st.cur||'0')+'.'; }
    else if(k==='+'||k==='−'||k==='×'){
      if(st.cur===''){ if(st.tokens.length) st.tokens[st.tokens.length-1]=k; return paint(); }
      st.tokens.push(st.cur,k); st.cur='';
    }
    else if(k==='back'){
      if(st.cur!=='') st.cur=st.cur.slice(0,-1);
      else if(st.tokens.length){ st.tokens.pop(); st.cur=st.tokens.pop()||''; }
    }
    else if(k==='eq'){ const c=cents(); st.tokens=[]; st.cur = c? String(c/100):''; }
    paint();
  };
  const pad=document.createElement('div'); pad.className='keypad';
  const keys=[ '7','8','9','+','4','5','6','−','1','2','3','×','sep','0','back','eq' ];
  for(const k of keys){
    const b=document.createElement('button'); b.className='key';
    b.dataset.k=k;
    if(k==='sep'){ b.textContent=dsep; if(dec===0){ b.style.opacity='.25'; } }
    else if(k==='back'){ b.innerHTML=ICONS.backsp; b.setAttribute('aria-label','Borrar'); }
    else if(k==='eq'){ b.textContent='='; b.className='key op'; }
    else if('+−×'.includes(k)) { b.textContent=k; b.className='key op'; }
    else b.textContent=k;
    b.addEventListener('click',()=>press(k));
    pad.appendChild(b);
  }
  const keyHandler=e=>{
    if(!sheetOpen) return;
    const t=e.target;
    if(t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;           /* no secuestrar la nota/fecha */
    if(e.key==='Enter' && document.activeElement?.tagName==='BUTTON') return; /* Enter activa el botón enfocado */
    if(e.key>='0'&&e.key<='9') press(e.key);
    else if(e.key===','||e.key==='.') press('sep');
    else if(e.key==='+') press('+');
    else if(e.key==='-') press('−');
    else if(e.key==='*'||e.key==='x') press('×');
    else if(e.key==='Backspace') press('back');
    else if(e.key==='='||e.key==='Enter') press('eq');
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', keyHandler);
  onSheetClose=(prev=>()=>{ removeEventListener('keydown',keyHandler); prev&&prev(); })(onSheetClose);
  paint();
  return { pad, cents, set(c){ st.tokens=[]; st.cur = c>0? (c/100).toFixed(dec):''; paint(); } };
}
function currencySymbol(){
  const parts = moneyFmt().formatToParts(1);
  return (parts.find(p=>p.type==='currency')||{}).value || DB.settings.currency;
}
