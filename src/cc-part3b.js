
/* ============================================================
   Estado de UI + entrada de dinero en campos secundarios
   ============================================================ */
const S={
  movs:{ ym:thisMonth(), tipo:'all', cat:null, q:'' },
  bym:thisMonth(), pane:'pres',
  rep:{ range:'mes', ym:thisMonth() },
};
function parseMoneyInput(str){
  const neg = /^\s*-/.test(String(str||''));
  let s=String(str||'').trim().replace(/[^\d.,]/g,'');
  if(!s) return 0;
  const lastC=s.lastIndexOf(','), lastD=s.lastIndexOf('.');
  let dec='';
  if(lastC>=0 && lastD>=0){ const p=Math.max(lastC,lastD); dec=s.slice(p+1); s=s.slice(0,p); }
  else if(lastC>=0 || lastD>=0){
    const p=Math.max(lastC,lastD); const after=s.slice(p+1);
    if(after.length<=2 && curDecimals()>0){ dec=after; s=s.slice(0,p); }
  }
  s=s.replace(/[.,]/g,'');
  const v=(+s||0) + (dec? (+dec.padEnd(2,'0').slice(0,2))/100 : 0);
  return Math.round(v*100) * (neg?-1:1);
}
function moneyInput(id, placeholder, valueCents){
  return `<div class="field notewrap"><input id="${id}" inputmode="decimal" autocomplete="off" aria-label="${esc(placeholder||'Monto')}" placeholder="${esc(placeholder||'0')}" value="${valueCents? esc((valueCents/100).toFixed(curDecimals()).replace('.',decSep())) :''}"></div>`;
}

/* ============================================================
   Sheet: registrar / editar movimiento
   ============================================================ */
let lastLong=false;
function sheetMov(editTx, presetTipo, presetMonto){
  const edit = !!editTx;
  const st={
    tipo: editTx? editTx.tipo : (presetTipo||'g'),
    cat: editTx? editTx.cat : null,
    cuenta: editTx? editTx.cuenta : (DB.settings.lastAccount||DB.accounts[0].id),
    cuentaDestino: editTx? (editTx.cuentaDestino|| (activeAccounts()[1]||{}).id) : (activeAccounts().find(a=>a.id!==(DB.settings.lastAccount||''))||activeAccounts()[1]||{}).id,
    fecha: editTx? editTx.fecha : todayKey(),
    nota: editTx? (editTx.nota||'') : '',
  };
  openSheet(el=>{
    sheetHead(el, edit?'Editar movimiento':'Nuevo movimiento');
    const body=document.createElement('div'); body.className='sh-body'; el.appendChild(body);

    const seg=document.createElement('div'); seg.className='seg';
    seg.innerHTML=`<button class="g" data-t="g" aria-pressed="false">Gasto</button><button class="i" data-t="i" aria-pressed="false">Ingreso</button><button data-t="t" aria-pressed="false">Transferencia</button>`;
    body.appendChild(seg);

    const amount=document.createElement('div'); amount.className='amount num'; amount.id='amountD';
    const hint=document.createElement('div'); hint.className='amount-hint';
    body.appendChild(amount); body.appendChild(hint);

    const cols=document.createElement('div'); cols.className='sh-cols';
    const colL=document.createElement('div'); const colR=document.createElement('div');
    cols.appendChild(colR); cols.appendChild(colL); body.appendChild(cols);

    const actions=document.createElement('div');
    actions.style.cssText='display:flex;gap:8px;padding:6px 2px 4px';

    const kp=makeKeypad(amount, hint, c=>{ paintSaveState(c); });
    if(edit) kp.set(editTx.monto);
    else if(presetMonto>0) kp.set(presetMonto);

    /* fila fecha + nota (antes de las columnas, ancho completo) */
    const opt1=document.createElement('div'); opt1.className='optrow';
    opt1.innerHTML=`
      <button class="chip" data-f="hoy">Hoy</button>
      <button class="chip" data-f="ayer">Ayer</button>
      <label class="chip" style="position:relative">${ICONS.cal}<span id="fLbl"></span>
        <input id="fInp" type="date" max="${todayKey()}" style="position:absolute;inset:0;opacity:0;width:100%" aria-label="Elegir fecha">
      </label>
      <button class="chip" id="notaChip">✏️ Nota</button>`;
    body.insertBefore(opt1, cols);
    const notaWrap=document.createElement('div'); notaWrap.className='notewrap hidden';
    notaWrap.innerHTML=`<input id="notaInp" maxlength="140" aria-label="Nota" placeholder="Nota (opcional)" value="${esc(st.nota)}">`;
    body.insertBefore(notaWrap, cols);
    if(st.nota) notaWrap.classList.remove('hidden');

    /* cuentas */
    const cuentasRow=document.createElement('div'); cuentasRow.className='optrow';
    body.insertBefore(cuentasRow, cols);

    colL.appendChild(kp.pad);

    /* panel derecho: categorías o transferencia */
    const catBox=document.createElement('div'); colR.appendChild(catBox);

    actions.style.padding='8px 16px calc(10px + env(safe-area-inset-bottom))';
    el.appendChild(actions);

    const yesterday=()=>{ const d=new Date(); d.setDate(d.getDate()-1); return dateKey(d); };
    function paintFecha(){
      opt1.querySelector('[data-f="hoy"]').classList.toggle('on', st.fecha===todayKey());
      opt1.querySelector('[data-f="ayer"]').classList.toggle('on', st.fecha===yesterday());
      const other = st.fecha!==todayKey() && st.fecha!==yesterday();
      opt1.querySelector('label.chip').classList.toggle('on', other);
      $('#fLbl',opt1).textContent = other? shortDate(st.fecha) : '';
      $('#fInp',opt1).value = st.fecha;
    }
    opt1.querySelector('[data-f="hoy"]').onclick=()=>{ st.fecha=todayKey(); paintFecha(); };
    opt1.querySelector('[data-f="ayer"]').onclick=()=>{ st.fecha=yesterday(); paintFecha(); };
    $('#fInp',opt1).onchange=e=>{ if(e.target.value){ st.fecha=e.target.value; paintFecha(); } };
    $('#notaChip',opt1).onclick=()=>{ notaWrap.classList.toggle('hidden'); if(!notaWrap.classList.contains('hidden')) $('#notaInp',notaWrap).focus(); };

    function paintCuentas(){
      const as=activeAccounts();
      cuentasRow.innerHTML='';
      if(st.tipo!=='t' && as.length>1){
        for(const a of as){
          const b=document.createElement('button'); b.className='chip'+(st.cuenta===a.id?' on':'');
          b.textContent=`${a.emoji} ${a.nombre}`;
          b.onclick=()=>{ st.cuenta=a.id; paintCuentas(); };
          cuentasRow.appendChild(b);
        }
      }
    }

    function paintCats(){
      catBox.innerHTML='';
      if(st.tipo==='t'){
        const as=activeAccounts();
        if(as.length<2){
          catBox.innerHTML=`<div class="empty"><div class="em">🏦</div><div class="t">Necesitas otra cuenta</div><div class="s">Crea una segunda cuenta para transferir dinero entre ellas.</div></div>`;
          const b=document.createElement('button'); b.className='btn ghost'; b.style.margin='0 auto'; b.textContent='Crear cuenta';
          b.onclick=()=>{ const m=kp.cents(); closeSheet(); sheetCuenta(null, ()=>sheetMov(null,'t',m)); };
          catBox.querySelector('.empty').appendChild(b);
          return;
        }
        const mk=(lbl,key)=>`<div class="notewrap"><label style="font-size:12px;font-weight:700;color:var(--muted)">${lbl}</label>
          <select id="${key}" aria-label="${lbl}" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:10px 13px;margin-top:4px">
            ${as.map(a=>`<option value="${a.id}">${a.emoji} ${esc(a.nombre)} · ${fmtMoney(accountBalance(a.id))}</option>`).join('')}
          </select></div>`;
        catBox.innerHTML=mk('Desde','tDesde')+mk('Hacia','tHacia');
        $('#tDesde',catBox).value=st.cuenta;
        if(st.cuentaDestino) $('#tHacia',catBox).value=st.cuentaDestino;
        $('#tDesde',catBox).onchange=e=>st.cuenta=e.target.value;
        $('#tHacia',catBox).onchange=e=>st.cuentaDestino=e.target.value;
      }else{
        const grid=document.createElement('div'); grid.className='catgrid';
        const list=cats(st.tipo).slice().sort((a,b)=>(DB.usage[b.id]||0)-(DB.usage[a.id]||0));
        for(const c of list){
          const b=document.createElement('button'); b.className='catbtn'+(st.cat===c.id?' sel':'');
          b.setAttribute('aria-pressed', String(st.cat===c.id));
          b.style.setProperty('--catc', catColorVar(c));
          b.innerHTML=`<span class="em">${c.emoji}</span><span class="nm">${esc(c.nombre)}</span>`;
          b.onclick=()=>{
            st.cat=c.id;
            if(!edit){ trySave(); }
            else { $$('.catbtn',grid).forEach(x=>{x.classList.remove('sel');x.setAttribute('aria-pressed','false');}); b.classList.add('sel'); b.setAttribute('aria-pressed','true'); }
          };
          grid.appendChild(b);
        }
        const hintCat=document.createElement('p'); hintCat.className='card-sub'; hintCat.style.cssText='text-align:center;margin-top:2px';
        hintCat.textContent = edit? 'Elige la categoría y guarda' : 'Escribe el monto y toca una categoría para guardar';
        catBox.appendChild(hintCat);
        catBox.appendChild(grid);
      }
      paintCuentas();
    }

    function setTipo(t){
      st.tipo=t;
      if(t!=='t' && st.cat && cat(st.cat).tipo!==t) st.cat=null;
      $$('.seg button',seg).forEach(b=>{ const on=b.dataset.t===t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      paintCats(); paintActions();
    }
    $$('button',seg).forEach(b=> b.onclick=()=>setTipo(b.dataset.t));

    function trySave(){
      const c=kp.cents();
      if(c<=0){ hint.textContent='Escribe un monto primero'; matchMedia('(prefers-reduced-motion: reduce)').matches || amount.animate?.([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}],{duration:220}); return; }
      st.nota=$('#notaInp',notaWrap)?.value||'';
      if(st.tipo==='t'){
        if(!st.cuentaDestino || st.cuenta===st.cuentaDestino){ toast('Elige dos cuentas distintas.'); return; }
        doSave(c); return;
      }
      if(!st.cat){ toast('Elige una categoría.'); return; }
      doSave(c);
    }
    function doSave(c){
      if(edit){
        updateTx(editTx.id,{tipo:st.tipo, monto:c, cat:st.tipo==='t'?null:st.cat, cuenta:st.cuenta,
          cuentaDestino:st.tipo==='t'?st.cuentaDestino:undefined, fecha:st.fecha, nota:st.nota});
        closeSheet(); render(); toast('Cambios guardados ✓');
      }else{
        addTx({tipo:st.tipo, monto:c, cat:st.cat, cuenta:st.cuenta, cuentaDestino:st.cuentaDestino, fecha:st.fecha, nota:st.nota});
        closeSheet(); saveFx(); render();
      }
    }
    function paintSaveState(c){
      const b=$('#btnSaveMov',actions); if(b) b.disabled = c<=0;
    }
    function paintActions(){
      actions.innerHTML='';
      if(edit){
        const del=document.createElement('button'); del.className='btn danger small'; del.innerHTML=ICONS.trash+' Borrar';
        del.onclick=()=>{
          const t=deleteTx(editTx.id); closeSheet(); render();
          snack('Movimiento borrado','Deshacer',()=>{ restoreTx(t); render(); });
        };
        const dup=document.createElement('button'); dup.className='btn ghost small'; dup.innerHTML=ICONS.copy+' Duplicar';
        dup.onclick=()=>{
          const c=kp.cents(); if(c<=0) return;
          addTx({tipo:st.tipo, monto:c, cat:st.cat, cuenta:st.cuenta, cuentaDestino:st.cuentaDestino, fecha:todayKey(), nota:st.nota});
          closeSheet(); render(); toast('Movimiento duplicado ✓');
        };
        const sv=document.createElement('button'); sv.className='btn small'; sv.id='btnSaveMov'; sv.textContent='Guardar cambios';
        sv.onclick=trySave;
        actions.append(del,dup,document.createElement('span'),sv);
        actions.children[2].className='sp';
      }else if(st.tipo==='t'){
        const sv=document.createElement('button'); sv.className='btn'; sv.id='btnSaveMov'; sv.style.flex='1'; sv.textContent='Transferir';
        sv.onclick=trySave;
        actions.appendChild(sv);
      }
      paintSaveState(kp.cents());
    }

    setTipo(st.tipo);
    paintFecha();
    if(edit && st.tipo!=='t'){ /* marcar la categoría actual */ }
  });
}
function saveFx(){
  const fx=$('#savefx'); fx.classList.add('on');
  const svgp=fx.querySelector('path');
  svgp.style.animation='none'; void svgp.offsetWidth; svgp.style.animation='';
  setTimeout(()=>fx.classList.remove('on'), 750);
}

/* ============================================================
   Sheets: cuenta, categoría, meta, abono, fijo, presupuesto
   ============================================================ */
const EMOJIS=['💵','💳','🏦','🐖','📈','🪙','💼','🛒','🍔','☕','🚌','🚗','⛽','🏠','💡','📱','💊','🏥','🎓','📚','🎬','🎮','⚽','👕','👟','🎁','✈️','🏖️','🐶','🐱','👶','🔧','🧾','🍺','🎵','📷','🌿','🧹','❤️','📦'];
function emojiPicker(sel, onPick){
  const g=document.createElement('div'); g.className='catgrid'; g.style.gridTemplateColumns='repeat(8,1fr)';
  for(const e of EMOJIS){
    const b=document.createElement('button'); b.className='catbtn'; b.style.padding='6px 2px';
    b.innerHTML=`<span class="em" style="width:32px;height:32px;font-size:17px;background:var(--surface3)">${e}</span>`;
    if(e===sel) b.classList.add('sel'), b.style.setProperty('--catc','var(--accent)');
    b.onclick=()=>{ $$('.catbtn',g).forEach(x=>{x.classList.remove('sel');x.style.removeProperty('--catc');}); b.classList.add('sel'); b.style.setProperty('--catc','var(--accent)'); onPick(e); };
    g.appendChild(b);
  }
  return g;
}
function sheetCuenta(acc, onDone){
  const st={ emoji: acc?.emoji||'🏦' };
  openSheet(el=>{
    sheetHead(el, acc? 'Editar cuenta':'Nueva cuenta');
    const b=document.createElement('div'); b.className='sh-body'; el.appendChild(b);
    b.innerHTML=`
      <div class="notewrap"><input id="cNombre" aria-label="Nombre de la cuenta" placeholder="Nombre (ej. Banco, Tarjeta…)" maxlength="24" value="${esc(acc?.nombre||'')}" autofocus></div>
      ${moneyInput('cSaldo', 'Saldo inicial', acc?.saldoInicial)}
      <p class="card-sub" style="padding:0 4px 6px">El saldo inicial es cuánto había en la cuenta antes de empezar a registrar.</p>`;
    b.appendChild(emojiPicker(st.emoji, e=>st.emoji=e));
    const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;margin-top:10px';
    if(acc && activeAccounts().length>1 && !DB.tx.some(t=>t.cuenta===acc.id||t.cuentaDestino===acc.id)){
      const del=document.createElement('button'); del.className='btn danger small'; del.textContent='Eliminar';
      del.onclick=()=>{ DB.accounts=DB.accounts.filter(a=>a.id!==acc.id); if(DB.settings.lastAccount===acc.id) DB.settings.lastAccount=DB.accounts[0].id; save(); closeSheet(); render(); };
      row.appendChild(del);
    }else if(acc && activeAccounts().length>1){
      const del=document.createElement('button'); del.className='btn danger small'; del.textContent=acc.archivada?'Restaurar':'Archivar';
      del.onclick=()=>{
        acc.archivada=!acc.archivada;
        if(DB.settings.lastAccount===acc.id) DB.settings.lastAccount=activeAccounts()[0].id;
        save(); closeSheet(); render();
        if(acc.archivada && accountBalance(acc.id)!==0) toast('Cuenta archivada: su saldo deja de contar en el total. Puedes restaurarla cuando quieras.');
      };
      row.appendChild(del);
    }
    const sp=document.createElement('span'); sp.className='sp'; row.appendChild(sp);
    const ok=document.createElement('button'); ok.className='btn'; ok.textContent='Guardar';
    ok.onclick=()=>{
      const nombre=$('#cNombre',b).value.trim(); if(!nombre){ toast('Escribe un nombre.'); return; }
      const saldo=parseMoneyInput($('#cSaldo',b).value);
      if(acc){ Object.assign(acc,{nombre, emoji:st.emoji, saldoInicial:saldo}); }
      else DB.accounts.push({id:uid(), nombre, emoji:st.emoji, saldoInicial:saldo, archivada:false});
      save(); closeSheet(); render();
      if(onDone) setTimeout(onDone, 60);
    };
    row.appendChild(ok); b.appendChild(row);
  });
}
function sheetCategoria(c, tipoDefault){
  const st={ emoji:c?.emoji||'🏷️', tipo:c?.tipo||tipoDefault||'g', grupo:c?.grupo|| (tipoDefault==='i'?'base':'des') };
  openSheet(el=>{
    sheetHead(el, c? 'Editar categoría':'Nueva categoría');
    const b=document.createElement('div'); b.className='sh-body'; el.appendChild(b);
    const grupos = st.tipo==='g'
      ? [['nec','Necesidad'],['des','Deseo'],['aho','Ahorro']]
      : [['base','Ingreso normal'],['aho','Rendimiento'],['excl','No contar en 50/30/20']];
    b.innerHTML=`
      <div class="notewrap"><input id="kNombre" aria-label="Nombre de la categoría" placeholder="Nombre de la categoría" maxlength="26" value="${esc(c?.nombre||'')}" autofocus></div>
      ${c?'' :`<div class="seg" id="kTipo" style="margin:4px 2px"><button data-t="g" class="${st.tipo==='g'?'on':''}">Gasto</button><button data-t="i" class="${st.tipo==='i'?'on':''}">Ingreso</button></div>`}
      <div class="notewrap"><label style="font-size:12px;font-weight:700;color:var(--muted)">Grupo (regla 50/30/20)</label>
        <select id="kGrupo" aria-label="Grupo para la regla 50/30/20" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:10px 13px;margin-top:4px">
          ${grupos.map(g=>`<option value="${g[0]}" ${g[0]===st.grupo?'selected':''}>${g[1]}</option>`).join('')}
        </select></div>`;
    b.appendChild(emojiPicker(st.emoji, e=>st.emoji=e));
    if(!c){ $$('#kTipo button',b).forEach(bt=>bt.onclick=()=>{
      st.tipo=bt.dataset.t;
      $$('#kTipo button',b).forEach(x=>x.classList.toggle('on', x===bt));
      const gs = st.tipo==='g' ? [['nec','Necesidad'],['des','Deseo'],['aho','Ahorro']] : [['base','Ingreso normal'],['aho','Rendimiento'],['excl','No contar en 50/30/20']];
      st.grupo = gs[0][0];
      $('#kGrupo',b).innerHTML = gs.map(g=>`<option value="${g[0]}">${g[1]}</option>`).join('');
    }); }
    const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;margin-top:10px';
    if(c && !c.fija){
      const del=document.createElement('button'); del.className='btn danger small'; del.textContent=c.archivada?'Restaurar':'Archivar';
      del.onclick=()=>{ c.archivada=!c.archivada; save(); closeSheet(); render(); toast(c.archivada?'Categoría archivada. Sus movimientos se conservan.':'Categoría restaurada ✓'); };
      row.appendChild(del);
    }
    const sp=document.createElement('span'); sp.className='sp'; row.appendChild(sp);
    const ok=document.createElement('button'); ok.className='btn'; ok.textContent='Guardar';
    ok.onclick=()=>{
      const nombre=$('#kNombre',b).value.trim(); if(!nombre){ toast('Escribe un nombre.'); return; }
      const grupo=$('#kGrupo',b).value;
      if(c){ Object.assign(c,{nombre, emoji:st.emoji, grupo}); }
      else{
        const usados=DB.cats.filter(x=>x.tipo===st.tipo).map(x=>x.color);
        let slot=[...Array(12).keys()].sort((a,b)=>usados.filter(u=>u===a).length-usados.filter(u=>u===b).length)[0];
        DB.cats.push({id:uid(), nombre, emoji:st.emoji, color:slot, tipo:st.tipo, grupo});
      }
      save(); closeSheet(); render();
    };
    row.appendChild(ok); b.appendChild(row);
  });
}
function sheetMeta(m){
  const st={emoji:m?.emoji||'🎯'};
  openSheet(el=>{
    sheetHead(el, m?'Editar meta':'Nueva meta de ahorro');
    const b=document.createElement('div'); b.className='sh-body'; el.appendChild(b);
    b.innerHTML=`
      <div class="notewrap"><input id="mNombre" aria-label="Nombre de la meta" placeholder="¿Para qué ahorras? (ej. Viaje, Moto…)" maxlength="30" value="${esc(m?.nombre||'')}" autofocus></div>
      ${moneyInput('mObj','Monto objetivo', m?.objetivo)}
      <div class="notewrap"><label style="font-size:12px;font-weight:700;color:var(--muted)">Fecha límite (opcional)</label>
        <input id="mLim" type="date" aria-label="Fecha límite" value="${esc(m?.fechaLimite||'')}" style="margin-top:4px"></div>`;
    b.appendChild(emojiPicker(st.emoji, e=>st.emoji=e));
    const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;margin-top:10px';
    if(m){
      const del=document.createElement('button'); del.className='btn danger small'; del.textContent='Eliminar';
      del.onclick=()=>{
        DB.metas=DB.metas.filter(x=>x.id!==m.id);
        DB.settings.celebradas=DB.settings.celebradas.filter(x=>x!==m.id);
        for(const t of DB.tx) if(t.metaId===m.id) delete t.metaId;
        save(); closeSheet(); render(); toast('Meta eliminada. Los abonos quedan como movimientos de ahorro.');
      };
      row.appendChild(del);
    }
    const sp=document.createElement('span'); sp.className='sp'; row.appendChild(sp);
    const ok=document.createElement('button'); ok.className='btn'; ok.textContent='Guardar';
    ok.onclick=()=>{
      const nombre=$('#mNombre',b).value.trim(); const obj=parseMoneyInput($('#mObj',b).value);
      if(!nombre||obj<=0){ toast('Ponle nombre y un monto objetivo.'); return; }
      const lim=$('#mLim',b).value||null;
      if(m) Object.assign(m,{nombre,emoji:st.emoji,objetivo:obj,fechaLimite:lim});
      else DB.metas.push({id:uid(),nombre,emoji:st.emoji,objetivo:obj,fechaLimite:lim,creado:Date.now()});
      save(); closeSheet(); render();
    };
    row.appendChild(ok); b.appendChild(row);
  });
}
function sheetAbono(m, retiro){
  openSheet(el=>{
    sheetHead(el, retiro? `Retirar de «${m.nombre}»` : `Abonar a «${m.nombre}»`);
    const b=document.createElement('div'); b.className='sh-body'; el.appendChild(b);
    const sug=metaAporteSugerido(m);
    b.innerHTML=`
      ${moneyInput('aMonto', retiro?'Monto a retirar':'Monto a abonar')}
      ${!retiro && sug ? `<button class="chip" id="aSug" style="margin:0 4px 8px">Sugerido: ${fmtMoney(sug)}/mes</button>`:''}
      <div class="notewrap"><label style="font-size:12px;font-weight:700;color:var(--muted)">Cuenta</label>
        <select id="aCta" aria-label="Cuenta" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:10px 13px;margin-top:4px">
          ${activeAccounts().map(a=>`<option value="${a.id}" ${a.id===DB.settings.lastAccount?'selected':''}>${a.emoji} ${esc(a.nombre)}</option>`).join('')}
        </select></div>
      <p class="card-sub" style="padding:2px 4px 8px">${retiro?'Se registrará como reembolso vinculado a la meta.':'Se registrará como movimiento en «Ahorro e inversión».'}</p>`;
    if(!retiro && sug){ $('#aSug',b).onclick=()=>{ $('#aMonto',b).value=(sug/100).toFixed(curDecimals()).replace('.',decSep()); }; }
    const ok=document.createElement('button'); ok.className='btn'; ok.style.width='100%'; ok.textContent= retiro?'Retirar':'Abonar';
    ok.onclick=()=>{
      const c=parseMoneyInput($('#aMonto',b).value); if(c<=0){ toast('Escribe un monto.'); return; }
      addTx({tipo:retiro?'i':'g', monto:c, cat:retiro?'i_reemb':'c_ahorro', cuenta:$('#aCta',b).value, nota:(retiro?'Retiro de meta: ':'Abono a meta: ')+m.nombre, metaId:m.id});
      closeSheet(); saveFx(); render();
      if(!retiro && metaProgreso(m)>=m.objetivo && !DB.settings.celebradas.includes(m.id)){
        DB.settings.celebradas.push(m.id); save(); confetti(); toast(`¡Meta «${m.nombre}» lograda! 🎉`);
      }
    };
    b.appendChild(ok);
  });
}
function sheetFijo(f){
  const st={ tipo:f?.tipo||'g' };
  openSheet(el=>{
    sheetHead(el, f?'Editar fijo':'Nuevo movimiento fijo');
    const b=document.createElement('div'); b.className='sh-body'; el.appendChild(b);
    const catOpts=t=>cats(t).map(c=>`<option value="${c.id}">${c.emoji} ${esc(c.nombre)}</option>`).join('');
    b.innerHTML=`
      <div class="seg" id="fTipo" style="margin:2px 2px 6px"><button data-t="g" class="g ${st.tipo==='g'?'on':''}">Gasto</button><button data-t="i" class="i ${st.tipo==='i'?'on':''}">Ingreso</button></div>
      ${moneyInput('fMonto','Monto', f?.monto)}
      <div class="notewrap"><label style="font-size:12px;font-weight:700;color:var(--muted)">Categoría</label>
        <select id="fCat" aria-label="Categoría" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:10px 13px;margin-top:4px">${catOpts(st.tipo)}</select></div>
      <div class="notewrap" style="display:flex;gap:8px">
        <span style="flex:1"><label style="font-size:12px;font-weight:700;color:var(--muted)">Día del mes</label>
        <select id="fDia" aria-label="Día del mes" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:10px 13px;margin-top:4px">
          ${[...Array(31)].map((_,i)=>`<option ${f?.dia===i+1?'selected':''}>${i+1}</option>`).join('')}
        </select></span>
        <span style="flex:1"><label style="font-size:12px;font-weight:700;color:var(--muted)">Cuenta</label>
        <select id="fCta" aria-label="Cuenta" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:10px 13px;margin-top:4px">
          ${activeAccounts().map(a=>`<option value="${a.id}" ${f?.cuenta===a.id?'selected':''}>${a.emoji} ${esc(a.nombre)}</option>`).join('')}
        </select></span>
      </div>
      <div class="notewrap"><input id="fNota" aria-label="Nombre del fijo" placeholder="Nombre (ej. Alquiler, Netflix, Nómina…)" maxlength="40" value="${esc(f?.nota||'')}"></div>
      <p class="card-sub" style="padding:0 4px 8px">Se registrará solo, cada mes, el día elegido (si el mes es más corto, el último día).</p>`;
    if(f) $('#fCat',b).value=f.cat;
    $$('#fTipo button',b).forEach(bt=>bt.onclick=()=>{ st.tipo=bt.dataset.t; $$('#fTipo button',b).forEach(x=>x.classList.toggle('on',x===bt)); $('#fCat',b).innerHTML=catOpts(st.tipo); });
    const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;margin-top:6px';
    if(f){
      const del=document.createElement('button'); del.className='btn danger small'; del.textContent='Eliminar';
      del.onclick=()=>{ DB.fijos=DB.fijos.filter(x=>x.id!==f.id); save(); closeSheet(); render(); };
      row.appendChild(del);
    }
    const sp=document.createElement('span'); sp.className='sp'; row.appendChild(sp);
    const ok=document.createElement('button'); ok.className='btn'; ok.textContent='Guardar';
    ok.onclick=()=>{
      const monto=parseMoneyInput($('#fMonto',b).value); if(monto<=0){ toast('Escribe el monto.'); return; }
      const dia=+$('#fDia',b).value;
      const data={tipo:st.tipo, monto, cat:$('#fCat',b).value, cuenta:$('#fCta',b).value, dia, nota:$('#fNota',b).value.trim()};
      if(f){ Object.assign(f,data); if(!f.nextDue || +f.nextDue.slice(8,10)!==dia) f.nextDue=nextDueFrom(dia, todayKey()); }
      else DB.fijos.push({id:uid(), ...data, activo:true, nextDue:nextDueFrom(dia, todayKey())});
      save(); closeSheet(); postFijos(); render();
    };
    row.appendChild(ok); b.appendChild(row);
  });
}
function sheetPresu(catObj, ym){
  openSheet(el=>{
    sheetHead(el, `Presupuesto · ${catObj.emoji} ${catObj.nombre}`);
    const b=document.createElement('div'); b.className='sh-body'; el.appendChild(b);
    const cur=effectiveBudget(ym).map[catObj.id]||0;
    const prom=[1,2,3].map(i=>gastoCat(addMonths(ym,-i),catObj.id));
    const avg=Math.round(prom.reduce((a,x)=>a+x,0)/Math.max(1,prom.filter(x=>x>0).length));
    b.innerHTML=`
      ${moneyInput('pMonto',`Límite mensual para ${monthLabel(ym)}`, cur)}
      ${avg>0?`<button class="chip" id="pSug" style="margin:0 4px 8px">Tu promedio: ${fmtMoney(avg)}/mes</button>`:''}
      <p class="card-sub" style="padding:0 4px 8px">El presupuesto se copia automáticamente a los meses siguientes hasta que lo cambies.</p>`;
    if(avg>0) $('#pSug',b).onclick=()=>{ $('#pMonto',b).value=(niceRound(avg)/100).toFixed(curDecimals()).replace('.',decSep()); };
    const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px';
    if(cur>0){
      const del=document.createElement('button'); del.className='btn danger small'; del.textContent='Quitar límite';
      del.onclick=()=>{ setBudget(ym,catObj.id,0); closeSheet(); render(); };
      row.appendChild(del);
    }
    const sp=document.createElement('span'); sp.className='sp'; row.appendChild(sp);
    const ok=document.createElement('button'); ok.className='btn'; ok.textContent='Guardar';
    ok.onclick=()=>{ setBudget(ym,catObj.id,parseMoneyInput($('#pMonto',b).value)); closeSheet(); render(); };
    row.appendChild(ok); b.appendChild(row);
  });
}
function sheetBorrarTodo(){
  openSheet(el=>{
    sheetHead(el,'Borrar todos los datos');
    const b=document.createElement('div'); b.className='sh-body'; el.appendChild(b);
    b.innerHTML=`<p style="padding:4px 4px 10px;color:var(--ink2)">Se borrarán <b>${DB.tx.length} movimientos</b>, cuentas, presupuestos, metas y fijos de este navegador. Esta acción no se puede deshacer.</p>
      <p class="card-sub" style="padding:0 4px 8px">Escribe <b>BORRAR</b> para confirmar. Te recomendamos exportar un respaldo antes.</p>
      <div class="notewrap"><input id="delConf" aria-label="Escribe BORRAR para confirmar" placeholder="BORRAR" autocomplete="off"></div>`;
    const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px';
    const exp=document.createElement('button'); exp.className='btn ghost small'; exp.textContent='Exportar respaldo';
    exp.onclick=exportJSON; row.appendChild(exp);
    const sp=document.createElement('span'); sp.className='sp'; row.appendChild(sp);
    const ok=document.createElement('button'); ok.className='btn danger'; ok.textContent='Borrar todo';
    ok.onclick=()=>{
      if($('#delConf',b).value.trim().toUpperCase()!=='BORRAR'){ toast('Escribe BORRAR para confirmar.'); return; }
      const cur=DB.settings.currency;
      DB=freshDB(); DB.settings.currency=cur; DB.settings.onboarded=true;
      try{ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }catch(e){}
      closeSheet(); render(); toast('Datos borrados.');
    };
    row.appendChild(ok); b.appendChild(row);
  });
}

/* confetti */
function confetti(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv=document.createElement('canvas');
  cv.style.cssText='position:fixed;inset:0;z-index:95;pointer-events:none';
  cv.width=innerWidth; cv.height=innerHeight; document.body.appendChild(cv);
  const ctx=cv.getContext('2d');
  const colors=['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#4a3aa7','#c2417f'];
  const P=[...Array(80)].map(()=>({x:innerWidth/2+(Math.random()-.5)*160, y:innerHeight*.35, vx:(Math.random()-.5)*9, vy:-4-Math.random()*7, r:3+Math.random()*4, c:colors[Math.floor(Math.random()*colors.length)], a:Math.random()*Math.PI}));
  let t0=performance.now();
  (function tick(now){
    const dt=(now-t0)/1000;
    ctx.clearRect(0,0,cv.width,cv.height);
    for(const p of P){
      p.x+=p.vx; p.y+=p.vy; p.vy+=.25; p.a+=.15;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a);
      ctx.fillStyle=p.c; ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r);
      ctx.restore();
    }
    if(dt<1.6) requestAnimationFrame(tick); else cv.remove();
  })(t0);
}
