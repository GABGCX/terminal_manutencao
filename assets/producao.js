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
const VIEWS_PROD = [["p-painel","PAINEL"],["p-ordens","ORDENS"],["p-celulas","CÉLULAS"],["p-posto","POSTO"],["p-rastreio","RASTREIO"],["p-nc","NC"],["p-tempos","TEMPOS"],["p-equipe","EQUIPE"]];
const PROD_TABLES = ["prod_roteiros","prod_ordens","prod_unidades","prod_eventos","prod_nc","prod_lotes_smd","prod_of","apontamentos"];
const CEL_PROD = ["SMD","USI","SER","INT","MONT"];
const ATIV_AP = ["Produção","Setup/preparação","Retrabalho","Desenvolvimento/protótipo","Aguardando material","Limpeza/5S","Treinamento"];
const LSTAT = ["Aberto","Em montagem","Concluído","Cancelado"];
const OFSTAT = ["Aberta","Em execução","Concluída","Cancelada"];
/* integração no P8: robusta (INT, Bruno) ou leve (MONT, Helder). Mesma regra de celula_padrao() no banco. */
const ROBUSTOS = ["FIR","DIR Nutri","DIR Dual Nutri","ECO PRO Nutri","ECO PRO Dual Nutri","ECO PRO 30N","EMR"];
const celulaPadrao = (produto, posto) => posto!=="P8" ? "MONT" : (ROBUSTOS.includes(produto) || /^Quadro/.test(produto||"")) ? "INT" : "MONT";
function celulaDe(produto, posto){ const r = (S.p.d.rot[produto]||[]).find(x=>x.posto===posto && x.celula); return r ? r.celula : celulaPadrao(produto, posto); }
const podeU = (produto, posto) => podeReg(celulaDe(produto, posto));
const podeConfirmar = n => temPapel("admin","responsavel") && podeU(n.produto, n.posto);
const POSTO_OPTS = [...POSTOS_P.slice(0,7).map(([p,n])=>[p, `${p} · ${n}`]), ["P8|MONT","P8 · Integração leve (MONT)"], ["P8|INT","P8 · Integração robusta (INT)"]];
const postoVal = (produto, posto) => posto==="P8" ? "P8|"+celulaDe(produto, "P8") : posto;
S.p = {roteiros:[], ordens:{}, unidades:[], eventos:[], nc:[], lotes:[], ofs:[], apont:[], d:{rot:{}, rota:{}, U:{}}};
UI.p = {opFilt:"Abertas", ncFilt:"Abertas", op:null, unit:null, ps:null, rsq:"", cel:null, prefOp:null};
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
  else if (t==="prod_lotes_smd") S.p.lotes = rows.map(r=>({...clean(r), quantidade:+r.quantidade, qtd_ok:+r.qtd_ok, qtd_refugo:+r.qtd_refugo}));
  else if (t==="prod_of") S.p.ofs = rows.map(r=>({...clean(r), quantidade:+r.quantidade, qtd_feita:+r.qtd_feita}));
  else if (t==="apontamentos") S.p.apont = rows.map(r=>({...clean(r), horas:+r.horas}));
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
    const ncAb = ncs.find(n=>n.status==="Aberta" || n.status==="Pendente") || null;
    const op = S.p.ordens[u.ordem_id] || null;
    let estado, man = null;
    if (ncs.some(n=>n.status==="Sucata")) estado = "Sucata";
    else if (ncAb && ncAb.status==="Pendente") estado = "NC pendente";
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
const naManut = u => ["NC pendente","Em manutenção","Pronta para voltar","Decidir retorno"].includes(u.estado);
function opResumo(o){
  const us = Object.values(S.p.d.U).filter(u=>u.ordem_id===o.id);
  const c = k => us.filter(u=>u.estado===k).length;
  const concl = c("Concluída"), suc = c("Sucata"), man = us.filter(naManut).length, proc = us.filter(naFila).length;
  return {us, total:us.length, concl, suc, man, proc, pct: o.quantidade ? concl/o.quantidade : 0};
}
const estadoTag = e => {
  const cls = {"Concluída":"f-Encerrada","Sucata":"alert","Em manutenção":"f-Espera","Pronta para voltar":"f-Teste","Decidir retorno":"alert","NC pendente":"alert","Aguardando início":"f-Fila","Em processo":"f-Reparo","Sem roteiro":"muted"}[e] || "";
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
  else if (v==="p-celulas") rpCelulas();
  else if (v==="p-equipe") rpEquipe();
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
  const qb = ($("op-busca").value||"").trim().toLowerCase();
  if (qb) L = L.filter(o=>[o.id,o.produto,o.lote,o.pedido,o.cliente].some(x=>(x||"").toLowerCase().includes(qb)));
  if (UI.p.opFilt==="Abertas") L = L.filter(o=>o.status==="Aberta"||o.status==="Em produção");
  if (UI.p.opFilt==="Concluídas") L = L.filter(o=>o.status==="Concluída");
  const T = today();
  $("op-lista").innerHTML = L.length ? `<div class="tw"><table><thead><tr><th>OP</th><th>Produto</th><th>Pedido</th><th>Cliente</th><th>Lote</th><th>Status</th><th>Progresso</th><th class="n">Feitas</th><th class="n">Man.</th><th class="n">Sucata</th><th>Previsto</th><th>Prio</th></tr></thead><tbody>${
    L.map(o=>{ const r = opResumo(o); const atr = o.previsto && o.previsto<T && r.concl<o.quantidade && o.status!=="Cancelada";
      return `<tr class="click" data-pop="${esc(o.id)}"><td class="id">${esc(o.id)}</td><td>${esc(o.produto)}</td><td class="nw">${esc(o.pedido)}</td><td>${esc(o.cliente)}</td><td>${esc(o.lote)}</td><td>${opTag(o.status)}</td><td>${bar(r.concl,o.quantidade,12)}</td><td class="n">${r.concl}/${o.quantidade}</td><td class="n">${r.man||""}</td><td class="n">${r.suc||""}</td><td class="${atr?"alert":""}">${brs(o.previsto)}</td><td class="p-${esc(o.prio)}">${esc(o.prio)}</td></tr>`; }).join("")}</tbody></table></div>`
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
      <div class="row">${!(podeReg("MONT")||podeReg("INT")) ? "" : (o.status==="Aberta"?`<button class="btn sec" data-popst="Em produção">Iniciar</button>`:"") + (["Aberta","Em produção"].includes(o.status)?`<button class="btn sec" data-popst="Concluída">Concluir OP</button><button class="lk del" data-popst="Cancelada">cancelar OP</button>`:`<button class="lk" data-popst="Em produção">reabrir</button>`)}</div></div>
    <dl class="kv" style="margin-top:10px"><div><dt>Pedido</dt><dd>${esc(o.pedido||"-")}</dd></div><div><dt>Cliente</dt><dd>${esc(o.cliente||"-")}</dd></div><div><dt>Lote</dt><dd>${esc(o.lote||"-")}</dd></div><div><dt>Início</dt><dd>${br(o.inicio)}</dd></div><div><dt>Previsto</dt><dd>${br(o.previsto)||"-"}</dd></div>
    <div><dt>Prioridade</dt><dd>${esc(o.prio)}</dd></div><div><dt>Criada por</dt><dd>${esc(nomeDe(o.criado_por)||"-")}</dd></div><div><dt>Observação</dt><dd>${esc(o.obs||"-")}</dd></div></dl>${ligados(o)}`;
  const rota = S.p.d.rota[o.produto] || [];
  $("opd-grid").innerHTML = r.us.length ? `<div class="tw"><table><thead><tr><th>Série</th>${rota.map(p=>`<th class="n" title="${esc(PNOME[p])}">${p}</th>`).join("")}<th>Estado</th><th>Etapa</th><th>NC</th></tr></thead><tbody>${
    r.us.sort((a,b)=>a.serie.localeCompare(b.serie)).map(u=>`<tr class="click" data-punit="${esc(u.id)}"><td class="id">${esc(u.serie)}</td>${rota.map(p=>`<td class="n">${marca(u,p)}</td>`).join("")}<td>${estadoTag(u.estado)}</td><td>${u.etapa||"-"}</td><td>${u.nc?esc(u.nc.id):""}</td></tr>`).join("")}</tbody></table></div>
    <p class="hint">✓ aprovada · ✗ reprovada · ▶ na fila deste posto · clique na série para ver o histórico</p>` : `<div class="empty">Esta OP não tem unidades.</div>`;
}

function rpPosto(){
  const sel = $("ps-posto");
  if (!sel.options.length){
    sel.innerHTML = POSTO_OPTS.map(([v,n])=>`<option value="${v}">${esc(n)}</option>`).join("");
    const salvo = localGet("posto"); const cel = celulaHoje();
    sel.value = POSTO_OPTS.some(o=>o[0]===salvo) ? salvo : (cel==="INT" ? "P8|INT" : "P1");
  }
  const [posto, celF] = sel.value.split("|"); const Us = Object.values(S.p.d.U).filter(ativo);
  const doPosto = u => !celF || celulaDe(u.produto, posto)===celF;
  const fila = Us.filter(u=>u.etapa===posto && naFila(u) && doPosto(u));
  const opSel = $("ps-op"), opv = opSel.value; const opsF = [...new Set(fila.map(u=>u.ordem_id))].sort();
  opSel.innerHTML = `<option value="">todas as OPs</option>` + opsF.map(id=>`<option${id===opv?" selected":""}>${esc(id)}</option>`).join("");
  const F = fila.filter(u=>!opSel.value || u.ordem_id===opSel.value)
    .sort((a,b)=>prioN(a.op.prio)-prioN(b.op.prio) || a.ordem_id.localeCompare(b.ordem_id) || a.serie.localeCompare(b.serie));
  const registra = celF ? podeReg(celF) : (F.length ? F.some(u=>podeU(u.produto, posto)) : podeReg("MONT"));
  $("ps-info").innerHTML = `${F.length} na fila de <b>${posto}${celF?" · "+celF:""}</b>. ${registra?"Escolha uma unidade ou digite/leia a série.":"Você não registra neste posto hoje (só consulta)."}`;
  $("ps-fila").innerHTML = F.length ? `<div class="tw"><table><thead><tr><th>Série</th><th>OP</th><th>Produto</th><th>Prio</th><th></th></tr></thead><tbody>${
    F.slice(0,80).map(u=>`<tr${UI.p.ps&&UI.p.ps.id===u.id?' style="background:var(--sel)"':""}><td class="id">${esc(u.serie)}</td><td class="nw">${esc(u.ordem_id)}</td><td>${esc(u.produto)}</td><td class="p-${esc(u.op.prio)}">${esc(u.op.prio)}</td><td>${podeU(u.produto, posto)?`<button class="lk" data-ptest="${esc(u.id)}">testar</button>`:""}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">Fila vazia neste posto.</div>`;
  const volta = Us.filter(u=>naManut(u) && u.nc && u.nc.posto===posto && doPosto(u));
  $("ps-volta").innerHTML = volta.length ? `<div class="tw"><table><thead><tr><th>Série</th><th>NC</th><th>Falha</th><th>Manutenção</th><th>Estado</th><th></th></tr></thead><tbody>${
    volta.map(u=>`<tr><td class="id">${esc(u.serie)}</td><td>${esc(u.nc.id)}</td><td>${esc(u.nc.modo_falha)}</td><td>${u.nc.placa_id?`<button class="lk" data-ficha="${esc(u.nc.placa_id)}">${esc(u.nc.placa_id)}</button> ${u.man?st(u.man.status):""}`:"-"}</td><td>${estadoTag(u.estado)}</td>
      <td class="nw">${acoesNc(u.nc, u.estado!=="Em manutenção")}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">Nenhuma unidade deste posto na manutenção ou com NC pendente.</div>`;
  const ps = UI.p.ps;
  if (ps && (!S.p.d.U[ps.id] || S.p.d.U[ps.id].etapa!==ps.posto || !naFila(S.p.d.U[ps.id]))){ if (!ps.salvando){ UI.p.ps = null; } }
  rpWork();
}
/* botões de uma NC conforme status e permissão (o banco confere de novo) */
function acoesNc(n, pronta){
  if (n.status==="Pendente") return podeConfirmar(n)
    ? `<button class="lk" data-pconf="${esc(n.id)}">confirmar e enviar à manutenção</button> <button class="lk del" data-pdesc="${esc(n.id)}">descartar</button>`
    : `<span class="muted">aguardando o responsável</span>`;
  if (n.status!=="Aberta" || !podeU(n.produto, n.posto)) return "";
  return `${pronta?`<button class="lk" data-pvolta="${esc(n.id)}">receber de volta</button> `:""}<button class="lk del" data-psuc="${esc(n.id)}">sucatear</button>`;
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
  const u = S.p.d.U[id]; if (!u) return;
  if (!(u.etapa && naFila(u))){ toast(`${u.serie}: ${u.estado}${u.etapa?" em "+u.etapa:""}.`, true); return; }
  const cel = celulaDe(u.produto, u.etapa);
  if (!podeReg(cel)){ toast(`${u.serie} está no ${u.etapa} (célula ${cel}). Você não registra nessa célula hoje.`, true); return; }
  const val = postoVal(u.produto, u.etapa);
  if ($("ps-posto").value!==val){ $("ps-posto").value = val; localSet("posto", val); toast(`${u.serie} está no ${u.etapa}${u.etapa==="P8"?" · "+cel:""}. Posto trocado.`); }
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
  if (r){ toast(r.pendente ? `${r.nc} registrada. Aguarda o responsável da célula confirmar para ir à manutenção.` : `${r.nc} aberta. Placa ${r.placa} enviada à manutenção.`); UI.p.ps = null; rpWork(true); }
}
async function fecharNc(id, status){
  await write(()=>sb.from("prod_nc").update({status, fechado_em:new Date().toISOString(), fechado_por:ME.id}).eq("id", id),
    status==="Devolvida" ? `${id} encerrada. A unidade voltou para a fila do posto.` : status==="Descartada" ? `${id} descartada. A unidade volta para a fila do posto.` : `${id}: unidade marcada como sucata.`, ["prod_nc"]);
}
async function confirmarNc(id){
  const n = S.p.nc.find(x=>x.id===id); if (!n) return; const ci = catInfo(n.produto);
  const r = await write(()=>sb.rpc("confirmar_nc", {p_nc:id, p_versao:(ci.versoes||[])[0]||null, p_firmware:(ci.firmware||[])[0]||null, p_linha:ci.linha||null, p_tipo:ci.tipo||null}), null, ["prod_nc","placas"]);
  if (r) toast(`${id} confirmada. Placa ${r.placa} enviada à manutenção.`);
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
    ...u.ncs.filter(n=>!["Aberta","Pendente"].includes(n.status) && n.fechado_em).map(n=>({t:Date.parse(n.fechado_em), html:`<span class="h">${esc(n.id)} ${n.status==="Devolvida"?"<span class=\"t-Aprovado\">[VOLTOU DA MANUTENÇÃO]</span>":n.status==="Descartada"?"<span class=\"muted\">[NC DESCARTADA]</span>":"<span class=\"alert\">[SUCATA]</span>"}</span>${n.placa_id?` <button class="lk" data-ficha="${esc(n.placa_id)}">ver ${esc(n.placa_id)}</button>`:""}`}))]
    .sort((a,b)=>a.t-b.t);
  $("rs-unit").innerHTML = `<div class="row sp"><div><span class="big" style="font-size:30px">${esc(u.serie)}</span> ${estadoTag(u.estado)}</div><div class="muted">${esc(u.produto)} · ${esc(u.ordem_id)}${u.etapa?" · etapa "+u.etapa:""}</div></div>
    ${u.nc?`<p>NC ${u.nc.status==="Pendente"?"pendente (aguarda confirmação)":"aberta"}: <b>${esc(u.nc.id)}</b> (${esc(u.nc.posto)} · ${esc(u.nc.modo_falha)})${u.nc.placa_id?` · <button class="lk" data-ficha="${esc(u.nc.placa_id)}">abrir ficha ${esc(u.nc.placa_id)} na manutenção</button>`:""}</p>`:""}
    <ul class="tl" style="margin-top:8px">${itens.map(i=>`<li><span class="d">${new Date(i.t).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><span>${i.html}</span></li>`).join("") || `<li class="empty" style="display:block">Ainda não passou por nenhum posto.</li>`}</ul>`;
}

function rpNc(){
  const fs = ["Pendentes","Abertas","Todas"];
  $("nc-filt").innerHTML = fs.map(f=>`<button type="button" class="chip${UI.p.ncFilt===f?" on":""}" data-pncf="${f}">${f}</button>`).join("");
  let L = [...S.p.nc].sort((a,b)=>(b.criado_em||"").localeCompare(a.criado_em||""));
  if (UI.p.ncFilt==="Abertas") L = L.filter(n=>n.status==="Aberta" || n.status==="Pendente");
  if (UI.p.ncFilt==="Pendentes") L = L.filter(n=>n.status==="Pendente");
  $("nc-lista").innerHTML = L.length ? `<div class="tw"><table><thead><tr><th>NC</th><th>Data</th><th>Série</th><th>OP</th><th>Produto</th><th>Posto</th><th>Falha</th><th>Manutenção</th><th>Status</th><th></th></tr></thead><tbody>${
    L.map(n=>{ const u = S.p.d.U[n.unidade_id]; const pl = S.derived[n.placa_id];
      return `<tr><td class="id">${esc(n.id)}</td><td class="nw">${brs((n.criado_em||"").slice(0,10))}</td><td>${u?`<button class="lk" data-punit="${esc(u.id)}">${esc(u.serie)}</button>`:"-"}</td><td>${esc(n.ordem_id)}</td><td>${esc(n.produto)}</td><td>${esc(n.posto)}</td>
      <td>${esc(n.modo_falha)}${n.descricao?`<br><span class="muted">${esc(n.descricao)}</span>`:""}</td>
      <td>${n.placa_id?`<button class="lk" data-ficha="${esc(n.placa_id)}">${esc(n.placa_id)}</button> ${pl?st(pl.status):""}`:"-"}</td><td>${n.status==="Pendente"?`<span class="tag">PENDENTE</span><br><span class="muted">por ${esc(nomeDe(n.criado_por))}</span>`:esc(n.status)}</td>
      <td class="nw">${acoesNc(n, !!(pl&&pl.fase==="Encerrada"))}</td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty">Nenhuma não conformidade ${UI.p.ncFilt==="Abertas"?"aberta":UI.p.ncFilt==="Pendentes"?"pendente":"registrada"}.</div>`;
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

/* ---------------- OP: lotes SMD e OFs ligados ---------------- */
function ligados(o){
  const ls = S.p.lotes.filter(l=>l.ordem_id===o.id), ofs = S.p.ofs.filter(f=>f.ordem_id===o.id);
  const gere = temPapel("admin","responsavel");
  const it = [...ls.map(l=>`<button class="lk" data-celgo="SMD">${esc(l.id)}</button> <span class="muted">${esc(l.status)} · ${l.qtd_ok}/${l.quantidade}</span>`),
              ...ofs.map(f=>`<button class="lk" data-celgo="${esc(f.celula)}">${esc(f.id)}</button> <span class="muted">${esc(f.celula)} · ${esc(f.item)} · ${esc(f.status)} · ${f.qtd_feita}/${f.quantidade}</span>`)];
  const bt = !gere ? "" : [ (podeReg("SMD")||podeReg("MONT")) ? `<button class="lk" data-celgo="SMD|${esc(o.id)}">+ lote SMD</button>` : "",
    `<button class="lk" data-celgo="USI|${esc(o.id)}">+ OF usinagem</button>`, `<button class="lk" data-celgo="SER|${esc(o.id)}">+ OF serralheria</button>`].filter(Boolean).join(" ");
  if (!it.length && !bt) return "";
  return `<div style="margin-top:10px"><span class="muted">Células:</span> ${it.join(" · ") || `<span class="muted">nenhum lote SMD ou OF ligado</span>`}${bt?`<div class="row" style="margin-top:4px">${bt}</div>`:""}</div>`;
}

/* ---------------- CÉLULAS: SMD, usinagem, serralheria, integração, montagem ---------------- */
let ceSig = "";
function ceSelects(){
  const opsAb = Object.values(S.p.ordens).filter(o=>o.status==="Aberta"||o.status==="Em produção").sort((a,b)=>b.id.localeCompare(a.id));
  const refs = [...opsAb.map(o=>o.id), ...S.p.lotes.filter(l=>["Aberto","Em montagem"].includes(l.status)).map(l=>l.id), ...S.p.ofs.filter(f=>["Aberta","Em execução"].includes(f.status)).map(f=>f.id)];
  const sig = refs.join() + "|" + cfg().produtos.length;
  const pref = UI.p.prefOp; UI.p.prefOp = null;
  if (sig!==ceSig){
    ceSig = sig;
    const keep = (id, html) => { const el = $(id); const v = el.value; el.innerHTML = html; if (v) el.value = v; };
    const opHtml = `<option value="">sem OP</option>` + opsAb.map(o=>`<option value="${esc(o.id)}">${esc(o.id)} · ${esc(o.produto)}${o.cliente?" · "+esc(o.cliente):""}</option>`).join("");
    keep("ls-op", opHtml); keep("of-op", opHtml); keep("ls-produto", prodOpts(undefined, "escolha..."));
    $("dl-refs").innerHTML = refs.map(r=>`<option value="${esc(r)}"></option>`).join("");
  }
  if (!$("of-prio").options.length) $("of-prio").innerHTML = opts(PRIO, "Normal");
  if (!$("ap-ativ").options.length) $("ap-ativ").innerHTML = opts(ATIV_AP, "Produção");
  if (!$("ap-data").value) $("ap-data").value = today();
  if (pref){ const o = S.p.ordens[pref]; $("ls-op").value = pref; $("of-op").value = pref; $("ap-ref").value = pref;
    if (o){ $("ls-produto").value = o.produto; fillVersoes(o.produto); $("ls-qtd").value = o.quantidade; $("of-obs").value = `para ${o.produto}`; } }
}
function rpCelulas(){
  if (!UI.p.cel) UI.p.cel = CEL_PROD.includes(celulaHoje()) ? celulaHoje() : "SMD";
  const c = UI.p.cel, T = today(), gere = temPapel("admin","responsavel");
  $("ce-chips").innerHTML = CEL_PROD.map(x=>`<button type="button" class="chip${x===c?" on":""}" data-pcel="${x}">${x} · ${esc(celNome(x))}</button>`).join("");
  const pessoas = Object.values(PROFILES).filter(p=>p.ativo);
  const resp = pessoas.filter(p=>p.papel==="responsavel" && p.celula===c).map(p=>p.nome.split(" ")[0]);
  const esc_ = pessoas.filter(p=>escalaDe(p.id)===c).map(p=>p.nome.split(" ")[0]);
  $("ce-info").innerHTML = `Responsável: <b>${esc(resp.join(", ")||"-")}</b> · escalados hoje: <b>${esc(esc_.join(", ")||"ninguém")}</b> · ${podeReg(c)?'<span class="t-Aprovado">você registra nesta célula hoje</span>':'<span class="muted">só consulta</span>'}`;
  $("ce-smd-form-box").hidden = !(c==="SMD" && gere && (podeReg("SMD")||podeReg("MONT")));
  $("ce-of-form-box").hidden = !(["USI","SER"].includes(c) && gere);
  $("of-title").textContent = `Nova ordem de fabricação · ${celNome(c)}`;
  $("ce-ap-box").hidden = !podeReg(c);
  ceSelects();
  const edita = podeReg(c);
  if (c==="SMD"){
    $("ce-fila-t").textContent = "Lotes SMD";
    const L = S.p.lotes.filter(l=>l.status!=="Cancelado" && (l.status!=="Concluído" || (l.concluido_em||l.criado_em||"").slice(0,10)>=addDays(T,-30)))
      .sort((a,b)=>(a.status==="Concluído")-(b.status==="Concluído") || (a.previsto||"9").localeCompare(b.previsto||"9") || a.id.localeCompare(b.id));
    $("ce-fila").innerHTML = L.length ? `<div class="tw"><table><thead><tr><th>Lote</th><th>Produto</th><th>PCB</th><th>OP</th><th class="n">Qtd</th><th class="n">OK</th><th class="n">Refugo</th><th>Previsto</th><th>Status</th><th></th></tr></thead><tbody>${
      L.map(l=>{ const atr = l.previsto && l.previsto<T && !["Concluído","Cancelado"].includes(l.status);
        return `<tr><td class="id">${esc(l.id)}</td><td>${esc(l.produto)}</td><td>${esc(l.pcb)}</td><td>${l.ordem_id?`<button class="lk" data-pop="${esc(l.ordem_id)}">${esc(l.ordem_id)}</button>`:"-"}</td><td class="n">${l.quantidade}</td>
        ${edita ? `<td class="n"><input type="number" min="0" data-lsok="${esc(l.id)}" value="${l.qtd_ok}" style="width:7ch" aria-label="ok"></td><td class="n"><input type="number" min="0" data-lsref="${esc(l.id)}" value="${l.qtd_refugo}" style="width:7ch" aria-label="refugo"></td>`
                : `<td class="n">${l.qtd_ok}</td><td class="n${l.qtd_refugo?" alert":""}">${l.qtd_refugo||""}</td>`}
        <td class="${atr?"alert":""}">${brs(l.previsto)}${atr?" !!":""}</td>
        <td>${edita?`<select data-lsst="${esc(l.id)}" style="width:auto" aria-label="status">${opts(LSTAT, l.status)}</select>`:esc(l.status)}</td>
        <td>${edita?`<button class="lk" data-lssave="${esc(l.id)}">salvar</button>`:""}</td></tr>`; }).join("")}</tbody></table></div>`
      : `<div class="empty">Nenhum lote SMD aberto.</div>`;
  } else if (c==="USI" || c==="SER"){
    $("ce-fila-t").textContent = `Ordens de fabricação · ${celNome(c)}`;
    const L = S.p.ofs.filter(f=>f.celula===c && f.status!=="Cancelada" && (f.status!=="Concluída" || (f.concluido_em||f.criado_em||"").slice(0,10)>=addDays(T,-30)))
      .sort((a,b)=>(a.status==="Concluída")-(b.status==="Concluída") || prioN(a.prio)-prioN(b.prio) || (a.previsto||"9").localeCompare(b.previsto||"9"));
    $("ce-fila").innerHTML = L.length ? `<div class="tw"><table><thead><tr><th>OF</th><th>Item</th><th>OP</th><th class="n">Qtd</th><th class="n">Feita</th><th>Progresso</th><th>Previsto</th><th>Prio</th><th>Status</th><th></th></tr></thead><tbody>${
      L.map(f=>{ const atr = f.previsto && f.previsto<T && !["Concluída","Cancelada"].includes(f.status);
        return `<tr><td class="id">${esc(f.id)}</td><td>${esc(f.item)}${f.obs?`<br><span class="muted">${esc(f.obs)}</span>`:""}</td><td>${f.ordem_id?`<button class="lk" data-pop="${esc(f.ordem_id)}">${esc(f.ordem_id)}</button>`:"-"}</td><td class="n">${f.quantidade}</td>
        <td class="n">${edita?`<input type="number" min="0" data-offeita="${esc(f.id)}" value="${f.qtd_feita}" style="width:7ch" aria-label="feita">`:f.qtd_feita}</td><td>${bar(f.qtd_feita, f.quantidade, 10)}</td>
        <td class="${atr?"alert":""}">${brs(f.previsto)}${atr?" !!":""}</td><td class="p-${esc(f.prio)}">${esc(f.prio)}</td>
        <td>${edita?`<select data-ofst="${esc(f.id)}" style="width:auto" aria-label="status">${opts(OFSTAT, f.status)}</select>`:esc(f.status)}</td>
        <td>${edita?`<button class="lk" data-ofsave="${esc(f.id)}">salvar</button>`:""}</td></tr>`; }).join("")}</tbody></table></div>`
      : `<div class="empty">Nenhuma OF aberta em ${esc(celNome(c))}.</div>`;
  } else {
    $("ce-fila-t").textContent = `Fila nos postos · ${celNome(c)}`;
    const Us = Object.values(S.p.d.U).filter(ativo);
    const postos = c==="INT" ? ["P8"] : POSTOS_P.map(p=>p[0]);
    const linhas = postos.map(p=>{ const f = Us.filter(u=>u.etapa===p && naFila(u) && celulaDe(u.produto,p)===c); const m = Us.filter(u=>naManut(u) && u.nc && u.nc.posto===p && celulaDe(u.produto,p)===c);
      return {p, f:f.length, m:m.length, prod:[...new Set(f.map(u=>u.produto))]}; });
    const mx = Math.max(1, ...linhas.map(l=>l.f));
    $("ce-fila").innerHTML = `<div class="tw"><table><thead><tr><th>Posto</th><th>Fila</th><th class="n">Unidades</th><th class="n">NC/manut.</th><th>Produtos</th><th></th></tr></thead><tbody>${
      linhas.map(l=>`<tr><td class="id">${l.p} <span class="muted">${esc(PNOME[l.p])}</span></td><td>${bar(l.f,mx,12)}</td><td class="n"><b>${l.f}</b></td><td class="n${l.m?" alert":""}">${l.m||""}</td><td>${esc(l.prod.slice(0,4).join(", "))}${l.prod.length>4?"...":""}</td>
        <td><button class="lk" data-pgoposto="${l.p==="P8"?"P8|"+c:l.p}">abrir posto</button></td></tr>`).join("")}</tbody></table></div>
      <p class="hint">${c==="INT"?"Integração robusta no P8: FIR, DIR Nutri, DIR Dual Nutri, ECO PRO Nutri e Dual Nutri, quadros e hidráulica. O gestor ajusta por produto em EQUIPE.":"Montagem final, testes P1 a P7 e integração leve no P8."}</p>`;
  }
  // horas
  const A7 = S.p.apont.filter(a=>a.celula===c && a.data>=addDays(T,-6));
  const porAt = {}; A7.forEach(a=>porAt[a.atividade]=(porAt[a.atividade]||0)+a.horas);
  const porP = {}; A7.forEach(a=>porP[a.pessoa]=(porP[a.pessoa]||0)+a.horas);
  const tot = A7.reduce((x,a)=>x+a.horas,0), mh = Math.max(1,...Object.values(porAt));
  $("ce-horas").innerHTML = A7.length ? `<div class="tw"><table><tbody>${Object.entries(porAt).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${bar(v,mh,12)}</td><td class="n">${h(v)} h</td></tr>`).join("")}
      <tr><td><b>Total</b></td><td></td><td class="n"><b>${h(tot)} h</b></td></tr></tbody></table></div>
      <p class="hint">Por pessoa: ${Object.entries(porP).map(([u,v])=>`${esc(nomeDe(u)||"?")} ${h(v)} h`).join(" · ")}</p>`
    : `<div class="empty">Sem horas apontadas nesta célula nos últimos 7 dias.</div>`;
  const A30 = S.p.apont.filter(a=>a.celula===c && a.data>=addDays(T,-29)).sort((a,b)=>b.data.localeCompare(a.data) || (b.criado_em||"").localeCompare(a.criado_em||""));
  $("ce-apont").innerHTML = A30.length ? `<div class="tw"><table><thead><tr><th>Data</th><th>Pessoa</th><th>Atividade</th><th>Ref.</th><th class="n">Horas</th><th class="n">Qtd</th><th>Obs</th><th></th></tr></thead><tbody>${
    A30.slice(0,200).map(a=>`<tr><td class="nw">${brs(a.data)}</td><td>${esc(nomeDe(a.pessoa))}</td><td>${esc(a.atividade)}</td><td class="nw">${esc(a.ref)}</td><td class="n">${h(a.horas)}</td><td class="n">${a.qtd===""?"":esc(a.qtd)}</td><td>${esc(a.obs)}</td>
      <td>${isAdm()||(ME&&a.pessoa===ME.id)?`<button class="lk del" data-dap="${esc(a.id)}">apagar</button>`:""}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">Nenhum apontamento nos últimos 30 dias.</div>`;
}
async function salvarLote(id){
  const l = S.p.lotes.find(x=>x.id===id); if (!l) return;
  const q = k => document.querySelector(`[data-${k}="${id}"]`);
  const ok = Math.max(0, Math.round(+q("lsok").value||0)), ref = Math.max(0, Math.round(+q("lsref").value||0)); let status = q("lsst").value;
  if (ok+ref > l.quantidade){ toast(`OK + refugo (${ok+ref}) passa da quantidade do lote (${l.quantidade}).`, true); return; }
  if (status==="Aberto" && ok+ref>0) status = "Em montagem";
  const upd = {qtd_ok:ok, qtd_refugo:ref, status, concluido_em: status==="Concluído" ? (l.concluido_em||new Date().toISOString()) : null};
  await write(()=>sb.from("prod_lotes_smd").update(upd).eq("id", id), `${id} atualizado.`, ["prod_lotes_smd"]);
}
async function salvarOf(id){
  const f = S.p.ofs.find(x=>x.id===id); if (!f) return;
  const q = k => document.querySelector(`[data-${k}="${id}"]`);
  const feita = Math.max(0, Math.round(+q("offeita").value||0)); let status = q("ofst").value;
  if (status==="Aberta" && feita>0) status = "Em execução";
  if (feita>=f.quantidade && status==="Em execução") status = "Concluída";
  const upd = {qtd_feita:feita, status, concluido_em: status==="Concluída" ? (f.concluido_em||new Date().toISOString()) : null};
  await write(()=>sb.from("prod_of").update(upd).eq("id", id), `${id} atualizada${status==="Concluída"?" e concluída":""}.`, ["prod_of"]);
}

/* ---------------- EQUIPE: escala do dia, habilidades e integração do P8 ---------------- */
function rpEquipe(){
  const dia = $("eq-dia").value || ($("eq-dia").value = today());
  const adm = isAdm();
  $("eq-hint").textContent = adm ? "Auxiliar só registra na célula escolhida para o dia. Responsável registra na própria célula sem escala." : "Somente o gestor altera a escala e as habilidades.";
  const P = Object.values(PROFILES).filter(p=>p.ativo && ["admin","responsavel","auxiliar"].includes(p.papel))
    .sort((a,b)=>["auxiliar","responsavel","admin"].indexOf(a.papel)-["auxiliar","responsavel","admin"].indexOf(b.papel) || (a.nome||"").localeCompare(b.nome||""));
  const C = celulas();
  const registra = p => p.papel==="admin" ? "todas" : p.papel==="auxiliar" ? (escalaDe(p.id, dia)||"nenhuma (fora da escala)")
    : [...new Set([p.celula, ...C.map(c=>c[0]).filter(c=>nivelDe(p.id,c)>=2)].filter(Boolean))].join(", ");
  $("eq-escala").innerHTML = P.length ? `<div class="tw"><table><thead><tr><th>Pessoa</th><th>Papel</th><th>Cargo</th><th>Célula principal</th><th>Escala em ${brs(dia)}</th><th>Registra em</th></tr></thead><tbody>${
    P.map(p=>{ const e = escalaDe(p.id, dia);
      return `<tr><td>${esc(p.nome)}</td><td>${esc(papelNome(p.papel))}</td><td class="muted">${esc(p.cargo)}</td><td>${esc(p.celula||"-")}</td>
      <td>${adm?`<select data-escala="${esc(p.id)}" style="width:auto" aria-label="escala">${`<option value="">-</option>`+C.map(([c,n])=>`<option value="${c}"${c===e?" selected":""}>${c} · ${esc(n)}</option>`).join("")}</select>`:esc(e||"-")}</td>
      <td class="${p.papel==="auxiliar"&&!e?"alert":""}">${esc(registra(p))}</td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty">Nenhum responsável ou auxiliar ativo. Defina os papéis em [M] CONFIG > Usuários.</div>`;
  const cob = C.map(([c])=>P.filter(p=>p.celula===c || nivelDe(p.id,c)>=2).length);
  $("eq-hab").innerHTML = P.length ? `<div class="tw"><table><thead><tr><th>Pessoa</th>${C.map(([c,n])=>`<th class="n" title="${esc(n)}">${c}</th>`).join("")}</tr></thead><tbody>${
    P.map(p=>`<tr><td class="nw">${esc(p.nome)} <span class="muted">${esc(papelNome(p.papel))}</span></td>${C.map(([c])=>{ const n = nivelDe(p.id,c); const pr = p.celula===c;
      return `<td class="n"${pr?' style="background:var(--sel)"':""}>${adm?`<select data-hab="${esc(p.id)}|${c}" style="width:auto" aria-label="${c}">${[0,1,2,3,4].map(v=>`<option value="${v}"${v===n?" selected":""}>${v}</option>`).join("")}</select>`:`<b>${n||"·"}</b>`}${pr?" *":""}</td>`; }).join("")}</tr>`).join("")}
    <tr><td class="muted">cobertura (nível 2+)</td>${cob.map(n=>`<td class="n ${n<2?"alert":""}">${n}</td>`).join("")}</tr></tbody></table></div>
    <p class="hint">* célula principal. Cobertura abaixo de 2 em vermelho: só uma pessoa sabe fazer, e a célula para se ela faltar.</p>`
    : `<div class="empty">Sem pessoas para a matriz.</div>`;
  const prods = Object.keys(S.p.d.rot).filter(k=>S.p.d.rota[k].includes("P8")).sort((a,b)=>a.localeCompare(b));
  $("eq-p8").innerHTML = prods.length ? `<div class="tw" style="max-height:420px;overflow-y:auto"><table><thead><tr><th>Produto</th><th>Célula do P8</th><th>Padrão</th></tr></thead><tbody>${
    prods.map(pr=>{ const c = celulaDe(pr,"P8"); const d = celulaPadrao(pr,"P8");
      return `<tr><td>${esc(pr)}</td><td>${adm?`<select data-p8="${esc(pr)}" style="width:auto" aria-label="célula P8">${["MONT","INT"].map(x=>`<option${x===c?" selected":""}>${x}</option>`).join("")}</select>`:esc(c)}</td><td class="muted">${d}${c!==d?' <span class="tag">alterado</span>':""}</td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty">Nenhum roteiro com P8 carregado.</div>`;
}

/* ---------------- PAINEL DO HALL (TV): só números agregados, via painel_hall() ---------------- */
let hallT = null, hallD = null, hallAt = 0, hallErr = "";
function hall(on){
  if (!on){ if (hallT){ clearInterval(hallT); hallT = null; } return; }
  if (!hallT){ hallT = setInterval(carregarHall, 60000); carregarHall(); }
  rHall();
}
async function carregarHall(){
  if (!sb) return;
  let r; try { r = await sb.rpc("painel_hall"); } catch(e){ r = {error:e}; }
  if (r.error){ hallErr = errMsg(r.error); } else { hallD = r.data; hallAt = Date.now(); hallErr = ""; }
  rHall();
}
function rHall(){
  $("hl-data").textContent = new Date().toLocaleDateString("pt-BR", {weekday:"long", day:"2-digit", month:"long"});
  $("hl-upd").textContent = hallErr ? "!! "+hallErr : hallAt ? `atualizado às ${new Date(hallAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · a cada minuto` : "carregando...";
  const d = hallD; if (!d){ $("hl-kpis").innerHTML = `<div class="empty">carregando...</div>`; $("hl-dias").innerHTML = ""; $("hl-cel").innerHTML = ""; return; }
  const meta = +d.meta_dia||0, hoje = +d.concluidas_hoje||0;
  const k = [["Concluídas hoje", meta ? `${hoje}/${meta}` : hoje, meta && hoje>=meta ? "ok" : ""], ["Concluídas 7 dias", d.concluidas_semana],
    ["OPs em andamento", d.ops_andamento], ["OPs atrasadas", d.ops_atrasadas, +d.ops_atrasadas ? "hot" : ""],
    ["Primeira passagem 30 dias", d.fpy_30d==null ? "-" : d.fpy_30d+"%"], ["NC abertas", d.nc_abertas, +d.nc_abertas ? "hot" : ""], ["Placas na manutenção", d.placas_manutencao]];
  $("hl-kpis").innerHTML = k.map(([l,v,c])=>`<div class="kpi${c?" "+c:""}"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join("");
  const D = Array.isArray(d.concluidas_14d) ? d.concluidas_14d : []; const md = Math.max(1, meta, ...D.map(x=>+x.n));
  $("hl-dias").innerHTML = `<div class="tw"><table><tbody>${D.map(x=>`<tr><td class="nw">${brs(String(x.dia).slice(0,10))}</td><td>${bar(+x.n, md, 22)}</td><td class="n"><b>${x.n}</b>${meta?`<span class="muted">/${meta}</span>`:""}</td></tr>`).join("")}</tbody></table></div>`;
  $("hl-cel").innerHTML = `<div class="tw"><table><tbody>
    <tr><td>SMD · lotes em aberto</td><td class="n"><b>${esc(d.lotes_smd_abertos)}</b></td></tr>
    <tr><td>Usinagem · OFs em aberto</td><td class="n"><b>${esc(d.of_usinagem)}</b></td></tr>
    <tr><td>Serralheria · OFs em aberto</td><td class="n"><b>${esc(d.of_serralheria)}</b></td></tr>
    <tr><td>Horas apontadas hoje</td><td class="n"><b>${h(d.horas_hoje)}</b></td></tr></tbody></table></div>`;
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
  if (t.dataset.pconf) confirmarNc(t.dataset.pconf);
  if (t.dataset.pdesc) confirmDel(t, ()=>fecharNc(t.dataset.pdesc, "Descartada"));
  if (t.dataset.pcel){ UI.p.cel = t.dataset.pcel; render(); }
  if (t.dataset.celgo){ const [c, op] = t.dataset.celgo.split("|"); UI.p.cel = c; if (op) UI.p.prefOp = op; go("p-celulas"); }
  if (t.dataset.pgoposto){ $("ps-posto").value = t.dataset.pgoposto; localSet("posto", t.dataset.pgoposto); UI.p.ps = null; go("p-posto"); }
  if (t.dataset.lssave) salvarLote(t.dataset.lssave);
  if (t.dataset.ofsave) salvarOf(t.dataset.ofsave);
  if (t.dataset.dap) confirmDel(t, ()=>write(()=>sb.from("apontamentos").delete().eq("id", t.dataset.dap), "Apontamento apagado.", ["apontamentos"]));
  if (t.dataset.psuc) confirmDel(t, ()=>fecharNc(t.dataset.psuc, "Sucata"));
  if (t.dataset.tapl) confirmDel(t, ()=>aplicarMediana(t.dataset.tapl));
  if (t.id==="tp-exp") exportTempos();
});
document.addEventListener("change", e=>{
  const t = e.target;
  if (t.dataset.escala!==undefined && t.tagName==="SELECT"){ const dia = $("eq-dia").value || today(), pessoa = t.dataset.escala;
    if (!t.value) write(()=>sb.from("escala").delete().eq("data", dia).eq("pessoa", pessoa), "Escala atualizada.", ["escala"]);
    else write(()=>sb.from("escala").upsert({data:dia, pessoa, celula:t.value, definido_por:ME.id}, {onConflict:"data,pessoa"}), `${nomeDe(pessoa)} em ${t.value} no dia ${brs(dia)}.`, ["escala"]); }
  if (t.dataset.hab){ const [pessoa, celula] = t.dataset.hab.split("|");
    write(()=>sb.from("habilidades").upsert({pessoa, celula, nivel:+t.value}, {onConflict:"pessoa,celula"}), `Habilidade de ${nomeDe(pessoa)} em ${celula}: ${t.value}.`, ["habilidades"]); }
  if (t.dataset.p8) write(()=>sb.from("prod_roteiros").update({celula:t.value}).eq("produto", t.dataset.p8).eq("posto", "P8"), `P8 de ${t.dataset.p8} agora é ${t.value}.`, ["prod_roteiros"]);
  if (t.id==="eq-dia") render();
  if (t.id==="ls-produto"){ fillVersoes(t.value); }
  if (t.dataset.pchk && UI.p.ps){ const c = UI.p.ps.checks; const k = t.dataset.pchk; if (t.checked){ if (!c.includes(k)) c.push(k); } else UI.p.ps.checks = c.filter(x=>x!==k); updWorkButtons(); }
});
$("ps-posto").addEventListener("change", e=>{ localSet("posto", e.target.value); if (UI.p.ps && UI.p.ps.posto!==e.target.value.split("|")[0]) UI.p.ps = null; render(); });
$("op-busca").addEventListener("input", render);
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
  const r = await write(()=>sb.from("prod_ordens").insert({produto, quantidade:qtd, lote:nz($("op-lote").value.trim()), pedido:nz($("op-pedido").value.trim()), cliente:nz($("op-cliente").value.trim()), previsto:nz($("op-prev").value), prio:$("op-prio").value||"Normal", obs:nz($("op-obs").value.trim())}).select("id").single(), null, ["prod_ordens"]);
  if (!r) return;
  const lista = series.length ? series : Array.from({length:qtd}, (_,i)=>`${r.id}-${String(i+1).padStart(3,"0")}`);
  const ok = await write(()=>sb.from("prod_unidades").insert(lista.map(s=>({ordem_id:r.id, serie:s, produto}))), `${r.id} criada com ${lista.length} unidades.`, ["prod_unidades"]);
  if (ok){ e.target.reset(); $("op-qtd").value = 10; UI.p.op = r.id; go("p-op"); }
});
$("op-prio").innerHTML = opts(PRIO, "Normal");
$("f-lote").addEventListener("submit", async e=>{
  e.preventDefault(); const err = $("ls-err"); err.textContent = "";
  const produto = $("ls-produto").value, qtd = Math.round(+$("ls-qtd").value);
  if (!produto){ err.textContent = "!! escolha o produto"; return; }
  if (!(qtd>=1 && qtd<=5000)){ err.textContent = "!! quantidade entre 1 e 5000"; return; }
  const r = await write(()=>sb.from("prod_lotes_smd").insert({produto, quantidade:qtd, pcb:nz($("ls-pcb").value.trim()), ordem_id:nz($("ls-op").value), previsto:nz($("ls-prev").value), obs:nz($("ls-obs").value.trim())}).select("id").single(), null, ["prod_lotes_smd"]);
  if (r){ toast(`${r.id} aberto. Escreva o número do lote na caixa das placas.`); ["ls-pcb","ls-prev","ls-obs"].forEach(id=>$(id).value=""); }
});
$("f-of").addEventListener("submit", async e=>{
  e.preventDefault(); const err = $("of-err"); err.textContent = "";
  const item = $("of-item").value.trim(), qtd = Math.round(+$("of-qtd").value), celula = UI.p.cel;
  if (!["USI","SER"].includes(celula)){ err.textContent = "!! escolha Usinagem ou Serralheria"; return; }
  if (!item){ err.textContent = "!! descreva o item"; return; }
  if (!(qtd>=1 && qtd<=5000)){ err.textContent = "!! quantidade entre 1 e 5000"; return; }
  const r = await write(()=>sb.from("prod_of").insert({celula, item, quantidade:qtd, ordem_id:nz($("of-op").value), previsto:nz($("of-prev").value), prio:$("of-prio").value||"Normal", obs:nz($("of-obs").value.trim())}).select("id").single(), null, ["prod_of"]);
  if (r){ toast(`${r.id} aberta em ${celNome(celula)}.`); ["of-item","of-prev","of-obs"].forEach(id=>$(id).value=""); $("of-qtd").value = 1; }
});
$("f-apont").addEventListener("submit", async e=>{
  e.preventDefault(); const err = $("ap-err"); err.textContent = "";
  const horas = +$("ap-horas").value, data = $("ap-data").value, celula = UI.p.cel, atividade = $("ap-ativ").value;
  if (!data || data>today()){ err.textContent = "!! data inválida"; return; }
  if (!(horas>0 && horas<=12)){ err.textContent = "!! horas entre 0,25 e 12"; return; }
  const qtd = $("ap-qtd").value==="" ? null : Math.max(0, Math.round(+$("ap-qtd").value));
  const ok = await write(()=>sb.from("apontamentos").insert({data, pessoa:ME.id, celula, atividade, horas, qtd, ref:nz($("ap-ref").value.trim().toUpperCase()), obs:nz($("ap-obs").value.trim())}), `${h(horas)} h apontadas em ${celula}.`, ["apontamentos"]);
  if (ok){ ["ap-horas","ap-qtd","ap-obs"].forEach(id=>$(id).value=""); }
});

window.PROD = { views:VIEWS_PROD, tables:PROD_TABLES, load:prodLoad, derive:deriveProd, render:prodRender, hall };
