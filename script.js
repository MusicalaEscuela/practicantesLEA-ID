(() => {
  const $  = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));

  const APP = { cfg:null, page:null, rows:[], headers:[], filterValue:null, weekFilter:null, _weeks:null };

  /* ===== Boot */
  window.addEventListener('hashchange', handleRoute);
  $('#btn-clear').addEventListener('click', () => { APP.filterValue = null; APP.weekFilter = null; updateUI(); });

  (async function init(){
    try{
      APP.cfg = await (await fetch('data.json', {cache:'no-store'})).json();
      if (APP.cfg?.brand?.logo)     $('#app-logo').src = APP.cfg.brand.logo;
      if (APP.cfg?.brand?.subtitle) $('#app-sub').textContent = APP.cfg.brand.subtitle;
      buildTabs(APP.cfg.pages);
      handleRoute();
    }catch(e){ console.error(e); alert('No pude cargar data.json'); }
  })();

  /* ===== Tabs / Router */
  function buildTabs(pages){
    const nav = $('#navtabs'); nav.innerHTML = '';
    pages.forEach(p=>{
      const b = document.createElement('button');
      b.className='tab'; b.textContent=p.title||p.id;
      b.addEventListener('click', ()=> location.hash=p.id);
      nav.appendChild(b);
    });
  }
  async function handleRoute(){
    const id = location.hash.replace('#','') || APP.cfg.pages[0].id;
    const page = APP.cfg.pages.find(p=>p.id===id) || APP.cfg.pages[0];
    $$('#navtabs .tab').forEach((t,i)=> t.classList.toggle('active', APP.cfg.pages[i].id===page.id));
    await loadPage(page);
  }

  /* ===== Load page */
  async function loadPage(page){
    APP.page = page; APP.filterValue=null; APP.weekFilter=null; APP._weeks=null;
    $('#app-title').textContent = page.title || 'Actividades';
    $('#table-title').textContent =
      page.mode==='hoursMatrix' ? 'Semana' :
      page.mode==='schedules'   ? 'Horarios' : 'Lista';
    $('#extra-filters').innerHTML = ''; $('#role-kpi').innerHTML='';
    $('#week-compact').innerHTML='';

    const txt = await (await fetch(page.tsvUrl, {cache:'no-store'})).text();
    const lines = txt.trim().split(/\r?\n/).map(l=>l.split('\t'));
    if(!lines.length) throw new Error('TSV vacío');
    APP.headers = lines[0]; APP.rows = lines.slice(1);

    // Resumen global
    actualizarResumenInicial(lines);

    // Filtros (practicantes)
    buildChips(lines);

    // Encabezados de tabla + filtro de semanas compacto (solo en hoursMatrix)
    if (page.mode==='hoursMatrix'){
      buildWeekSelect(lines);
      buildHeader_weekMatrix();
    } else if (page.mode==='schedules'){
      buildHeader_schedules();
      // día select se agrega en buildChips -> extra-filters
    } else {
      buildHeader_default();
    }

    updateUI();
  }

  /* ===== Resumen superior */
  function actualizarResumenInicial(lines){
    const mode = APP.page.mode||'list';
    let totalActividades = 0, totalHoras = 0, practicantes = [];

    if (mode==='hoursMatrix'){
      const {nameCol,weekRow,startCol,startRow} = APP.page.matrix;
      practicantes = Array.from(new Set(lines.slice(startRow).map(r => (r[nameCol]||'').trim()).filter(Boolean)));
      for(let r=startRow; r<lines.length; r++){
        for(let c=startCol; c<lines[weekRow].length; c++){
          totalHoras += toNumber(lines[r][c]);
          if (toNumber(lines[r][c])>0) totalActividades++;
        }
      }
    } else if (mode==='schedules'){
      const S = APP.page.schedules;
      practicantes = Array.from(new Set(APP.rows.map(r => (r[S.nameCol]||'').trim()).filter(Boolean)));
      totalActividades = APP.rows.length;
      totalHoras = 0;
    } else {
      const nameIdx = APP.page.columns.filterCol;
      const hCol    = APP.page.columns.hoursCol;
      practicantes = Array.from(new Set(APP.rows.map(r => (r[nameIdx]||'').trim()).filter(Boolean)));
      totalActividades = APP.rows.length;
      totalHoras = APP.rows.reduce((a,r)=> a + toNumber(r[hCol]), 0);
    }

    $('#k-total-practicantes').textContent = practicantes.length;
    $('#k-actividades').textContent = totalActividades;
    $('#k-horas').textContent = totalHoras.toFixed(2).replace('.',',');
    $('#k-promedio').textContent = practicantes.length ? (totalHoras/practicantes.length).toFixed(2).replace('.',',') : '0';
  }

  /* ===== Headers */
  function buildHeader_default(){
    const tr = $('#thead-row'); tr.innerHTML='';
    resolveVisibleCols().forEach(i=>{
      const th = document.createElement('th'); th.textContent=APP.headers[i]??''; tr.appendChild(th);
    });
  }
  function buildHeader_weekMatrix(){
    const tr = $('#thead-row'); tr.innerHTML='';
    ['Practicante','Horas','Estado'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; tr.appendChild(th); });
    $('#tabla').classList.add('week-table');
  }
  function buildHeader_schedules(){
    const tr = $('#thead-row'); tr.innerHTML='';
    ['Practicante','Día / Hora'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; tr.appendChild(th); });
  }
  function resolveVisibleCols(){
    const t = APP.page.table?.visibleCols;
    if (t==='all' || !Array.isArray(t)) return APP.headers.map((_,i)=>i);
    return t;
  }

  /* ===== Chips practicantes + extra filters */
  function buildChips(lines){
    const box = $('#chips-practicantes'); box.innerHTML='';
    const nameIdx = APP.page.columns?.filterCol ?? APP.page.schedules?.nameCol ?? APP.page.matrix?.nameCol ?? 0;

    let names = [];
    if (APP.page.mode==='hoursMatrix'){
      const startRow = APP.page.matrix.startRow ?? 2;
      names = Array.from(new Set(lines.slice(startRow).map(r => (r[nameIdx]||'').trim()).filter(Boolean)));
    } else {
      names = Array.from(new Set(APP.rows.map(r => (r[nameIdx]||'').trim()).filter(Boolean)));
    }
    names.sort((a,b)=>a.localeCompare(b,'es'));

    const chipAll = document.createElement('div');
    chipAll.className = 'chip' + (APP.filterValue ? '' : ' active');
    chipAll.textContent = 'Todos';
    chipAll.addEventListener('click', ()=>{ APP.filterValue=null; updateUI(); });
    box.appendChild(chipAll);

    names.forEach(n=>{
      const chip=document.createElement('div');
      chip.className='chip'+(APP.filterValue===n?' active':'');
      chip.textContent=n;
      chip.addEventListener('click', ()=>{ APP.filterValue=n; updateUI(); });
      box.appendChild(chip);
    });

    // Filtro de día (schedules)
    if (APP.page.mode==='schedules'){
      const days = collectDaysFromSchedules();
      const sel = document.createElement('select');
      sel.innerHTML = `<option value="">Todos los días</option>` + days.map(d=>`<option>${d}</option>`).join('');
      sel.addEventListener('change', ()=>{ sel.value ? APP.weekFilter = sel.value : APP.weekFilter=null; updateUI(); });
      $('#extra-filters').appendChild(sel);
    }
  }

  /* ===== Semana (select compacto) */
  function buildWeekSelect(lines){
    const { weekRow, dateRow, startCol } = APP.page.matrix;
    const weeks = [];
    for (let c=startCol; c<lines[weekRow].length; c++){
      const w = (lines[weekRow][c]||'').trim();
      const d = (lines[dateRow][c]||'').trim();
      if (!w && !d) continue;
      const key = w || d || `W${c}`;
      const label = d ? `${w || key} · ${d}` : String(w || key);
      weeks.push({key, col:c, label});
    }
    APP._weeks = weeks;

    const box = $('#week-compact');
    box.innerHTML = '';
    const label = document.createElement('label');
    label.setAttribute('for','sel-week');
    label.textContent = 'Semana';
    const sel = document.createElement('select');
    sel.id = 'sel-week';

    const optAll = document.createElement('option');
    optAll.value = ''; optAll.textContent = 'Todas';
    sel.appendChild(optAll);

    weeks.forEach(w=>{
      const o=document.createElement('option');
      o.value=w.key; o.textContent=w.label;
      sel.appendChild(o);
    });

    sel.addEventListener('change', ()=>{ APP.weekFilter = sel.value || null; updateUI(); });
    box.appendChild(label); box.appendChild(sel);
  }

  /* ===== Renders por modo */
  function render_list(rows){
    const tbody = $('#tbody'); tbody.innerHTML='';
    const visible = resolveVisibleCols();
    const hCol = APP.page.columns.hoursCol, gCol = APP.page.columns.groupCol;
    const maxHour = Math.max(1, ...rows.map(r=>toNumber(r[hCol])));

    rows.forEach(r=>{
      const tr = document.createElement('tr');
      visible.forEach(i=>{
        const td = document.createElement('td');
        if (i===gCol){
          const s=document.createElement('span'); s.className=areaBadgeClass(String(r[i]||'')); s.textContent=r[i]??''; td.appendChild(s);
        } else if (i===hCol){
          const val = toNumber(r[i]); const pct=Math.min(100,(val/maxHour)*100);
          const wrap=document.createElement('div'); wrap.className='barcell';
          const bar=document.createElement('div'); bar.className='bar'; bar.style.setProperty('--pct', pct.toFixed(2)+'%');
          bar.appendChild(document.createElement('i'));
          const lbl=document.createElement('div'); lbl.className='barlabel'; lbl.textContent=val.toFixed(2).replace('.',',');
          wrap.appendChild(bar); wrap.appendChild(lbl); td.appendChild(wrap);
        } else { td.textContent=r[i]??''; }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function render_hoursMatrix(lines){
    const { nameCol, weekRow, startCol, startRow } = APP.page.matrix;
    const tbody = $('#tbody'); tbody.innerHTML='';

    let selectedCol = null;
    if (APP.weekFilter && APP._weeks){
      const found = APP._weeks.find(w=>w.key===APP.weekFilter);
      selectedCol = found ? found.col : null;
    }

    const goal = Number(APP.page.goal || 4);
    const table = [];
    for (let r=startRow; r<lines.length; r++){
      const name = (lines[r][nameCol]||'').trim();
      if (!name) continue;
      if (APP.filterValue && name !== APP.filterValue) continue;

      let hours = 0;
      if (selectedCol!=null){ hours = toNumber(lines[r][selectedCol]); }
      else { for (let c=startCol; c<lines[weekRow].length; c++) hours += toNumber(lines[r][c]); }
      table.push({name, hours});
    }

    table.forEach(({name,hours})=>{
      const tr=document.createElement('tr');
      const tdN=document.createElement('td'); tdN.textContent=name;
      const tdH=document.createElement('td'); tdH.textContent=hours.toFixed(2).replace('.',',');
      const tdS=document.createElement('td'); const ok=hours>=goal; tdS.textContent= ok?'Meta cumplida':'Bajo meta'; tdS.className= ok?'state-ok':'state-warn';
      tr.appendChild(tdN); tr.appendChild(tdH); tr.appendChild(tdS); tbody.appendChild(tr);
    });

    $('#summary').innerHTML = `
      <div class="legend">
        <span class="pill goal">Meta semanal: ${goal} h</span>
        <span class="pill ok">Meta cumplida</span>
        <span class="pill warn">Bajo meta</span>
      </div>
    `;
  }

  function render_schedules(rows){
    const tbody = $('#tbody'); const thead = $('#thead-row');
    thead.innerHTML=''; tbody.innerHTML='';
    const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 2;
    const grid = document.createElement('div'); grid.className='info-grid'; td.appendChild(grid); tr.appendChild(td); tbody.appendChild(tr);

    const S = APP.page.schedules;
    const dayFilter = APP.weekFilter ? String(APP.weekFilter).toLowerCase() : '';

    rows.forEach(r=>{
      const name = (r[S.nameCol] || '').trim();
      if (!name) return;
      if (APP.filterValue && name!==APP.filterValue) return;

      const s1d = r[S.slot1Day]  || ''; const s1h = r[S.slot1Hour] || '';
      const s2d = r[S.slot2Day]  || ''; const s2h = r[S.slot2Hour] || '';
      const slots = []; if (s1d || s1h) slots.push({d:s1d,h:s1h}); if (s2d || s2h) slots.push({d:s2d,h:s2h});

      if (dayFilter && !slots.some(s => String(s.d).toLowerCase().includes(dayFilter))) return;

      const card = document.createElement('div'); card.className = 'info-card';
      card.innerHTML = `<h4 class="info-title">${name}</h4>`;
      if (slots.length===0){
        card.insertAdjacentHTML('beforeend', `<div class="info-line"><span class="info-badge">Horario</span> — </div>`);
      } else {
        slots.slice(0,2).forEach((s,i)=>{
          card.insertAdjacentHTML('beforeend', `<div class="info-line"><span class="info-badge">Día ${slots.length>1?i+1:''}</span> ${s.d || '—'} &nbsp; <span class="info-badge">Hora</span> ${s.h || '—'}</div>`);
        });
      }
      grid.appendChild(card);
    });
  }

  /* ===== KPIs + chart */
  function computeKPIs_default(rows){
    const hCol = APP.page.columns?.hoursCol;
    const total = Number.isInteger(hCol) ? rows.reduce((a,r)=> a + toNumber(r[hCol]), 0) : 0;
    const names = [...new Set(rows.map(r => (r[APP.page.columns.filterCol]||'').trim()).filter(Boolean))];
    $('#k-total-practicantes').textContent = names.length || $('#k-total-practicantes').textContent;
    $('#k-actividades').textContent = rows.length;
    $('#k-horas').textContent = Number.isFinite(total)? total.toFixed(2).replace('.',',') : '—';
    $('#k-promedio').textContent = names.length ? (total/names.length).toFixed(2).replace('.',',') : $('#k-promedio').textContent;
  }

  function computeKPIs_hoursMatrix(lines){
    const { nameCol, weekRow, startCol, startRow } = APP.page.matrix;
    const col = APP._weeks && APP.weekFilter ? (APP._weeks.find(w=>w.key===APP.weekFilter)?.col) : null;

    let total=0, count=0;
    for (let r=startRow; r<lines.length; r++){
      const name=(lines[r][nameCol]||'').trim(); if(!name) continue;
      if (APP.filterValue && name!==APP.filterValue) continue;
      if (col!=null){ total += toNumber(lines[r][col]); count++; }
      else { for(let c=startCol; c<lines[weekRow].length; c++){ total += toNumber(lines[r][c]); count++; } }
    }
    const practCount = new Set(lines.slice(startRow).map(r => (r[nameCol]||'').trim()).filter(Boolean)).size;
    $('#k-actividades').textContent = count;
    $('#k-horas').textContent = total.toFixed(2).replace('.',',');
    $('#k-promedio').textContent = practCount ? (total/practCount).toFixed(2).replace('.',',') : '0';
  }

  function drawChart(source){
    const mode = APP.page.mode||'list';
    const canvas=$('#chart-horas'); const ctx=canvas.getContext('2d');
    const rect=canvas.getBoundingClientRect(); canvas.width=Math.max(640,rect.width*devicePixelRatio); canvas.height=Math.max(240,rect.height*devicePixelRatio);
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    ctx.clearRect(0,0,rect.width,rect.height);
    if (mode==='schedules'){ $('#chart-sub').textContent='Vista informativa de horarios por practicante.'; return; }

    if (mode==='hoursMatrix'){
      const lines = source;
      const { nameCol, startRow } = APP.page.matrix;
      const selected = APP._weeks && APP.weekFilter ? (APP._weeks.find(w=>w.key===APP.weekFilter)?.col) : null;
      if (selected==null){ $('#chart-sub').textContent='Selecciona una semana para ver la distribución por practicante.'; return; }
      const data=[];
      for(let r=startRow; r<lines.length; r++){
        const name=(lines[r][nameCol]||'').trim(); if(!name) continue;
        if (APP.filterValue && name!==APP.filterValue) continue;
        const val=toNumber(lines[r][selected]); if(val>0) data.push({name,value:val});
      }
      donut(ctx, rect.width, rect.height, data.map(d=>d.value), data.map(d=>d.name));
      $('#chart-sub').textContent='Horas por practicante en la semana seleccionada.';
      return;
    }

    // list -> barras por practicante
    const nameIdx = APP.page.columns.filterCol;
    const hCol    = APP.page.columns.hoursCol;
    const rows = source;
    const map=new Map();
    rows.forEach(r=>{
      const n=(r[nameIdx]||'').trim() || '—';
      map.set(n, (map.get(n)||0) + (Number.isInteger(hCol)? toNumber(r[hCol]) : 1));
    });
    const labels=[...map.keys()]; const values=labels.map(k=>map.get(k)||0);
    bars(ctx, rect.width, rect.height, labels, values);
    $('#chart-sub').textContent='Suma de horas por practicante.';
  }

  function bars(ctx,W,H,labels,values){
    const pad=18, baseY=H-pad*1.8, maxV=Math.max(1,...values);
    const barW=Math.max(18,(W-pad*2)/(labels.length*1.8));
    const grd=ctx.createLinearGradient(0,0,W,0); grd.addColorStop(0,'rgba(79,70,229,.06)'); grd.addColorStop(1,'rgba(124,58,237,.06)');
    ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(31,41,55,.25)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pad,baseY+0.5); ctx.lineTo(W-pad,baseY+0.5); ctx.stroke();
    const cols=['#4f46e5','#7c3aed','#2563eb','#9333ea','#3b82f6','#a78bfa'];
    labels.forEach((lab,i)=>{
      const x=pad+i*(barW*1.6)+6; const h=Math.max(4,(values[i]/maxV)*(H-pad*3)); const y=baseY-h;
      const g=ctx.createLinearGradient(x,y,x,baseY); g.addColorStop(0,cols[i%cols.length]); g.addColorStop(1,'rgba(124,58,237,.55)');
      ctx.fillStyle=g; roundRect(ctx,x,y,barW,h,8); ctx.fill();
      ctx.fillStyle='#0f172a'; ctx.font='600 12px Inter, system-ui, sans-serif'; ctx.textAlign='center';
      ctx.fillText(values[i].toFixed(1).replace('.',','), x+barW/2, y-6);
      ctx.fillStyle='#475569'; ctx.font='500 11px Inter, system-ui, sans-serif'; wrapText(ctx,lab,x+barW/2,baseY+14,barW*1.6);
    });
  }
  function donut(ctx,W,H,values,labels){
    const cx=W/2, cy=H/2, r=Math.min(W,H)/2-24, inner=r*0.55;
    const total=values.reduce((a,b)=>a+b,0)||1;
    let start=-Math.PI/2;
    const cols=['#4f46e5','#7c3aed','#2563eb','#9333ea','#3b82f6','#a78bfa','#60a5fa','#a78bfa'];
    values.forEach((v,i)=>{
      const ang=(v/total)*Math.PI*2; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+ang); ctx.closePath();
      const g=ctx.createLinearGradient(cx,cy,cx+r,cy); g.addColorStop(0,cols[i%cols.length]); g.addColorStop(1,'rgba(124,58,237,.55)');
      ctx.fillStyle=g; ctx.fill(); start+=ang;
    });
    // agujero
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath(); ctx.arc(cx,cy,inner,0,Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation='source-over';
    // etiquetas
    ctx.fillStyle='#0f172a'; ctx.font='600 13px Inter, system-ui, sans-serif'; ctx.textAlign='center';
    ctx.fillText('Horas por practicante', cx, cy-4);
    ctx.font='700 14px Inter, system-ui, sans-serif';
    ctx.fillText(values.reduce((a,b)=>a+b,0).toFixed(1).replace('.',',')+' h', cx, cy+14);
  }

  /* ===== Update */
  function updateUI(){
    const mode = APP.page.mode || 'list';
    const lines = [APP.headers, ...APP.rows];

    let filtered = APP.rows;
    const nameIdx = APP.page.columns?.filterCol ?? APP.page.schedules?.nameCol ?? 0;
    if (mode!=='hoursMatrix' && APP.filterValue){
      filtered = filtered.filter(r => (r[nameIdx]||'').trim() === APP.filterValue);
    }

    $('#summary').textContent=''; $('#tabla').classList.remove('week-table');

    if (mode==='hoursMatrix'){
      buildHeader_weekMatrix();
      render_hoursMatrix(lines);
      computeKPIs_hoursMatrix(lines);
      drawChart(lines);
    } else if (mode==='schedules'){
      render_schedules(APP.rows);
      drawChart([]); // limpia/omitido
    } else {
      buildHeader_default();
      render_list(filtered);
      computeKPIs_default(filtered);
      drawChart(filtered);
      if (APP.page.columns?.roleCol != null) renderRoleKPI(filtered);
    }

    // activar chips (practicantes)
    $$('#chips-practicantes .chip').forEach(ch=>{
      const isAll = ch.textContent.trim().toLowerCase() === 'todos';
      const on = (!APP.filterValue && isAll) || (APP.filterValue && ch.textContent.trim() === APP.filterValue);
      ch.classList.toggle('active', !!on);
    });
  }

  /* ===== Helpers */
  function renderRoleKPI(rows){
    const roleIdx = APP.page.columns.roleCol;
    const hIdx = APP.page.columns.hoursCol;
    const map = new Map();
    rows.forEach(r=>{
      const role=(r[roleIdx]||'—').trim();
      const h=toNumber(r[hIdx]);
      map.set(role, (map.get(role)||0)+h);
    });
    const table = `
      <div class="title" style="margin-top:12px"><span class="dot dot-brand"></span><h3 style="margin:0;font-size:16px">Horas por Rol</h3></div>
      <div class="tablewrap" style="max-height:240px">
        <table>
          <thead><tr><th>Rol</th><th>Horas</th></tr></thead>
          <tbody>${[...map.entries()].map(([k,v])=>`<tr><td>${k}</td><td><strong>${v.toFixed(2).replace('.',',')}</strong></td></tr>`).join('')}</tbody>
        </table>
      </div>`;
    $('#role-kpi').innerHTML = table;
  }

  function collectDaysFromSchedules(){
    const S = APP.page.schedules;
    const set = new Set();
    APP.rows.forEach(r=>{
      [S.slot1Day,S.slot2Day].forEach(idx=>{
        const v = (r[idx]||'').trim(); if (v) set.add(v);
      });
    });
    return Array.from(set).sort((a,b)=>a.localeCompare(b,'es'));
  }

  function toNumber(v){ const n=parseFloat(String(v??'').replace(',','.').trim()); return Number.isFinite(n)?n:0; }
  function areaBadgeClass(s){ if(!s) return 'badge'; s=String(s).toLowerCase(); if (s.includes('reun')||s.includes('capaci')) return 'badge a-uno'; if (s.includes('musica')||s.includes('música')) return 'badge a-dos'; return 'badge a-tres'; }
  function roundRect(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
  function wrapText(c,text,x,y,maxW){ const words=String(text).split(/\s+/); let line=''; const lines=[]; for(const w of words){ const t=line?line+' '+w:w; if(c.measureText(t).width>maxW && line){lines.push(line); line=w;} else line=t; } if(line) lines.push(line); lines.slice(0,2).forEach((ln,j)=> c.fillText(ln,x,y+j*12)); }
})();
