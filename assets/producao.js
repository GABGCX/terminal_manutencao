"use strict";
/* =====================================================================
   PRODUÇÃO: ordens, posto de trabalho, rastreio, NC, tempos e painel.
   Usa os utilitários e o estado de app.js (S, UI, ME, sb, write, esc...).
   ===================================================================== */
const POSTOS_P = [["P1","Inspeção visual e continuidade"],["P2","Teste de alimentação"],["P3","Gravação do CCPS"],["P4","Teste do CCPS na JIGA"],
  ["P5","Gravação de firmware"],["P6","Teste de saídas"],["P7","Teste de leituras"],["P8","Integração do equipamento"]];
const PNOME = Object.fromEntries(POSTOS_P);
const MODOS_F = [
  ["P1","Ponte de solda no microcontrolador ou nos relés"],["P1","Relé faltando ou montado onde não deve"],["P1","Módulo Buck montado"],
  ["P1","Driver de ponte H faltando"],["P1","Curto na alimentação"],["P2","5V fora da faixa"],["P2","LED Energia não acende"],
  ["P3","Microcontrolador invertido"],["P3","Falha na gravação do CCPS"],["P4","Reprovada na JIGA"],["P4","CCPS não carrega a bateria"],
  ["P5","Sem beep após regravação"],["P5","Falha na gravação do firmware"],["P6","LED de saída invertido ou apagado"],["P6","Saída fora de 25 a 27 VAC"],
  ["P6","Falha no teste das bombas"],["P6","Duas saídas acionadas juntas"],["P6","Válvula de nutrição não abre ou não é lida"],
  ["P6","Leitura de bateria incorreta"],["P7","Falha de comunicação SDI-12"],["P7","Hidrômetro não conta"],["P7","Não inicializa pela fonte ou painel solar"],
  ["P7","DIP switch com valor errado"],["P7","Sem comunicação na rede mesh"],["P7","Falha na comunicação Modbus RS485"],["P7","Sensor fora da aferição"],
  ["P8","Item do kit faltando ou errado"],["P8","Falha no teste integrado do equipamento"],
];
const VIEWS_PROD = [["p-painel","PAINEL"],["p-ordens","ORDENS"],["p-posto","POSTO"],["p-rastreio","RASTREIO"],["p-nc","NÃO CONFORMIDADES"],["p-tempos","TEMPOS"]];
const PROD_TABLES = ["prod_roteiros","prod_ordens","prod_unidades","prod_eventos","prod_nc"];
const canProd = () => !!ME && (ME.papel==="admin" || ME.papel==="operador");
S.p = {roteiros:[], ordens:{}, unidades:[], eventos:[], nc:[], d:{rot:{}, rota:{}, U:{}}};
UI.p = {opFilt:"Abertas", ncFilt:"Abertas", op:null, unit:null, ps:null, rsq:""};
let psTick = null;
const mmss = s => { s = Math.max(0, Math.round(+s||0)); return `${Math.floor(s/60)}:${pad(s%60)}`; };
const dIso = t => t ? isoOf(new Date(t)) : "";
const nomeDe = uid => { const p = PROFILES[uid]; return p && p.nome ? p.nome.split(" ")[0] : ""; };
const prioN = p => Math.max(0, PRIO.indexOf(p||"Normal"));
const mediana = a => { if (!a.length) return 0; const b=[...a].sort((x,y)=>x-y); const m=Math.floor(b.length/2); return b.length%2?b[m]:(b[m-1]+b[m])/2; };
function localGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function localSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }

/* ---------------- carga ---------------- */
function prodLoad(t, rows){
  if (t==="prod_roteiros") S.p.roteiros = rows.map(r=>({...clean(r), seq:+r.seq, tempo_min:+r.tempo_min||0}));
  else if (t==="prod_ordens"){ const o={}; rows.forEach(r=>o[r.id]=clean(r)); S.p.ordens=o; }
  else if (t==="prod_unidades") S.p.unidades = rows.map(clean);
  else if (t==="prod_eventos") S.p.eventos = rows.map(r=>({...clean(r), duracao_s:r.duracao_s==null?null:+r.duracao_s, tfim:Date.parse(r.fim||r.criado_em)||0}));
  else if (t==="prod_nc") S.p.nc = rows.map(clean);
}

/* ---------------- derivação ---------------- */
function deriveProd(){
  const rot = {}; for (const r of S.p.roteiros) (rot[r.produto] ||= []).push(r);
  const rota = {};
  for (const k in rot){ rot[k].sort((a,b)=>a.seq-b.seq); rota[k] = [...new Set(rot[k].map(r=>r.posto))].sort((a,b)=>+a.slice(1)-+b.slice(1)); }
  const evBy = {}; for (const e of S.p.eventos) (evBy[e.unidade_id] ||= []).push(e);
  const ncBy = {}; for (const n of S.p.nc) (ncBy[n.unidade_id] ||= []).push(n);
  const U = {};
  for (const u of S.p.unidades){
    const ev = (evBy[u.id]||[]).sort((a,b)=>a.tfim-b.tfim);
    const last = {}; ev.forEach(e=>last[e.posto]=e);
    const r = rota[u.produto] || [];
    const etapa = r.find(p => !last[p] || last[p].resultado!=="A") || null;
    const ncs = (ncBy[u.id]||[]).sort((a,b)=>(a.criado_em||"").localeCompare(b.criado_em||""));
    const ncAb = ncs.find(n=>n.status==="Aberta") || null;
    const op = S.p.ordens[u.ordem_id] || null;
    let estado, man = null;
    if (ncs.some(n=>n.status==="Sucata")) estado = "Sucata";
    else if (ncAb){
      man = S.derived[ncAb.placa_id] || null;
      if (man && man.fase==="Encerrada") estado = ["Reparada","Sem defeito constatado"].includes(man.resultado) ? "Pronta para voltar" : "Decidir retorno";
      else estado = "Em manutenção";
    }
    else if (!r.length) estado = "Sem roteiro";
    else if (!etapa) estado = "Concluída";
    else if (!ev.length) estado = "Aguardando início";
    else estado = "Em processo";
    const aprov = ev.filter(e=>e.resultado==="A");
    const conclEm = estado==="Concluída" && aprov.length ? dIso(Math.max(...aprov.map(e=>e.tfim))) : "";
    U[u.id] = {...u, ev, last, rota:r, etapa: (estado==="Concluída"||estado==="Sucata"||estado==="Sem roteiro") ? null : etapa, estado, nc:ncAb, ncs, man, op, conclEm};
  }
  S.p.d = {rot, rota, U};
}
const ativo = u => u.op && u.op.status!=="Cancelada";
const naFila = u => ["Aguardando início","Em processo"].includes(u.estado);
const naManut = u => ["Em manutenção","Pronta para voltar","Decidir retorno"].includes(u.estado);
function opResumo(o){
  const us = Object.values(S.p.d.U).filter(u=>u.ordem_id===o.id);
  const c = k => us.filter(u=>u.estado===k).length;
  const concl = c("Concluída"), suc = c("Sucata"), man = us.filter(naManut).length, proc = us.filter(naFila).length;
  return {us, total:us.length, concl, suc, man, proc, pct: o.quantidade ? concl/o.quantidade : 0};
}
const estadoTag = e => {
  const cls = {"Concluída":"f-Encerrada","Sucata":"alert","Em manutenção":"f-Espera","Pronta para voltar":"f-Teste","Decidir retorno":"alert","Aguardando início":"f-Fila","Em processo":"f-Reparo","Sem roteiro":"muted"}[e] || "";
  return `<span class="st ${cls}">${esc((e||"").toUpperCase())}</span>`;
};
const opTag = s => `<span class="st ${({"Aberta":"f-Fila","Em produção":"f-Reparo","Concluída":"f-Encerrada","Cancelada":"muted"})[s]||""}">${esc((s||"").toUpperCase())}</span>`;

/* ---------------- render ---------------- */
function prodRender(v){
  if (!S.ready.prod_roteiros || !S.ready.prod_unidades || !S.ready.prod_eventos){ const el = document.querySelector(`#v-${v} .box div[id]`); if (el) el.innerHTML = `<div class="empty">carregando produção...</div>`; return; }
  if (v==="p-painel") rpPainel();
  else if (v==="p-ordens") rpOrdens();
  else if (v==="p-op") rpOp();
  else if (v==="p-posto") rpPosto();
  else if (v==="p-rastreio") rpRastreio();
  else if (v==="p-nc") rpNc();
  else if (v==="p-tempos") rpTempos();
}

function rpPainel(){
  const D = S.p.d, Us = Object.values(D.U).filter(ativo), T = today(), d7 = addDays(T,-6), d30 = addDays(T,-29);
  const concl = Us.filter(u=>u.estado==="Concluída");
  const hoje = concl.filter(u=>u.conclEm===T).length, meta = +S.config.meta_dia||0;
  const ops = Object.values(S.p.ordens).filter(o=>o.status==="Aberta"||o.status==="Em produção");
  const ev30 = S.p.eventos.filter(e=>dIso(e.tfim)>=d30);
  const unid30 = [...new Set(ev30.map(e=>e.unidade_id))];
  const fp30 = unid30.filter(id=>!ev30.some(e=>e.unidade_id===id && e.resultado==="R")).length;
  const suc30 = S.p.nc.filter(n=>n.status==="Sucata" && (n.fechado_em||"").slice(0,10)>=d30).length;
  const k = [
    ["OPs abertas", ops.length], ["Em processo", Us.filter(naFila).length], ["Na manutenção", Us.filter(naManut).length, "hot"],
    ["Concluídas hoje", meta ? `${hoje}/${meta}` : hoje], ["Concluídas 7 dias", concl.filter(u=>u.conclEm>=d7).length],
    ["FPY 30 dias", unid30.length ? pct(fp30/unid30.length) : "-"], ["Sucata 30 dias", suc30, "hot"],
  ];
  $("pp-kpis").innerHTML = k.map(([l,v,c])=>`<div class="kpi${c&&+v>0?" "+c:""}"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join("");
  const wip = POSTOS_P.map(([p,n])=>[p,n,Us.filter(u=>u.etapa===p && naFila(u)).length]); const mw = Math.max(1,...wip.map(w=>w[2]));
  const gargalo = wip.reduce((a,b)=>b[2]>a[2]?b:a, wip[0]);
  $("pp-wip").innerHTML = `<div class="tw"><table><tbody>${wip.map(([p,n,c])=>`<tr><td class="id">${p}</td><td>${esc(n)}</td><td>${bar(c,mw,14)}</td><td class="n"><b>${c}</b></td></tr>`).join("")}</tbody></table></div>`
    + (gargalo[2] ? `<p class="hint">Maior fila agora: <b>${gargalo[0]} · ${esc(gargalo[1])}</b>.</p>` : "");
  $("pp-ops").innerHTML = ops.length ? `<div class="tw"><table><thead><tr><th>OP</th><th>Produto</th><th>Progresso</th><th class="n">Feitas</th><th>Previsto</th></tr></thead><tbody>${
    ops.sort((a,b)=>prioN(a.prio)-prioN(b.prio)||(a.previsto||"9").localeCompare(b.previsto||"9")).map(o=>{ const r = opResumo(o); const atr = o.previsto && o.previsto<T && r.concl<o.quantidade;
      return `<tr class="click" data-pop="${esc(o.id)}"><td class="id">${esc(o.id)}</td><td>${esc(o.produto)}</td><td>${bar(r.concl,o.quantidade,12)}</td><td class="n">${r.concl}/${o.quantidade}${r.man?` <span class="tag">${r.man} man.</span>`:""}</td><td class="${atr?"alert":""}">${brs(o.previsto)}${atr?" !!":""}</td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty">Nenhuma ordem aberta. Crie uma em [2] ORDENS.</div>`;
  const dias = Array.from({length:14},(_,i)=>addDays(T,i-13)); const cd = dias.map(d=>concl.filter(u=>u.conclEm===d).length); const md = Math.max(1, meta, ...cd);
  $("pp-dia").innerHTML = `<div class="tw"><table><tbody>${dias.map((d,i)=>`<tr><td class="nw">${brs(d)}</td><td>${bar(cd[i],md,16)}</td><td class="n">${cd[i]}${meta?`<span class="muted">/${meta}</span>`:""}</td></tr>`).join("")}</tbody></table></div>`;
  const fal = {}; ev30.filter(e=>e.resultado==="R").forEach(e=>{ const k=`${e.posto} · ${e.modo_falha||"sem modo"}`; fal[k]=(fal[k]||0)+1; });
  const fl = Object.entries(fal).sort((a,b)=>b[1]-a[1]); const mf = Math.max(1,...fl.map(f=>f[1]));
  $("pp-falhas").innerHTML = fl.length ? `<div class="tw"><table><tbody>${fl.slice(0,12).map(([k,n])=>`<tr><td>${esc(k)}</td><td>${bar(n,mf,10)}</td><td class="n">${n}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Nenhuma reprovação nos últimos 30 dias.</div>`;
  $("pp-fpy").innerHTML = `<div class="tw"><table><thead><tr><th>Posto</th><th class="n">Unidades</th><th class="n">Passaram de primeira</th><th>FPY</th><th class="n">Tempo mediano</th></tr></thead><tbody>${POSTOS_P.map(([p,n])=>{
      const evp = ev30.filter(e=>e.posto===p); const por = {}; evp.forEach(e=>{ (por[e.unidade_id] ||= []).push(e); });
      const tot = Object.keys(por).length; const ok = Object.values(por).filter(a=>a.sort((x,y)=>x.tfim-y.tfim)[0].resultado==="A").length;
      const dur = evp.map(e=>e.duracao_s).filter(x=>x>0); const f = tot? ok/tot : null;
      return `<tr><td class="id">${p} <span class="muted">${esc(n)}</span></td><td class="n">${tot}</td><td class="n">${ok}</td><td>${f==null?"-":bar(f,1,10)+" "+pct(f)}</td><td class="n">${dur.length?mmss(mediana(dur)):"-"}</td></tr>`; }).join("")}</tbody></table></div>`;
}

function produtosComRoteiro(){ return Object.keys(S.p.d.rot).sort((a,b)=>a.localeCompare(b)); }
function rpOrdens(){
  const sel = $("op-produto"), cur = sel.value; const P = produtosComRoteiro();
  sel.innerHTML = `<option value="">escolha...</option>` + P.map(p=>`<option${p===cur?" selected":""}>${esc(p)}</option>`).join("");
  $("op-norot").textContent = P.length ? "" : "Nenhum roteiro cadastrado. O admin precisa rodar supabase/seeds/roteiros_producao.sql.";
  const fs = ["Abertas","Concluídas","Todas"];
  $("op-filt").innerHTML = fs.map(f=>`<button type="button" class="chip${UI.p.opFilt===f?" on":""}" data-popf="${f}">${f}</button>`).join("");
  let L = Object.values(S.p.ordens).sort((a,b)=>b.id.localeCompare(a.id));
  if (UI.p.opFilt==="Abertas") L = L.filter(o=>o.status==="Aberta"||o.status==="Em produção");
  if (UI.p.opFilt==="Concluídas") L = L.filter(o=>o.status==="Concluída");
  const T = today();
  $("op-lista").innerHTML = L.length ? `<div class="tw"><table><thead><tr><th>OP</th><th>Produto</th><th>Lote</th><th>Status</th><th>Progresso</th><th class="n">Feitas</th><th class="n">Man.</th><th class="n">Sucata</th><th>Previsto</th><th>Prio</th></tr></thead><tbody>${
    L.map(o=>{ const r = opResumo(o); const atr = o.previsto && o.previsto<T && r.concl<o.quantidade && o.status!=="Cancelada";
      return `<tr class="click" data-pop="${esc(o.id)}"><td class="id">${esc(o.id)}</td><td>${esc(o.produto)}</td><td>${esc(o.lote)}</td><td>${opTag(o.status)}</td><td>${bar(r.concl,o.quantidade,12)}</td><td class="n">${r.concl}/${o.quantidade}</td><td class="n">${r.man||""}</td><td class="n">${r.suc||""}</td><td class="${atr?"alert":""}">${brs(o.previsto)}</td><td class="p-${esc(o.prio)}">${esc(o.prio)}</td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty">Nenhuma ordem ${UI.p.opFilt==="Todas"?"":UI.p.opFilt.toLowerCase()}.</div>`;
}

function marca(u, p){
  if (!u.rota.includes(p)) return `<span class="muted"> </span>`;
  const l = u.last[p];
  if (u.etapa===p && naFila(u)) return `<span class="f-Reparo">▶</span>`;
  if (l && l.resultado==="A") return `<span class="t-Aprovado">✓</span>`;
  if (l && l.resultado==="R") return `<span class="t-Reprovado">✗</span>`;
  return `<span class="muted">·</span>`;
}
function rpOp(){
  const o = S.p.ordens[UI.p.op];
  if (!o){ $("opd-title").textContent = UI.p.op||"-"; $("opd-head").innerHTML = `<div class="empty">Ordem não encontrada.</div>`; $("opd-grid").innerHTML=""; return; }
  const r = opResumo(o);
  $("opd-title").innerHTML = `${esc(o.id)} · ${esc(o.produto)}`;
  $("opd-head").innerHTML = `<div class="row sp"><div class="row">${opTag(o.status)} ${bar(r.concl,o.quantidade,20)} <b>${r.concl}/${o.quantidade}</b> concluídas
      ${r.man?`<span class="tag">${r.man} na manutenção</span>`:""}${r.suc?` <span class="alert">${r.suc} sucata</span>`:""}</div>
      <div class="row w-prod">${o.status==="Aberta"?`<button class="btn sec" data-popst="Em produção">Iniciar</button>`:""}${["Aberta","Em produção"].includes(o.status)?`<button class="btn sec" data-popst="Concluída">Concluir OP</button><button class="lk del" data-popst="Cancelada">cancelar OP</button>`:`<button class="lk" data-popst="Em produção">reabrir</button>`}</div></div>
    <dl class="kv" style="margin-top:10px"><div><dt>Lote</dt><dd>${esc(o.lote||"-")}</dd></div><div><dt>Início</dt><dd>${br(o.inicio)}</dd></div><div><dt>Previsto</dt><dd>${br(o.previsto)||"-"}</dd></div>
    <div><dt>Prioridade</dt><dd>${esc(o.prio)}</dd></div><div><dt>Criada por</dt><dd>${esc(nomeDe(o.criado_por)||"-")}</dd></div><div><dt>Observação</dt><dd>${esc(o.obs||"-")}</dd></div></dl>`;
  const rota = S.p.d.rota[o.produto] || [];
  $("opd-grid").innerHTML = r.us.length ? `<div class="tw"><table><thead><tr><th>Série</th>${rota.map(p=>`<th class="n" title="${esc(PNOME[p])}">${p}</th>`).join("")}<th>Estado</th><th>Etapa</th><th>NC</th></tr></thead><tbody>${
    r.us.sort((a,b)=>a.serie.localeCompare(b.serie)).map(u=>`<tr class="click" data-punit="${esc(u.id)}"><td class="id">${esc(u.serie)}</td>${rota.map(p=>`<td class="n">${marca(u,p)}</td>`).join("")}<td>${estadoTag(u.estado)}</td><td>${u.etapa||"-"}</td><td>${u.nc?esc(u.nc.id):""}</td></tr>`).join("")}</tbody></table></div>
    <p class="hint">✓ aprovada · ✗ reprovada · ▶ na fila deste posto · clique na série para ver o histórico</p>` : `<div class="empty">Esta OP não tem unidades.</div>`;
}

function rpPosto(){
  const sel = $("ps-posto");
  if (!sel.options.length){ sel.innerHTML = POSTOS_P.map(([p,n])=>`<option value="${p}">${p} · ${esc(n)}</option>`).join(""); sel.value = localGet("posto") || "P1"; }
  const posto = sel.value; const Us = Object.values(S.p.d.U).filter(ativo);
  const fila = Us.filter(u=>u.etapa===posto && naFila(u));
  const opSel = $("ps-op"), opv = opSel.value; const opsF = [...new Set(fila.map(u=>u.ordem_id))].sort();
  opSel.innerHTML = `<option value="">todas as OPs</option>` + opsF.map(id=>`<option${id===opv?" selected":""}>${esc(id)}</option>`).join("");
  const F = fila.filter(u=>!opSel.value || u.ordem_id===opSel.value)
    .sort((a,b)=>prioN(a.op.prio)-prioN(b.op.prio) || a.ordem_id.localeCompare(b.ordem_id) || a.serie.localeCompare(b.serie));
  $("ps-info").innerHTML = `${F.length} na fila de <b>${posto}</b>. ${canProd()?"Escolha uma unidade ou digite/leia a série.":"Somente operador ou admin registram passagens."}`;
  $("ps-fila").innerHTML = F.length ? `<div class="tw"><table><thead><tr><th>Série</th><th>OP</th><th>Produto</th><th>Prio</th><th></th></tr></thead><tbody>${
    F.slice(0,80).map(u=>`<tr${UI.p.ps&&UI.p.ps.id===u.id?' style="background:var(--sel)"':""}><td class="id">${esc(u.serie)}</td><td class="nw">${esc(u.ordem_id)}</td><td>${esc(u.produto)}</td><td class="p-${esc(u.op.prio)}">${esc(u.op.prio)}</td><td class="w-prod"><button class="lk" data-ptest="${esc(u.id)}">testar</button></td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">Fila vazia neste posto.</div>`;
  const volta = Us.filter(u=>naManut(u) && u.nc && u.nc.posto===posto);
  $("ps-volta").innerHTML = volta.length ? `<div class="tw"><table><thead><tr><th>Série</th><th>NC</th><th>Falha</th><th>Manutenção</th><th>Estado</th><th></th></tr></thead><tbody>${
    volta.map(u=>`<tr><td class="id">${esc(u.serie)}</td><td>${esc(u.nc.id)}</td><td>${esc(u.nc.modo_falha)}</td><td>${u.nc.placa_id?`<button class="lk" data-ficha="${esc(u.nc.placa_id)}">${esc(u.nc.placa_id)}</button> ${u.man?st(u.man.status):""}`:"-"}</td><td>${estadoTag(u.estado)}</td>
      <td class="nw w-prod">${u.estado!=="Em manutenção"?`<button class="lk" data-pvolta="${esc(u.nc.id)}">receber de volta</button> `:""}<button class="lk del" data-psuc="${esc(u.nc.id)}">sucatear</button></td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">Nenhuma unidade deste posto na manutenção.</div>`;
  const ps = UI.p.ps;
  if (ps && (!S.p.d.U[ps.id] || S.p.d.U[ps.id].etapa!==ps.posto || !naFila(S.p.d.U[ps.id]))){ if (!ps.salvando){ UI.p.ps = null; } }
  rpWork();
}
function rpWork(force){
  const ps = UI.p.ps;
  const sig = ps ? `${ps.id}|${ps.falha}|${ps.posto}` : "";
  if (!force && $("ps-work").dataset.sig===sig && sig) { updWorkButtons(); return; }
  $("ps-work").dataset.sig = sig;
  clearInterval(psTick); psTick = null;
  if (!ps){ $("ps-wtitle").textContent = "Unidade em teste"; $("ps-work").innerHTML = `<div class="empty">Nenhuma unidade aberta. Clique em "testar" na fila.</div>`; return; }
  const u = S.p.d.U[ps.id]; const ops = (S.p.d.rot[u.produto]||[]).filter(r=>r.posto===ps.posto);
  const padrao = ops.reduce((a,r)=>a+r.tempo_min,0);
  $("ps-wtitle").textContent = `${ps.posto} · ${u.serie}`;
  const modos = [...MODOS_F.filter(m=>m[0]===ps.posto).map(m=>m[1]), ...MODOS_F.filter(m=>m[0]!==ps.posto).map(m=>m[1]), "Outro (descrever)"];
  $("ps-work").innerHTML = `<div class="row sp"><div><b>${esc(u.produto)}</b> <span class="muted">· ${esc(u.ordem_id)} · lote ${esc(u.op.lote||"-")}</span></div>
      <div class="big" id="ps-timer" style="font-size:34px">0:00</div></div>
    <p class="muted" style="margin:4px 0 10px">Tempo padrão do roteiro: ${padrao?mmss(padrao*60):"-"} · ${ops.length} operação(ões)</p>
    <ul class="tl">${ops.map(r=>`<li style="grid-template-columns:3ch 1fr"><span><input type="checkbox" data-pchk="${esc(r.cod_op)}"${ps.checks.includes(r.cod_op)?" checked":""} aria-label="${esc(r.cod_op)}" style="width:auto"></span>
      <span><b>${esc(r.cod_op)}</b> ${esc(r.operacao)} <span class="muted">· ${r.tempo_min?mmss(r.tempo_min*60):""}</span><br><span class="x">critério: ${esc(r.criterio||"-")}</span>${r.em_falha?`<br><span class="x">em falha: ${esc(r.em_falha)}</span>`:""}</span></li>`).join("") || `<li class="empty" style="display:block">Sem operações cadastradas para este posto.</li>`}</ul>
    <div class="row" style="margin-top:12px"><button class="lk" type="button" data-pall="1">marcar todas</button></div>
    ${ps.falha ? `<form id="f-reprova" style="margin-top:12px" autocomplete="off">
        <label class="w2">Modo de falha <span class="req">*</span><select id="rp-modo">${modos.map(m=>`<option${m===ps.modo?" selected":""}>${esc(m)}</option>`).join("")}</select></label>
        <label class="wide">O que foi visto <span class="req">*</span><input id="rp-desc" maxlength="200" value="${esc(ps.desc||"")}"></label>
        <div class="row wide"><button class="btn danger" type="submit">Confirmar reprovação e abrir NC</button><button class="btn sec" type="button" data-pnofalha="1">Voltar</button></div>
      </form>` : `<div class="row" style="margin-top:12px"><button class="btn" type="button" data-pap="1" id="ps-ap">Aprovar</button><button class="btn danger" type="button" data-prp="1">Reprovar</button><button class="lk" type="button" data-pcan="1">cancelar</button></div>`}`;
  const tick = ()=>{ const el = $("ps-timer"); if (el) el.textContent = mmss((Date.now()-ps.t0)/1000); };
  tick(); psTick = setInterval(tick, 1000);
  updWorkButtons();
  const f = $("f-reprova");
  if (f){
    $("rp-modo").addEventListener("change", e=>ps.modo = e.target.value);
    $("rp-desc").addEventListener("input", e=>ps.desc = e.target.value);
    f.addEventListener("submit", e=>{ e.preventDefault(); reprovar(); });
    $("rp-desc").focus();
  }
}
function updWorkButtons(){
  const ps = UI.p.ps; const b = $("ps-ap"); if (!ps || !b) return;
  const u = S.p.d.U[ps.id]; const ops = (S.p.d.rot[u.produto]||[]).filter(r=>r.posto===ps.posto);
  const ok = ops.every(r=>ps.checks.includes(r.cod_op));
  b.disabled = !ok; b.style.opacity = ok ? 1 : .45; b.title = ok ? "" : "Marque todas as operações para aprovar";
}
function abrirUnidade(id){
  if (!canProd()){ toast("Somente operador ou admin registram passagens.", true); return; }
  const u = S.p.d.U[id]; if (!u) return;
  if (!(u.etapa && naFila(u))){ toast(`${u.serie}: ${u.estado}${u.etapa?" em "+u.etapa:""}.`, true); return; }
  const posto = $("ps-posto").value;
  if (u.etapa!==posto){ $("ps-posto").value = u.etapa; localSet("posto", u.etapa); toast(`${u.serie} está no ${u.etapa}. Posto trocado.`); }
  UI.p.ps = {id, posto:u.etapa, t0:Date.now(), checks:[], falha:false, modo:"", desc:""};
  render(); rpWork(true);
}
async function aprovar(){
  const ps = UI.p.ps; if (!ps || ps.salvando) return; const u = S.p.d.U[ps.id];
  ps.salvando = true;
  const fim = new Date();
  const ok = await write(()=>sb.from("prod_eventos").insert({unidade_id:u.id, ordem_id:u.ordem_id, posto:ps.posto, resultado:"A",
    inicio:new Date(ps.t0).toISOString(), fim:fim.toISOString(), duracao_s:Math.round((fim-ps.t0)/1000), checklist:ps.checks}), null, ["prod_eventos"]);
  ps.salvando = false;
  if (!ok) return;
  if (u.op.status==="Aberta") write(()=>sb.from("prod_ordens").update({status:"Em produção"}).eq("id", u.ordem_id), null, ["prod_ordens"]);
  const prox = u.rota[u.rota.indexOf(ps.posto)+1];
  toast(`${u.serie} aprovada no ${ps.posto}. ${prox?"Próximo: "+prox:"Unidade concluída."}`);
  UI.p.ps = null; rpWork(true); $("ps-serie").focus();
}
async function reprovar(){
  const ps = UI.p.ps; if (!ps || ps.salvando) return; const u = S.p.d.U[ps.id];
  ps.modo = $("rp-modo").value; ps.desc = $("rp-desc").value.trim();
  if (!ps.modo || !ps.desc){ toast("Escolha o modo de falha e descreva o que foi visto.", true); return; }
  ps.salvando = true;
  const fim = new Date();
  const ev = await write(()=>sb.from("prod_eventos").insert({unidade_id:u.id, ordem_id:u.ordem_id, posto:ps.posto, resultado:"R",
    inicio:new Date(ps.t0).toISOString(), fim:fim.toISOString(), duracao_s:Math.round((fim-ps.t0)/1000), checklist:ps.checks, modo_falha:ps.modo, obs:ps.desc}).select("id").single(), null, ["prod_eventos"]);
  if (!ev){ ps.salvando = false; return; }
  const ci = catInfo(u.produto);
  const r = await write(()=>sb.rpc("abrir_nc", {p_unidade:u.id, p_posto:ps.posto, p_modo:ps.modo, p_descricao:ps.desc, p_evento:ev.id,
    p_versao:(ci.versoes||[])[0]||null, p_firmware:(ci.firmware||[])[0]||null, p_linha:ci.linha||null, p_tipo:ci.tipo||null}), null, ["prod_nc","prod_eventos","placas"]);
  ps.salvando = false;
  if (r){ toast(`${r.nc} aberta. Placa ${r.placa} enviada à manutenção.`); UI.p.ps = null; rpWork(true); }
}
async function fecharNc(id, status){
  await write(()=>sb.from("prod_nc").update({status, fechado_em:new Date().toISOString(), fechado_por:ME.id}).eq("id", id),
    status==="Devolvida" ? `${id} encerrada. A unidade voltou para a fila do posto.` : `${id}: unidade marcada como sucata.`, ["prod_nc"]);
}

function rpRastreio(){
  const q = ($("rs-busca").value||"").trim().toUpperCase(); const Us = Object.values(S.p.d.U);
  let L = q ? Us.filter(u=>u.serie.toUpperCase().includes(q) || u.ordem_id.toUpperCase().includes(q) || (u.nc&&u.nc.id.includes(q)) || u.ncs.some(n=>n.id===q||n.placa_id===q)) : [];
  $("rs-res").innerHTML = !q ? `<div class="empty">Digite uma série, OP, NC ou placa da manutenção.</div>` : L.length ? `<div class="tw"><table><thead><tr><th>Série</th><th>OP</th><th>Produto</th><th>Estado</th><th>Etapa</th><th class="n">Passagens</th></tr></thead><tbody>${
    L.slice(0,100).map(u=>`<tr class="click" data-punit="${esc(u.id)}"><td class="id">${esc(u.serie)}</td><td>${esc(u.ordem_id)}</td><td>${esc(u.produto)}</td><td>${estadoTag(u.estado)}</td><td>${u.etapa||"-"}</td><td class="n">${u.ev.length}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">Nada encontrado.</div>`;
  const u = S.p.d.U[UI.p.unit];
  if (!u){ $("rs-unit").innerHTML = `<div class="empty">Escolha uma unidade para ver o histórico completo.</div>`; return; }
  const itens = [...u.ev.map(e=>({t:e.tfim, html:`<span class="h"><b>${e.posto}</b> ${esc(PNOME[e.posto]||"")} · ${e.resultado==="A"?'<span class="t-Aprovado">[APROVADA]</span>':'<span class="t-Reprovado">[REPROVADA]</span>'} · ${e.duracao_s!=null?mmss(e.duracao_s):"-"} · ${esc(nomeDe(e.operador))}</span>${e.modo_falha?`<br><span class="x">falha: ${esc(e.modo_falha)}${e.obs?" · "+esc(e.obs):""}</span>`:""}${e.nc_id?`<br><span class="tag">${esc(e.nc_id)}</span>`:""}`})),
    ...u.ncs.filter(n=>n.status!=="Aberta" && n.fechado_em).map(n=>({t:Date.parse(n.fechado_em), html:`<span class="h">${esc(n.id)} ${n.status==="Devolvida"?"<span class=\"t-Aprovado\">[VOLTOU DA MANUTENÇÃO]</span>":"<span class=\"alert\">[SUCATA]</span>"}</span>${n.placa_id?` <button class="lk" data-ficha="${esc(n.placa_id)}">ver ${esc(n.placa_id)}</button>`:""}`}))]
    .sort((a,b)=>a.t-b.t);
  $("rs-unit").innerHTML = `<div class="row sp"><div><span class="big" style="font-size:30px">${esc(u.serie)}</span> ${estadoTag(u.estado)}</div><div class="muted">${esc(u.produto)} · ${esc(u.ordem_id)}${u.etapa?" · etapa "+u.etapa:""}</div></div>
    ${u.nc?`<p>NC aberta: <b>${esc(u.nc.id)}</b> (${esc(u.nc.posto)} · ${esc(u.nc.modo_falha)})${u.nc.placa_id?` · <button class="lk" data-ficha="${esc(u.nc.placa_id)}">abrir ficha ${esc(u.nc.placa_id)} na manutenção</button>`:""}</p>`:""}
    <ul class="tl" style="margin-top:8px">${itens.map(i=>`<li><span class="d">${new Date(i.t).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><span>${i.html}</span></li>`).join("") || `<li class="empty" style="display:block">Ainda não passou por nenhum posto.</li>`}</ul>`;
}

function rpNc(){
  const fs = ["Abertas","Todas"];
  $("nc-filt").innerHTML = fs.map(f=>`<button type="button" class="chip${UI.p.ncFilt===f?" on":""}" data-pncf="${f}">${f}</button>`).join("");
  let L = [...S.p.nc].sort((a,b)=>(b.criado_em||"").localeCompare(a.criado_em||""));
  if (UI.p.ncFilt==="Abertas") L = L.filter(n=>n.status==="Aberta");
  $("nc-lista").innerHTML = L.length ? `<div class="tw"><table><thead><tr><th>NC</th><th>Data</th><th>Série</th><th>OP</th><th>Produto</th><th>Posto</th><th>Falha</th><th>Manutenção</th><th>Status</th><th></th></tr></thead><tbody>${
    L.map(n=>{ const u = S.p.d.U[n.unidade_id]; const pl = S.derived[n.placa_id];
      return `<tr><td class="id">${esc(n.id)}</td><td class="nw">${brs((n.criado_em||"").slice(0,10))}</td><td>${u?`<button class="lk" data-punit="${esc(u.id)}">${esc(u.serie)}</button>`:"-"}</td><td>${esc(n.ordem_id)}</td><td>${esc(n.produto)}</td><td>${esc(n.posto)}</td>
      <td>${esc(n.modo_falha)}${n.descricao?`<br><span class="muted">${esc(n.descricao)}</span>`:""}</td>
      <td>${n.placa_id?`<button class="lk" data-ficha="${esc(n.placa_id)}">${esc(n.placa_id)}</button> ${pl?st(pl.status):""}`:"-"}</td><td>${esc(n.status)}</td>
      <td class="nw w-prod">${n.status==="Aberta"?`${pl&&pl.fase==="Encerrada"?`<button class="lk" data-pvolta="${esc(n.id)}">receber de volta</button> `:""}<button class="lk del" data-psuc="${esc(n.id)}">sucatear</button>`:""}</td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty">Nenhuma não conformidade ${UI.p.ncFilt==="Abertas"?"aberta":"registrada"}.</div>`;
}

function rpTempos(){
  const by = {};
  for (const e of S.p.eventos){ if (!(e.duracao_s>0)) continue; const u = S.p.unidades.find(x=>x.id===e.unidade_id); if (!u) continue; const k = u.produto+"|"+e.posto; (by[k] ||= []).push(e.duracao_s); }
  const rows = Object.entries(by).map(([k,a])=>{ const [produto,posto] = k.split("|"); const ops = (S.p.d.rot[produto]||[]).filter(r=>r.posto===posto);
    const padrao = ops.reduce((s,r)=>s+r.tempo_min,0)*60; const med = mediana(a); return {produto, posto, n:a.length, med, media:a.reduce((s,x)=>s+x,0)/a.length, padrao, desv: padrao? (med-padrao)/padrao : null}; })
    .sort((a,b)=>a.produto.localeCompare(b.produto) || a.posto.localeCompare(b.posto));
  $("tp-body").innerHTML = rows.length ? `<div class="tw"><table><thead><tr><th>Produto</th><th>Posto</th><th class="n">Medições</th><th class="n">Mediana</th><th class="n">Média</th><th class="n">Padrão do roteiro</th><th class="n">Diferença</th><th></th></tr></thead><tbody>${
    rows.map(r=>`<tr><td>${esc(r.produto)}</td><td class="id">${r.posto}</td><td class="n">${r.n}</td><td class="n"><b>${mmss(r.med)}</b></td><td class="n">${mmss(r.media)}</td><td class="n">${r.padrao?mmss(r.padrao):"-"}</td>
      <td class="n ${r.desv>0.15?"alert":(r.desv<-0.15?"t-Aprovado":"")}">${r.desv==null?"-":(r.desv>0?"+":"")+Math.round(r.desv*100)+"%"}</td>
      <td class="adm-only">${r.n>=5&&r.padrao?`<button class="lk" data-tapl="${esc(r.produto)}|${r.posto}|${r.med}">aplicar mediana ao roteiro</button>`:`<span class="muted">${r.n<5?"precisa de 5 medições":""}</span>`}</td></tr>`).join("")}</tbody></table></div>
    <p class="hint">O tempo vem do cronômetro do posto (abrir a unidade até aprovar ou reprovar). Diferença acima de 15% em vermelho. Aplicar a mediana ajusta as operações do posto na mesma proporção.</p>`
    : `<div class="empty">Ainda não há passagens com tempo registrado. Os tempos aparecem conforme o posto de trabalho é usado.</div>`;
}
async function aplicarMediana(spec){
  const [produto, posto, med] = spec.split("|"); const ops = (S.p.d.rot[produto]||[]).filter(r=>r.posto===posto);
  const padrao = ops.reduce((s,r)=>s+r.tempo_min,0)*60; if (!padrao) return; const f = +med/padrao;
  for (const r of ops){ const ok = await write(()=>sb.from("prod_roteiros").update({tempo_min:Math.round(r.tempo_min*f*100)/100}).eq("id", r.id), null, ["prod_roteiros"]); if (!ok) return; }
  toast(`Tempo padrão de ${produto} ${posto} atualizado para ${mmss(+med)}.`);
}
function exportTempos(){
  const cols = ["fim","serie","ordem","produto","posto","resultado","duracao_s","operador","modo_falha","obs","nc"];
  const cell = v => { const s = String(v??""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const linhas = S.p.eventos.map(e=>{ const u = S.p.unidades.find(x=>x.id===e.unidade_id)||{}; return [e.fim||e.criado_em, u.serie, e.ordem_id, u.produto, e.posto, e.resultado, e.duracao_s, nomeDe(e.operador), e.modo_falha, e.obs, e.nc_id].map(cell).join(";"); });
  baixar(`producao-passagens-${today()}.csv`, "﻿"+[cols.join(";"), ...linhas].join("\r\n"), "text/csv");
}

/* ---------------- eventos da interface ---------------- */
document.addEventListener("click", e=>{
  const t = e.target;
  const op = t.closest("[data-pop]"); if (op){ UI.p.op = op.dataset.pop; go("p-op"); return; }
  const un = t.closest("[data-punit]"); if (un){ UI.p.unit = un.dataset.punit; const u = S.p.d.U[un.dataset.punit]; if (u) $("rs-busca").value = u.serie; go("p-rastreio"); return; }
  if (t.dataset.popf){ UI.p.opFilt = t.dataset.popf; render(); }
  if (t.dataset.pncf){ UI.p.ncFilt = t.dataset.pncf; render(); }
  if (t.dataset.popst){ const s = t.dataset.popst; const run = ()=>write(()=>sb.from("prod_ordens").update({status:s}).eq("id", UI.p.op), `OP ${s.toLowerCase()}.`, ["prod_ordens"]);
    if (s==="Cancelada") confirmDel(t, run); else run(); }
  if (t.dataset.ptest) abrirUnidade(t.dataset.ptest);
  if (t.dataset.pall && UI.p.ps){ const u = S.p.d.U[UI.p.ps.id]; UI.p.ps.checks = (S.p.d.rot[u.produto]||[]).filter(r=>r.posto===UI.p.ps.posto).map(r=>r.cod_op);
    document.querySelectorAll("[data-pchk]").forEach(c=>c.checked=true); updWorkButtons(); }
  if (t.dataset.pap) aprovar();
  if (t.dataset.prp && UI.p.ps){ UI.p.ps.falha = true; rpWork(true); }
  if (t.dataset.pnofalha && UI.p.ps){ UI.p.ps.falha = false; rpWork(true); }
  if (t.dataset.pcan){ UI.p.ps = null; rpWork(true); render(); }
  if (t.dataset.pvolta) fecharNc(t.dataset.pvolta, "Devolvida");
  if (t.dataset.psuc) confirmDel(t, ()=>fecharNc(t.dataset.psuc, "Sucata"));
  if (t.dataset.tapl) confirmDel(t, ()=>aplicarMediana(t.dataset.tapl));
  if (t.id==="tp-exp") exportTempos();
});
document.addEventListener("change", e=>{
  const t = e.target;
  if (t.dataset.pchk && UI.p.ps){ const c = UI.p.ps.checks; const k = t.dataset.pchk; if (t.checked){ if (!c.includes(k)) c.push(k); } else UI.p.ps.checks = c.filter(x=>x!==k); updWorkButtons(); }
});
$("ps-posto").addEventListener("change", e=>{ localSet("posto", e.target.value); if (UI.p.ps && UI.p.ps.posto!==e.target.value) UI.p.ps = null; render(); });
$("ps-op").addEventListener("change", render);
$("ps-serie").addEventListener("keydown", e=>{
  if (e.key!=="Enter") return; e.preventDefault();
  const s = e.target.value.trim().toUpperCase(); if (!s) return;
  const u = Object.values(S.p.d.U).find(x=>x.serie.toUpperCase()===s);
  if (!u){ toast(`Série ${s} não encontrada.`, true); return; }
  e.target.value = ""; abrirUnidade(u.id);
});
$("rs-busca").addEventListener("input", ()=>{ UI.p.unit = null; render(); });
$("f-op").addEventListener("submit", async e=>{
  e.preventDefault(); const err = $("op-err"); err.textContent = "";
  const produto = $("op-produto").value, qtd = Math.round(+$("op-qtd").value);
  const series = [...new Set($("op-series").value.split(/[\n,;]+/).map(s=>s.trim().toUpperCase()).filter(Boolean))];
  if (!produto){ err.textContent = "!! escolha o produto"; return; }
  if (!(qtd>=1 && qtd<=500)){ err.textContent = "!! quantidade entre 1 e 500"; return; }
  if (series.length && series.length!==qtd){ err.textContent = `!! você listou ${series.length} séries para ${qtd} unidades`; return; }
  const exist = new Set(S.p.unidades.map(u=>u.serie.toUpperCase())); const dup = series.filter(s=>exist.has(s));
  if (dup.length){ err.textContent = "!! séries já usadas: "+dup.slice(0,5).join(", "); return; }
  const r = await write(()=>sb.from("prod_ordens").insert({produto, quantidade:qtd, lote:nz($("op-lote").value.trim()), previsto:nz($("op-prev").value), prio:$("op-prio").value||"Normal", obs:nz($("op-obs").value.trim())}).select("id").single(), null, ["prod_ordens"]);
  if (!r) return;
  const lista = series.length ? series : Array.from({length:qtd}, (_,i)=>`${r.id}-${String(i+1).padStart(3,"0")}`);
  const ok = await write(()=>sb.from("prod_unidades").insert(lista.map(s=>({ordem_id:r.id, serie:s, produto}))), `${r.id} criada com ${lista.length} unidades.`, ["prod_unidades"]);
  if (ok){ e.target.reset(); $("op-qtd").value = 10; UI.p.op = r.id; go("p-op"); }
});
$("op-prio").innerHTML = opts(PRIO, "Normal");

window.PROD = { views:VIEWS_PROD, tables:PROD_TABLES, load:prodLoad, derive:deriveProd, render:prodRender };
