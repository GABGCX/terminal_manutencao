"use strict";
/* ---------------- listas ---------------- */
const STATUS = {
  "Aguardando início":      {fase:"Fila",        aberta:1, diag:0, res:"", imp:""},
  "Em diagnóstico":         {fase:"Diagnóstico", aberta:1, diag:0, res:"", imp:""},
  "Em reparo":              {fase:"Reparo",      aberta:1, diag:1, res:"", imp:""},
  "Em teste":               {fase:"Teste",       aberta:1, diag:1, res:"", imp:""},
  "Aguardando peça":        {fase:"Espera",      aberta:1, diag:1, res:"", imp:"Falta de peça/componente"},
  "Aguardando informação":  {fase:"Espera",      aberta:1, diag:0, res:"", imp:"Falta de esquemático/documentação"},
  "Aguardando outro setor": {fase:"Espera",      aberta:1, diag:0, res:"", imp:"Depende de outro setor"},
  "Pausada":                {fase:"Espera",      aberta:1, diag:0, res:"", imp:"Outra prioridade"},
  "Concluída: reparada":    {fase:"Encerrada",   aberta:0, diag:1, res:"Reparada", imp:""},
  "Concluída: sem defeito": {fase:"Encerrada",   aberta:0, diag:1, res:"Sem defeito constatado", imp:""},
  "Irrecuperável":          {fase:"Encerrada",   aberta:0, diag:1, res:"Irrecuperável", imp:""},
  "Devolvida sem reparo":   {fase:"Encerrada",   aberta:0, diag:0, res:"Devolvida sem reparo", imp:""},
};
const ATIV = {"Triagem/inspeção inicial":"Diagnóstico","Diagnóstico/investigação":"Diagnóstico","Pesquisa de documentação":"Diagnóstico",
  "Reparo/intervenção":"Reparo","Teste/validação":"Teste","Acompanhamento/espera":"Outros",
  "Organização do setor":"Estruturação","Documentação/POP":"Estruturação","Treinamento":"Estruturação"};
const GRUPOS = ["Diagnóstico","Reparo","Teste","Estruturação","Outros"];
const IMPED = ["Falta de peça/componente","Falta de esquemático/documentação","Falta de ferramenta/equipamento","Firmware/software",
  "Depende de outro setor","Aguardando decisão da gestão","Outra prioridade","Defeito não reproduzido","Outro"];
const ORIGEM = ["Linha de produção","Retorno de campo","Garantia","Estoque","Engenharia/P&D","Outro"];
const PRIO = ["Urgente","Alta","Normal","Baixa"];
const DEFEITO = ["Ponte de solda","Solda fria/trinca","Componente danificado","Componente faltando","Componente errado/invertido",
  "Curto-circuito","Trilha/ilha danificada","Oxidação/umidade","Dano físico","Conector/cabo","Firmware/configuração","Comunicação/rádio",
  "Calibração/leitura incorreta","Bateria/alimentação","Sem defeito constatado","Não identificado"];
const CAUSA = ["Montagem/solda","Componente (lote/fornecedor)","Uso em campo/instalação","Ambiente (umidade, surto)","Transporte/manuseio","Firmware","Projeto da placa","Não identificada"];
const TESTE = ["Aprovado","Reprovado","Parcial","Não se aplica"];
const DEST = ["Descoberta técnica","Candidato a POP","Ponto para a gestão","Dificuldade","Melhoria sugerida"];
const CTIPO = ["Defeito recorrente","Procedimento padronizável","Descoberta técnica","Falha de rastreabilidade","Necessidade de ferramenta",
  "Necessidade de componente/estoque","Dependência de outro setor","Oportunidade de melhoria"];
const CSTAT = ["Registrado","Em análise","Aprovado","Virou POP","Implementado","Descartado"];
const MSTAT = ["Solicitado","Aprovado","Comprado","Recebido","Cancelado"];
const MPEND = new Set(["Solicitado","Aprovado","Comprado"]);
const URG = ["Urgente","Alta","Normal","Baixa"];
/* catálogo oficial 3V3 Produtos 2026.1: produto ; linha ; subgrupo ; PCB ; firmware ; fabricante */
const CAT_TXT = `ECO PRO 30 ; Linha ECO ; ECO ; ECO v2.1 ; D015 ; 3V3
ECO PRO 30N ; Linha ECO ; ECO ; ECO v2.1 ; D015 ; 3V3
ECO PRO Nutri ; Linha ECO ; ECO ; ECO v2.1 ; D015 ; 3V3
ECO PRO Dual Nutri ; Linha ECO ; ECO ; ECO v2.1 ; D015 ; 3V3
CIR ; Linha PRO ; CIR ; CIR V6.1 ; CIR-V5.1 ; 3V3
DIR Solar ; Linha PRO ; DIR ; DIR V5.1 ; D011 ; 3V3
DIR Energy T-Plus ; Linha PRO ; DIR ; DIR V5.1 ; D011 ; 3V3
DIR Energy Plus ; Linha PRO ; DIR ; DIR ENERGY V2.0 ; D011 ; 3V3
DIR PRO ; Linha PRO ; DIR ; ECO v2.1 ; D011 ; 3V3
DIR Nutri ; Linha PRO ; DIR ; ECO v2.1 ; D014 ; 3V3
DIR Dual Nutri ; Linha PRO ; DIR ; ECO v2.1 ; D015 ; 3V3
iD-4T2P ; Linha PRO ; DIR Expert (placas de expansão) ; iD-4T2P V2.1 ; D011 ; 3V3
iD-4R2P ; Linha PRO ; DIR Expert (placas de expansão) ; iD-4R2P V1.1 ;  ; 3V3
iD-6AS1i ; Linha PRO ; DIR Expert (placas de expansão) ; iD-6AS1i V3.4 ;  ; 3V3
REP ; Linha PRO ; REP ; DIR V5.1 ; D011 ; 3V3
DSR Solar ; Linha PRO ; DSR ; DIR V5.1 ; D011 ; 3V3
DSR Energy ; Linha PRO ; DSR ; DIR V5.1 ; D011 ; 3V3
DSR Energy Plus ; Linha PRO ; DSR ; DIR V5.1 ; D011 ; 3V3
FIR ; Linha PRO ; FIR ; FIR V4.1 ; F016 ; 3V3
Válvula motorizada 1" (cabo 3m) ; Linha PRO ; FIR (adicionais) ;  ;  ; 3V3
Válvula motorizada 1" (cabo 10m) ; Linha PRO ; FIR (adicionais) ;  ;  ; 3V3
Canais de entrada para nutrição ; Linha PRO ; FIR (adicionais) ;  ;  ; 3V3
Bomba WDM VHSE 2 6-15 ; Linha PRO ; FIR (adicionais) ;  ;  ; WDM
Bomba SCHNEIDER BT4-0505E7 ; Linha PRO ; FIR (adicionais) ;  ;  ; Schneider
Bomba SCHNEIDER BT4-2015E7 ; Linha PRO ; FIR (adicionais) ;  ;  ; Schneider
Cavalete FIR ; Linha PRO ; FIR (adicionais) ;  ;  ; 3V3
EMR ; Linha PRO ; EMR ; EMR V2.3 ; E002 ; 3V3
RIF ; Linha PRO ; RIF ; RIF V3.0 ; RIF_V302 ; 3V3
iE-PIVÔ ; Linha PRO ; Pivô ; PIR_NEO V2.0 ;  ; 3V3
iD-485 ; Acessórios para controladores ; Placa de expansões ;  ;  ; 3V3
ESP WIFI ; Acessórios para controladores ; Placa de expansões ;  ; 1.0 ; 3V3
CCPS Solar ; Acessórios para controladores ; Controlador de Carga ; CCPS V3.1 ; CCPS_V5 ; 3V3
CCPS Energy ; Acessórios para controladores ; Controlador de Carga ; CCPS V3.1 ; CCPS_V5 ; 3V3
Fonte 14.1VDC ; Acessórios para controladores ; Fontes ;  ;  ; Ralltek
Fonte 24VAC ; Acessórios para controladores ; Fontes ;  ;  ; SYLC
Painel Solar de 10W ; Acessórios para controladores ; Painel Solar ;  ;  ; 3V3
Painel Solar de 20W com cabo de 5m ; Acessórios para controladores ; Painel Solar ;  ;  ; 3V3
Painel Solar de 20W com cabo de 8m ; Acessórios para controladores ; Painel Solar ;  ;  ; 3V3
Antena 3v3 INOX - Omni-Direcional ; Acessórios para controladores ; Antenas ;  ;  ; 3V3
Antena DIR - Omni-Direcional ; Acessórios para controladores ; Antenas ;  ;  ; ARS
Antena CIR Omni-Direcional Alto Ganho ; Acessórios para controladores ; Antenas ;  ;  ; ARS
Cabo 2m ; Acessórios para controladores ; Cabo de antena ;  ;  ; 3V3
Cabo 5m ; Acessórios para controladores ; Cabo de antena ;  ;  ; 3V3
Cabo 10m ; Acessórios para controladores ; Cabo de antena ;  ;  ; 3V3
Cabo 15m ; Acessórios para controladores ; Cabo de antena ;  ;  ; 3V3
Cabo 20m ; Acessórios para controladores ; Cabo de antena ;  ;  ; 3V3
3F12V ; Atuadores ; Solenoides 3V3 ; CRV3F12 V1.0 ;  ; 3V3
2F12V ; Atuadores ; Solenoides 3V3 ; CRV2F12 V3.0 ;  ; 3V3
2F24V ; Atuadores ; Solenoides 3V3 ;  ;  ; 3V3
Suporte para 1 Solenoide ; Atuadores ; Solenoides 3V3 / Suporte ;  ;  ; 3V3
Suporte para 2 Solenoide ; Atuadores ; Solenoides 3V3 / Suporte ;  ;  ; 3V3
Suporte para 4 Solenoides ; Atuadores ; Solenoides 3V3 / Suporte ;  ;  ; 3V3
Baccara 1/8" N.O. 3 VIAS NPT 1.2MM 24VAC - / 24VAC - G75-A-1114121. ; Atuadores ; Solenoides Revenda ;  ;  ; Baccara
Bermad S985, 1/8" ; Atuadores ; Solenoides Revenda ;  ;  ; Bermad
Válvula de 1.1/2" BSP ; Atuadores ; Válvula de Irrigação Hidráulica ;  ;  ; Baccara
Válvula de 1" BSP ; Atuadores ; Válvula de Irrigação Hidráulica ;  ;  ; Baccara
Válvula de 2" BSP ; Atuadores ; Válvula de Irrigação Hidráulica ;  ;  ; Baccara
Válvula de 2.1/2" BSP ; Atuadores ; Válvula de Irrigação Hidráulica ;  ;  ; Baccara
Válvula de 3" BSP ; Atuadores ; Válvula de Irrigação Hidráulica ;  ;  ; Baccara
Válvula de 4" BSP ; Atuadores ; Válvula de Irrigação Hidráulica ;  ;  ; Baccara
Válvula borboleta CSR de 4" 220VAC ; Atuadores ; Válvula Borboleta ;  ;  ; CSR
Piloto redutor/sustentador de pressão Bermad ; Atuadores ; Piloto ;  ;  ; Bermad
Relé Hidraulico Galit ; Atuadores ; Relé Hidráulico ;  ;  ; Bermad
Relé de interface 220Vac PRZ ; Atuadores ; Relé de Interface ;  ;  ; Metaltex
Relé de interface 24Vdc PRZ ; Atuadores ; Relé de Interface ;  ;  ; Metaltex
Relé de interface 12Vdc PRZ ; Atuadores ; Relé de Interface ;  ;  ; Metaltex
Relé de interface 5Vdc PRZ ; Atuadores ; Relé de Interface ;  ;  ; Metaltex
Hidrômetro unijato DN20 ; Hidrometria ; Fertímetro ;  ;  ; Hidrohider
Hidrômetro Mecânico 1" - Tangencial c/ Cabo de Dados ; Hidrometria ; Hidrômetros ;  ;  ; Hidrometer
Hidrômetro Mecânico 2" - Tangencial c/ Cabo de Dados ; Hidrometria ; Hidrômetros ;  ;  ; Hidrometer
Hidrômetro Mecânico 3" - Tangencial c/ Cabo de Dados ; Hidrometria ; Hidrômetros ;  ;  ; Hidrometer
Hidrômetro Mecânico 4" - Tangencial c/ Cabo de Dados ; Hidrometria ; Hidrômetros ;  ;  ; Hidrometer
Hidrômetro Mecânico 5" - Tangencial c/ Cabo de Dados ; Hidrometria ; Hidrômetros ;  ;  ; Hidrometer
Hidrômetro Mecânico 6" - Tangencial c/ Cabo de Dados ; Hidrometria ; Hidrômetros ;  ;  ; Hidrometer
Hidrômetro Mecânico 8" - Tangencial c/ Cabo de Dados ; Hidrometria ; Hidrômetros ;  ;  ; Hidrometer
Hidrômetro Eletromagnetico 400mm - 16" ; Hidrometria ; Hidrômetros ;  ;  ; Hidrometer
Hidrômetro Eletromagnetico 500mm - 20" ; Hidrometria ; Hidrômetros ;  ;  ; Hidrometer
Quadro para inversor 5cv-30cv ; Quadros ; Inversores ;  ;  ; 3V3
Quadro para inversor 40cv-75cv ; Quadros ; Inversores ;  ;  ; 3V3
Quadro para 4 Solenoides Internos ; Quadros ; Solenoides ;  ;  ; 3V3
Quadro para 20 Solenoides Internos ; Quadros ; Solenoides ;  ;  ; 3V3
Quadro para multimedidor ; Quadros ; Multimedidores ;  ;  ; 3V3
STU-ST ; Sensores ; Umidade do Solo ; STU-S V3.1 ; STU-S_V320 ; 3V3
Teros 10 ; Sensores ; Umidade do Solo ;  ;  ; Meter
Teros 12 ; Sensores ; Umidade do Solo ;  ;  ; Meter
STU-AI ; Sensores ; Umidade do Ar ;  ;  ; 3V3
STU-AS ; Sensores ; Umidade do Ar ; STU-A V2 ;  ; 3V3
Solar Shield ; Sensores ; Umidade do Ar ;  ;  ; 3V3
SMF ; Sensores ; Molhamento Foliar ; SMF V3 ; SMF_V309 ; 3V3
STD-M ; Sensores ; Tensiometria ; STD-M V2 ; STD-M_V203 ; 3V3
SCE-A ; Sensores ; Condutividade da água e nível ; SCE V2.1 ; SCE_VXX2 ; 3V3
SCE-R ; Sensores ; Condutividade da água e nível ; SCE V2.1 ; SCE_VXX2 ; 3V3
SPD-AP ; Sensores ; Pressão ; SPD V2.1 ; SPD_V201 ; 3V3
SPD-BP ; Sensores ; Pressão ; SPD V2.1 ; SPD_V201 ; 3V3
Sensor de Pressão para Adutora 0-100MCA 4a20mA ; Sensores ; Pressão ;  ;  ; 3V3
Sensor de Pressão para Adutora 0-160MCA 4a20mA ; Sensores ; Pressão ;  ;  ; 3V3
SNU ; Sensores ; Nível de fluidos ; SPD V2.1 ; SNU_V201 ; 3V3
Sonda de Nivel Hidrostatico PR17 BR 0 à 100 mca, 4 à 20 mA ; Sensores ; Nível de fluidos ;  ;  ; Keller
Sonda de Nivel Hidrostatico Ø17MM-10-42 MGG-TNH-MICRO 0 à 100 mca, 4 à 20 mA ; Sensores ; Nível de fluidos ;  ;  ; Megga Instrumentos
Sonda de Nivel Hidrostatico 0 à 2 mca, 4 à 20 mA (Keller) ; Sensores ; Nível de fluidos ;  ;  ; Keller
Sonda de Nivel Hidrostatico 0 à 2 mca, 4 à 20 mA (Megga Instrumentos) ; Sensores ; Nível de fluidos ;  ;  ; Megga Instrumentos
Sonda de Nivel Hidrostatico 0 à 10 mca, 4 à 20 mA (Keller) ; Sensores ; Nível de fluidos ;  ;  ; Keller
Sonda de Nivel Hidrostatico 0 à 10 mca, 4 à 20 mA (Megga Instrumentos) ; Sensores ; Nível de fluidos ;  ;  ; Megga Instrumentos
SPG ; Sensores ; Posicionamento Geográfico ; SPD V2.1 ; SPG_V201 ; 3V3
Pluviometro Cálice - SKU 6464 ; Sensores ; Meteorologia ;  ;  ; Davis
Anemômetro - SKU 6410 ; Sensores ; Meteorologia ;  ;  ; Davis
Sensor de Radiação Solar - SKU 6450 ; Sensores ; Meteorologia ;  ;  ; Davis
Chave de Fluxo 1" a 6" ; Sensores ; Vazão ;  ;  ; Open Soluções
Microtubos 8mm para comandos hidraulicos ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Conexão de comando hidraulico - Joelho 8mm X 1/8 ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Conexão de comando hidraulico - Joelho 8mm X 1/4 ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Conexão de comando hidraulico - T 8mm X 8mm X 8mm ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Conexão de comando hidraulico - T 1/8mm X 8mmX 8mm ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Conexão de comando hidraulico - T 1/4mm X 8mmX 8mm ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Conexão de comando hidraulico - União 8mm X 8mm ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Bucha de Redução de 1/2 R. INT.1/4 ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Bucha de Redução de R.1/4 R. INT.1/8 ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Conexão de comando hidraulico - Cotovelo 8mm X 8mm ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Conexão de comando hidraulico - Cotovelo 8mm X 1/8" ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Conexão de comando hidraulico - Conector Reto 8mm X 1/8" ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Joelho Rosca Int. 1" ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Adaptador Rosca Ext 1" ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
Adaptador Rosca Ext 3/4 ; Hidráulica ; Microtubos e conexões ;  ;  ; RSB
IF20-202-1 - INVERSOR DE FREQUENCIA VETORIAL IF20 - 2HP - 220V MONOFASICO ; Alta potência ; Inversores ;  ;  ; Metaltex
IF20-403-3 - INVERSOR FREQUÊNCIA IF20 - 3HP - 380V TRIF. ; Alta potência ; Inversores ;  ;  ; Metaltex
IF20 - 405 - 3 - INVERSOR DE FREQUENCIA VETORIAL IF20 - 5HP- 380V TRIFASICO ; Alta potência ; Inversores ;  ;  ; Metaltex
IF20-410-3 - INVERSOR FREQUENCIA IF20-10HP-380V TRIF. ; Alta potência ; Inversores ;  ;  ; Metaltex
IF20-410-3 - INVERSOR FREQUENCIA IF20-15HP-380V TRIF. ; Alta potência ; Inversores ;  ;  ; Metaltex
IF20 - 420-3A - INVERSOR FREQUENCIA VETORIAL IF20 - 20HP - 380V TRIFASICO ; Alta potência ; Inversores ;  ;  ; Metaltex
IF20-430-3 - INVERSOR FREQUENCIA IF20 - 30HP - 380V TRIF. ; Alta potência ; Inversores ;  ;  ; Metaltex
IF30-530-3 INVERSOR DE FREQ. VETORIAL AVANÇADO IF30 - 30HP 380-480V TRIFÁSICO -C/ FILTRO EMC ; Alta potência ; Inversores ;  ;  ; Metaltex
IF20-440-3 INVERSOR DE FREQUENCIA 40cv 380v If20-440-3 - METALTEX 380v ; Alta potência ; Inversores ;  ;  ; Metaltex
IF20- 550-3 INVERSOR DE FREQUENCIA VETORIAL 50HP 380V A 460V TRIFÁSICO ; Alta potência ; Inversores ;  ;  ; Metaltex
IF30-550-3 - INVERSOR DE FREQ. VETORIAL AVANÇADO IF30 - 50HP 380-480V TRIFÁSICO ; Alta potência ; Inversores ;  ;  ; Metaltex
Inversor De Frequência Weg Cfw500 50cv 145a 220v Trifásico 220v ; Alta potência ; Inversores ;  ;  ; WEG
INVERSOR DE FREQUENCIA VETORIAL 75HP - 380V TRIFÁSICO - IF20-475-3 ; Alta potência ; Inversores ;  ;  ; Metaltex
INVERSOR DE FREQUENCIA VETORIAL 200HP 380/480V - TRIFÁSICO ; Alta potência ; Inversores ;  ;  ; Metaltex
TECLADO FRONTAL PARA INVERSOR DE FREQUENCIA IF20-KEP ; Alta potência ; Acessórios de inversor ;  ;  ; 
Multimedidor Digital PL-M2 Alimentação 85…265Vca/cc Saida RS485, T. Max. 500v (Porta De Painel) > POLUS ; Alta potência ; Multimedidor ;  ;  ; Polus
MULTIMEDIDOR PM5110 MODBUS RS485 ; Alta potência ; Multimedidor ;  ;  ; Schneider Electric
Multimedidor MMW03-CH ; Alta potência ; Multimedidor ;  ;  ; WEG
Multimedidor MMW03-M22CH ; Alta potência ; Multimedidor ;  ;  ; WEG
Cabo PP 2x0.75mm ; Outros ; Cabos ;  ;  ; Contactsul
Cabo PP 3x0.5mm ; Outros ; Cabos ;  ;  ; Contactsul
Cabo PP 4x0,5mm ; Outros ; Cabos ;  ;  ; Contactsul
Cabo PP 5x0,5mm ; Outros ; Cabos ;  ;  ; Contactsul
CABO MANGA 3 X 20AWG 300V 70Â°C SB - PT ; Outros ; Cabos ;  ;  ; Sparflex
CABO MANGA 2 X 20AWG 300V 70Â°C SB - PT ; Outros ; Cabos ;  ;  ; Sparflex
CABO FLAT NU 10X26AWG/10X0.13MM2 300V 70C - GE ; Outros ; Cabos ;  ;  ; Cabolider
Cabo Coaxial DLC58 (CI de Cobre, Tranca ; Outros ; Cabos ;  ;  ; Datalink
CABO AF-BF C/ TUBO PVC 250V SN 1PX22AWG/030MM2 300V 70C - PT ; Outros ; Cabos ;  ;  ; Cabolider
CABO 2 X 22AWG BF+T 300V 70Â°C - PT ; Outros ; Cabos ;  ;  ; Sparflex
Outro ; Outros ; Outro ;  ;  ; `;
const lista = s => (s||"").split(",").map(v=>v.trim()).filter(Boolean);
function parseCat(txt){ return String(txt||"").split(/\r?\n/).map(l=>l.split(";").map(x=>x.trim())).filter(p=>p[0])
  .map(([nome,linha,tipo,vers,fw,fab])=>({nome, linha:linha||"Outros", tipo:tipo||"", versoes:lista(vers), firmware:lista(fw), fabricante:fab||""})); }
const catTxt = cat => cat.map(c=>[c.nome,c.linha,c.tipo,(c.versoes||[]).join(", "),(c.firmware||[]).join(", "),c.fabricante||""].join(" ; ")).join("\n");
const CAT_PADRAO = parseCat(CAT_TXT);
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const VIEWS = [["painel","PAINEL"],["placas","PLACAS"],["diario","DIÁRIO"],["materiais","MATERIAIS"],["conhecimento","CONHECIMENTO"],["relatorio","RELATÓRIO"],["evolucao","EVOLUÇÃO"],["config","CONFIG"]];

/* ---------------- utilidades ---------------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => isoOf(new Date());
const toUTC = s => { const [y,m,d] = s.split("-").map(Number); return Date.UTC(y,m-1,d); };
const diff = (a,b) => Math.round((toUTC(b)-toUTC(a))/864e5);
const addDays = (s,n) => { const [y,m,d] = s.split("-").map(Number); return isoOf(new Date(y,m-1,d+n)); };
const br = s => s ? `${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}` : "";
const brs = s => s ? `${s.slice(8,10)}/${s.slice(5,7)}` : "";
const h = n => (Math.round((+n||0)*100)/100).toLocaleString("pt-BR",{maximumFractionDigits:2});
const pct = n => isFinite(n) ? Math.round(n*100)+"%" : "-";
const opts = (arr, sel, blank) => (blank!==undefined ? `<option value="">${esc(blank)}</option>` : "") + arr.map(v => `<option${v===sel?" selected":""}>${esc(v)}</option>`).join("");
const bar = (v, max, w=16) => { const n = max>0 ? Math.round(v/max*w) : 0; return `<span class="bar">${"█".repeat(n)}<span class="z">${"░".repeat(w-n)}</span></span>`; };
const tbar = (v, max, w=16) => { const n = max>0 ? Math.round(v/max*w) : 0; return "█".repeat(n)+"░".repeat(w-n); };
const st = s => { const f = STATUS[s]?.fase || "Fila"; return `<span class="st f-${esc(f)}">${esc((s||"-").toUpperCase())}</span>`; };
let toastT;
function toast(msg, bad){ const t=$("toast"); t.textContent=msg; t.className=bad?"bad":""; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true, bad?6000:3200); }

/* quinzenas */
function qzOf(s){ const y=+s.slice(0,4), m=+s.slice(5,7), d=+s.slice(8,10); const q = d<=15?1:2;
  const last = new Date(y,m,0).getDate();
  return {key:`${y}-${pad(m)}-${q}`, label:`${MESES[m-1]}/${y} - ${q}ª quinzena`, ini:`${y}-${pad(m)}-${q===1?"01":"16"}`, fim:`${y}-${pad(m)}-${q===1?"15":pad(last)}`}; }
const qzPrev = q => qzOf(addDays(q.ini,-1));
const qzNext = q => qzOf(addDays(q.fim,1));
function qzList(){ let first = "2026-10-01";
  for (const p of Object.values(S.placas)) if (p.entrada && p.entrada<first) first=p.entrada;
  for (const d of S.diario) if (d.data && d.data<first) first=d.data;
  const out=[]; let q=qzOf(first); const cur=qzOf(today()).key;
  for (let i=0;i<200;i++){ out.push(q); if (q.key===cur) break; q=qzNext(q); }
  return out.reverse(); }

/* ---------------- estado ---------------- */
const S = { placas:{}, diario:[], materiais:[], conhecimento:[], config:{}, relat:{}, ready:{}, derived:{} };
const UI = { view:"painel", ficha:null, plFilt:"Abertas", diFilt:"7 dias", maFilt:"Pendentes", coFilt:"Todos", editDi:null, fichaDirty:false, relDirty:false, ro:false };
let sb=null, ME=null; const PROFILES={};
const isAdm = () => !!ME && ME.papel==="admin";
const canDel = autor => isAdm() || (!!ME && ME.papel==="tecnico" && !!autor && autor===ME.id);

function cfg(){
  let cat = Array.isArray(S.config.catalogo) && S.config.catalogo.length ? S.config.catalogo : CAT_PADRAO;
  if (!S.config.catalogo && Array.isArray(S.config.produtos)) for (const p of S.config.produtos) if (!cat.some(c=>c.nome===p)) cat = [...cat, {nome:p, linha:"Outros", tipo:"", versoes:[]}];
  return { tecnico: S.config.tecnico || "", alerta: +S.config.alerta || 3, catalogo: cat, produtos: cat.map(c=>c.nome) };
}
const catInfo = nome => cfg().catalogo.find(c=>c.nome===nome) || {nome, linha:"Outros", tipo:"", versoes:[], firmware:[], fabricante:""};
function prodOpts(sel, blank){
  const cat = cfg().catalogo; const linhas = [...new Set(cat.map(c=>c.linha))];
  let html = blank!==undefined ? `<option value="">${esc(blank)}</option>` : "";
  for (const l of linhas) html += `<optgroup label="${esc(l)}">` + cat.filter(c=>c.linha===l).map(c=>`<option${c.nome===sel?" selected":""}>${esc(c.nome)}</option>`).join("") + `</optgroup>`;
  if (sel && !cat.some(c=>c.nome===sel)) html += `<option selected>${esc(sel)}</option>`;
  return html;
}
function fillVersoes(nome){ const c = catInfo(nome);
  $("dl-versoes").innerHTML = [...(c.versoes||[]), "não identificada"].map(x=>`<option value="${esc(x)}"></option>`).join("");
  $("dl-firmware").innerHTML = [...(c.firmware||[]), "não identificado"].map(x=>`<option value="${esc(x)}"></option>`).join(""); }
const pv = x => esc(x.produto) + ((x.versao||x.firmware) ? ` <span class="muted">${esc([x.versao, x.firmware].filter(Boolean).join(" · "))}</span>` : "");

/* ---------------- derivação (mesma lógica da planilha) ---------------- */
function derive(){
  const by = {};
  for (const d of S.diario){ if (!d.placa || d.placa==="GERAL") continue; (by[d.placa] ||= []).push(d); }
  for (const k in by) by[k].sort((a,b)=> (a.data||"").localeCompare(b.data||"") || (a.ts||0)-(b.ts||0));
  const T = today(), out = {};
  for (const p of Object.values(S.placas)){
    const e = by[p.id] || [];
    let last=null; for (let i=e.length-1;i>=0;i--) if (e[i].status){ last=e[i]; break; }
    const status = last ? last.status : "Aguardando início";
    const S_ = STATUS[status] || STATUS["Em diagnóstico"];
    const inicio = e.length ? e[0].data : "", ultimo = e.length ? e[e.length-1].data : "";
    const diagE = e.find(x => STATUS[x.status]?.diag);
    const encerradaEm = S_.fase==="Encerrada" ? ultimo : "";
    const g = {}; for (const x of e){ const gr = ATIV[x.atividade]||"Outros"; g[gr]=(g[gr]||0)+(+x.horas||0); }
    const horas = e.reduce((a,x)=>a+(+x.horas||0),0);
    const dias = p.entrada ? diff(p.entrada, encerradaEm || T) : 0;
    const semReg = S_.aberta ? diff(ultimo || p.entrada || T, T) : null;
    const imp = S_.aberta ? ((last && last.impedimento) || S_.imp || "") : "";
    let alerta = "";
    if (S_.aberta && semReg >= cfg().alerta) alerta = `sem registro há ${semReg}d`;
    else if (S_.fase==="Fila") alerta = "aguardando início";
    const ci = catInfo(p.produto);
    out[p.id] = { ...p, linha: p.linha || ci.linha, tipo: p.tipo || ci.tipo, status, fase:S_.fase, aberta:!!S_.aberta, imp, inicio, ultimo, diagEm: diagE ? diagE.data : "",
      encerradaEm, resultado: encerradaEm ? S_.res : "", dias, semReg, horas, hDiag:g["Diagnóstico"]||0, hRep:(g["Reparo"]||0)+(g["Teste"]||0),
      nreg:e.length, alerta, hist:e, prioN: Math.max(0, PRIO.indexOf(p.prio||"Normal")) };
  }
  S.derived = out;
}
const D = () => Object.values(S.derived);
const abertas = () => D().filter(x=>x.aberta).sort((a,b)=> a.prioN-b.prioN || (a.entrada||"").localeCompare(b.entrada||"") || a.id.localeCompare(b.id));

/* ---------------- métricas do relatório ---------------- */
function metrics(ini, fim){
  const inP = s => !!s && s>=ini && s<=fim;
  const dE = S.diario.filter(d=>inP(d.data));
  const horas = dE.reduce((a,d)=>a+(+d.horas||0),0);
  const hg = {}; GRUPOS.forEach(g=>hg[g]=0); dE.forEach(d=>{ const g=ATIV[d.atividade]||"Outros"; hg[g]+= +d.horas||0; });
  const enc = D().filter(x=>inP(x.encerradaEm));
  const by = r => enc.filter(x=>x.resultado===r).length;
  const rep = by("Reparada"), irr = by("Irrecuperável");
  const imp = {}; IMPED.forEach(i=>imp[i]=dE.filter(d=>d.impedimento===i).length);
  const con = {}; CTIPO.forEach(t=>con[t]=S.conhecimento.filter(c=>c.tipo===t && inP(c.data)).length);
  const def = {}; DEFEITO.forEach(c=>def[c]=D().filter(x=>x.defeito===c && inP(x.diagEm)).length);
  return {
    recebidas: D().filter(x=>inP(x.entrada)).length,
    trabalhadas: new Set(dE.filter(d=>d.placa && d.placa!=="GERAL").map(d=>d.placa)).size,
    registros: dE.length, horas, hg, pDiag: horas ? hg["Diagnóstico"]/horas : 0,
    diag: D().filter(x=>inP(x.diagEm)).length,
    rep, sem: by("Sem defeito constatado"), irr, dev: by("Devolvida sem reparo"),
    taxa: (rep+irr) ? rep/(rep+irr) : NaN,
    diasMed: enc.length ? enc.reduce((a,x)=>a+x.dias,0)/enc.length : 0,
    horasMed: enc.length ? enc.reduce((a,x)=>a+x.horas,0)/enc.length : 0,
    pedidos: S.materiais.filter(m=>inP(m.data)).length,
    recebidosMat: S.materiais.filter(m=>inP(m.recebido)).length,
    imp, con, def, dest: dE.filter(d=>d.destaque).sort((a,b)=>(a.data||"").localeCompare(b.data||"")),
  };
}

/* ---------------- render ---------------- */
let rq = 0;
function render(){ if (rq) return; rq = requestAnimationFrame(()=>{ rq=0; try{ derive(); renderAll(); }catch(e){ console.error(e); } }); }
function renderAll(){
  $("hdr-tec").textContent = cfg().tecnico || "(definir em CONFIG)";
  fillDatalist();
  const v = UI.view;
  if (v==="painel") rPainel();
  else if (v==="placas") rPlacas();
  else if (v==="ficha") rFicha();
  else if (v==="diario") rDiario();
  else if (v==="materiais") rMat();
  else if (v==="conhecimento") rCon();
  else if (v==="relatorio") rRel();
  else if (v==="evolucao") rEvo();
  else if (v==="config") rCfg();
  resolveAuthors();
}
function loading(){ return !S.ready.placas || !S.ready.diario; }

function rPainel(){
  if (loading()){ $("p-kpis").innerHTML = `<div class="empty">carregando dados...</div>`; return; }
  const A = abertas(), T = today(), mes = T.slice(0,8)+"01";
  const sem = addDays(T, -((new Date().getDay()+6)%7));
  const k = [
    ["Em aberto", A.length],
    ["Fila + diagnóstico", A.filter(x=>x.fase==="Fila"||x.fase==="Diagnóstico").length],
    ["Reparo / teste", A.filter(x=>x.fase==="Reparo"||x.fase==="Teste").length],
    ["Em espera", A.filter(x=>x.fase==="Espera").length],
    [`Sem registro ${cfg().alerta}+ dias`, A.filter(x=>x.semReg>=cfg().alerta).length, "hot"],
    ["Encerradas no mês", D().filter(x=>x.encerradaEm && x.encerradaEm>=mes).length],
    ["Horas na semana", h(S.diario.filter(d=>d.data>=sem && d.data<=T).reduce((a,d)=>a+(+d.horas||0),0))],
    ["Horas no mês", h(S.diario.filter(d=>d.data>=mes && d.data<=T).reduce((a,d)=>a+(+d.horas||0),0))],
  ];
  $("p-kpis").innerHTML = k.map(([l,v,c]) => `<div class="kpi${c&&+v>0?" "+c:""}"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join("");
  if (!Object.keys(S.placas).length){
    $("p-fila").innerHTML = `<div class="empty">Nenhuma placa cadastrada. Cadastre a primeira em [2] PLACAS ou carregue os exemplos em [8] CONFIG.</div>`;
  } else if (!A.length){
    $("p-fila").innerHTML = `<div class="empty">Nenhuma placa aberta. Bancada limpa.</div>`;
  } else {
    $("p-fila").innerHTML = `<div class="tw"><table><thead><tr><th>ID</th><th>Produto</th><th>Prio</th><th>Status</th><th>Impedimento</th><th class="n">Dias</th><th class="n">S/reg</th><th class="n">Horas</th><th>Defeito relatado</th><th></th></tr></thead><tbody>${
      A.map(x=>`<tr class="click" data-ficha="${esc(x.id)}"><td class="id">${esc(x.id)}</td><td class="nw">${pv(x)}</td><td class="p-${esc(x.prio||"Normal")}">${esc(x.prio||"Normal")}</td><td>${st(x.status)}</td><td>${esc(x.imp)}</td><td class="n">${x.dias}</td><td class="n">${x.semReg}</td><td class="n">${h(x.horas)}</td><td>${esc(x.relatado)}</td><td class="alert">${x.alerta&&x.alerta.startsWith("sem")?"!! "+esc(x.alerta):""}</td></tr>`).join("")}</tbody></table></div>`;
  }
  const ult = [...S.diario].sort((a,b)=>(b.data||"").localeCompare(a.data||"")||(b.ts||0)-(a.ts||0)).slice(0,6);
  $("p-ultimos").innerHTML = ult.length ? `<ul class="tl">${ult.map(d=>`<li><span class="d">${brs(d.data)}</span><span><span class="h"><b>${esc(d.placa)}</b> · ${esc(d.atividade)} · ${h(d.horas)}h ${d.status?"→ "+st(d.status):""}</span><br><span class="x">${esc(d.feito)}</span></span></li>`).join("")}</ul>` : `<div class="empty">Nenhum registro ainda.</div>`;
  const mp = S.materiais.filter(m=>MPEND.has(m.status||"Solicitado")).sort((a,b)=>(a.data||"").localeCompare(b.data||""));
  $("p-mat").innerHTML = mp.length ? `<div class="tw"><table><thead><tr><th>Item</th><th>Placa</th><th>Status</th><th class="n">Dias</th></tr></thead><tbody>${mp.map(m=>{const dd=m.data?diff(m.data,T):0;return `<tr><td>${esc(m.item)}</td><td class="nw">${esc(m.placa||"-")}</td><td>${esc(m.status||"Solicitado")}</td><td class="n${dd>=7?" alert":""}">${dd}</td></tr>`}).join("")}</tbody></table></div>` : `<div class="empty">Nada pendente.</div>`;
}

function nextId(){ let mx=0; for (const id in S.placas){ const m=/^MP-(\d+)$/.exec(id); if (m) mx=Math.max(mx,+m[1]); } return "MP-"+String(mx+1).padStart(4,"0"); }

function rPlacas(){
  $("pl-next").textContent = "o ID (MP-xxxx) é gerado ao cadastrar";
  const fs = ["Abertas","Encerradas","Todas"];
  $("pl-filt").innerHTML = fs.map(f=>`<button type="button" class="chip${UI.plFilt===f?" on":""}" data-plf="${f}">${f}</button>`).join("");
  if (loading()){ $("pl-lista").innerHTML = `<div class="empty">carregando...</div>`; return; }
  const q = $("pl-busca").value.trim().toLowerCase();
  const lsel = $("pl-linha"); const lv = lsel.value; const linhas = [...new Set([...cfg().catalogo.map(c=>c.linha), ...D().map(x=>x.linha)])];
  lsel.innerHTML = `<option value="">todas as linhas</option>` + linhas.map(l=>`<option${l===lv?" selected":""}>${esc(l)}</option>`).join("");
  let L = UI.plFilt==="Abertas" ? abertas() : D().sort((a,b)=>b.id.localeCompare(a.id));
  if (UI.plFilt==="Encerradas") L = L.filter(x=>!x.aberta);
  if (lv) L = L.filter(x=>x.linha===lv);
  if (q) L = L.filter(x=>[x.id,x.produto,x.versao,x.firmware,x.linha,x.relatado,x.origem,x.ref,x.serie,x.status,x.defeito].join(" ").toLowerCase().includes(q));
  $("pl-lista").innerHTML = L.length ? `<div class="tw"><table><thead><tr><th>ID</th><th>Entrada</th><th>Produto</th><th>Origem</th><th>Defeito relatado</th><th>Status</th><th class="n">Dias</th><th class="n">Horas</th><th>Constatado</th><th></th></tr></thead><tbody>${
    L.map(x=>`<tr class="click" data-ficha="${esc(x.id)}"><td class="id">${esc(x.id)}</td><td class="nw">${brs(x.entrada)}</td><td class="nw">${pv(x)}<br><span class="muted">${esc(x.linha)}</span></td><td>${esc(x.origem)}</td><td>${esc(x.relatado)}</td><td>${st(x.status)}</td><td class="n">${x.dias}</td><td class="n">${h(x.horas)}</td><td>${esc(x.defeito||"")}</td><td class="alert">${x.alerta.startsWith("sem")?"!! "+esc(x.alerta):""}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">${Object.keys(S.placas).length?"Nada encontrado com esse filtro.":"Nenhuma placa ainda. Use o formulário acima."}</div>`;
}

function rFicha(){
  const x = S.derived[UI.ficha];
  if (!x){ $("fi-id").textContent = UI.ficha || "-"; $("fi-kv").innerHTML = `<div class="empty">${loading()?"carregando...":"Placa não encontrada (pode ter sido excluída)."}</div>`; $("fi-tl").innerHTML=""; $("fi-st").innerHTML=""; return; }
  $("fi-id").textContent = x.id; $("fi-st").innerHTML = st(x.status) + (x.alerta.startsWith("sem")?` <span class="alert">!! ${esc(x.alerta)}</span>`:"");
  const kv = [["Produto",x.produto],["Placa (PCB)",x.versao||"não informada"],["Firmware",x.firmware||"não informado"],["Fabricante",catInfo(x.produto).fabricante||"-"],["Linha · tipo",[x.linha,x.tipo].filter(Boolean).join(" · ")],["Origem",x.origem],["Ref. origem",x.ref],["Nº série",x.serie],["Entrada",br(x.entrada)],["Prioridade",x.prio||"Normal"],
    ["Defeito relatado",x.relatado],["Impedimento atual",x.imp||"-"],["Dias",x.dias],["Horas totais",h(x.horas)+" h"],["Horas diagnóstico",h(x.hDiag)+" h"],["Horas reparo + teste",h(x.hRep)+" h"],
    ["Diagnóstico concluído",br(x.diagEm)||"-"],["Encerrada em",br(x.encerradaEm)||"-"],["Resultado",x.resultado||"-"],["Defeito constatado",x.defeito||"-"],["Causa provável",x.causa||"-"],["Componentes",x.componentes||"-"]];
  $("fi-kv").innerHTML = kv.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v||"-")}</dd></div>`).join("");
  $("fi-hcount").textContent = `${x.nreg} registro(s)`;
  $("fi-tl").innerHTML = x.hist.length ? x.hist.map(d=>`<li><span class="d">${br(d.data)}</span><span><span class="h">${esc(d.atividade)} · ${h(d.horas)}h ${d.status?"→ "+st(d.status):""} ${d.teste&&d.teste!=="Não se aplica"?`<span class="t-${esc(d.teste)}">[${esc(d.teste.toUpperCase())}]</span>`:""}</span><br>${esc(d.feito)}
    ${[d.componente&&"componente: "+d.componente, d.impedimento&&"impedimento: "+d.impedimento, d.material&&"material: "+d.material].filter(Boolean).map(t=>`<br><span class="x">${esc(t)}</span>`).join("")}
    ${d.destaque?`<br><span class="tag">★ ${esc(d.destaque)}</span> <span class="x">${esc(d.obs||"")}</span>`:(d.obs?`<br><span class="x">obs: ${esc(d.obs)}</span>`:"")}</span></li>`).join("")
    : `<li class="empty" style="display:block">Nenhuma sessão registrada. Use [+ Registrar sessão].</li>`;
  const ms = S.materiais.filter(m=>m.placa===x.id);
  $("fi-mat").innerHTML = ms.length ? `<div class="tw"><table><thead><tr><th>Pedido</th><th>Item</th><th>Status</th><th>Recebido</th></tr></thead><tbody>${ms.map(m=>`<tr><td class="nw">${brs(m.data)}</td><td>${esc(m.item)}</td><td>${esc(m.status||"Solicitado")}</td><td>${brs(m.recebido)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Nenhum pedido ligado a esta placa.</div>`;
  if (!UI.fichaDirty) fillFichaForm(x);
}
function fillFichaForm(x){
  $("fi-defeito").innerHTML = opts(DEFEITO, x.defeito, "(ainda não)");
  $("fi-causa").innerHTML = opts(CAUSA, x.causa, "(ainda não)");
  $("fi-comp").value = x.componentes||""; $("fi-destino").value = x.destino||"";
  $("fi-entrada").value = x.entrada||""; $("fi-produto").innerHTML = prodOpts(x.produto); $("fi-versao").value = x.versao||""; $("fi-firmware").value = x.firmware||""; fillVersoes(x.produto);
  $("fi-origem").innerHTML = opts(ORIGEM, x.origem); $("fi-prio").innerHTML = opts(PRIO, x.prio||"Normal");
  $("fi-relatado").value = x.relatado||""; $("fi-serie").value = x.serie||""; $("fi-ref").value = x.ref||"";
  $("fi-del").hidden = x.nreg>0 || !isAdm();
}
const withVal = (arr,v) => v && !arr.includes(v) ? [...arr, v] : arr;

function rDiario(){
  const fs = ["Hoje","7 dias","Quinzena","Tudo"];
  $("di-filt").innerHTML = fs.map(f=>`<button type="button" class="chip${UI.diFilt===f?" on":""}" data-dif="${f}">${f}</button>`).join("");
  updStNow();
  if (!S.ready.diario){ $("di-lista").innerHTML = `<div class="empty">carregando...</div>`; return; }
  const T = today(); const q = $("di-busca").value.trim().toLowerCase();
  let ini = "0000"; if (UI.diFilt==="Hoje") ini=T; else if (UI.diFilt==="7 dias") ini=addDays(T,-6); else if (UI.diFilt==="Quinzena") ini=qzOf(T).ini;
  let L = S.diario.filter(d=>(d.data||"")>=ini);
  if (q) L = L.filter(d=>[d.placa,d.atividade,d.feito,d.status,d.componente,d.obs,d.destaque].join(" ").toLowerCase().includes(q));
  L.sort((a,b)=>(b.data||"").localeCompare(a.data||"")||(b.ts||0)-(a.ts||0));
  const tot = L.reduce((a,d)=>a+(+d.horas||0),0);
  const shown = L.slice(0,300);
  $("di-lista").innerHTML = L.length ? `<div class="muted" style="margin-bottom:6px">${L.length} registro(s) · ${h(tot)} h${L.length>300?" · mostrando os 300 mais recentes":""}</div><div class="tw"><table><thead><tr><th>Data</th><th>Placa</th><th>Atividade</th><th class="n">h</th><th>O que foi feito</th><th>Status após</th><th>Extra</th><th>Por</th><th></th></tr></thead><tbody>${
    shown.map(d=>`<tr><td class="nw">${brs(d.data)}</td><td class="id">${d.placa==="GERAL"?esc(d.placa):`<button class="lk" data-ficha="${esc(d.placa)}">${esc(d.placa)}</button>`}</td><td>${esc(d.atividade)}</td><td class="n">${h(d.horas)}</td><td>${esc(d.feito)}${d.obs?`<br><span class="muted">${esc(d.obs)}</span>`:""}</td><td>${d.status?st(d.status):""}</td><td>${[d.teste&&d.teste!=="Não se aplica"?`<span class="t-${esc(d.teste)}">${esc(d.teste)}</span>`:"", d.impedimento?`<span class="tag">${esc(d.impedimento)}</span>`:"", d.destaque?`<span class="tag">★ ${esc(d.destaque)}</span>`:""].filter(Boolean).join("<br>")}</td><td class="muted nw" data-uid="${esc(d.autor||"")}"></td><td class="nw w-only">${canDel(d.autor)?`<button class="lk" data-edi="${esc(d._id)}">editar</button> <button class="lk del" data-ddi="${esc(d._id)}">apagar</button>`:""}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">${S.diario.length?"Nenhum registro nesse período.":"Nenhum registro ainda. O primeiro vai no formulário acima."}</div>`;
}
function updStNow(){
  const id = $("di-placa").value.trim().toUpperCase(); const x = S.derived[id];
  const geral = id==="GERAL";
  $("di-st-req").hidden = geral;
  $("di-st-now").innerHTML = geral ? "GERAL: atividade sem placa, status não se aplica." : x ? `agora: ${st(x.status)} · ${pv(x)} · ${esc(x.relatado)}` : (id ? `<span class="alert">${esc(id)} não está cadastrada</span>` : "");
}

function rMat(){
  const fs = ["Pendentes","Recebidos","Todos"];
  $("ma-filt").innerHTML = fs.map(f=>`<button type="button" class="chip${UI.maFilt===f?" on":""}" data-maf="${f}">${f}</button>`).join("");
  if (!S.ready.materiais){ $("ma-lista").innerHTML = `<div class="empty">carregando...</div>`; return; }
  const T = today();
  let L = [...S.materiais].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  if (UI.maFilt==="Pendentes") L = L.filter(m=>MPEND.has(m.status||"Solicitado"));
  if (UI.maFilt==="Recebidos") L = L.filter(m=>m.status==="Recebido");
  $("ma-lista").innerHTML = L.length ? `<div class="tw"><table><thead><tr><th>Pedido</th><th>Item</th><th>Especificação</th><th class="n">Qtd</th><th>Placa</th><th>Urgência</th><th>Status</th><th class="n">Dias</th><th>Obs</th><th></th></tr></thead><tbody>${
    L.map(m=>{ const pend = MPEND.has(m.status||"Solicitado"); const dd = m.recebido ? diff(m.data,m.recebido) : (pend && m.data ? diff(m.data,T) : "");
      return `<tr><td class="nw">${brs(m.data)}</td><td>${esc(m.item)}</td><td>${esc(m.spec)}</td><td class="n">${esc(m.qtd||"")}</td><td class="nw">${esc(m.placa||"-")}</td><td class="p-${esc(m.urg||"Normal")}">${esc(m.urg||"Normal")}</td>
      <td>${UI.ro?esc(m.status||"Solicitado"):`<select data-mst="${esc(m._id)}" aria-label="status">${opts(MSTAT, m.status||"Solicitado")}</select>`}</td><td class="n${pend&&dd>=7?" alert":""}">${dd}</td><td>${esc(m.obs)}</td><td class="w-only">${canDel(m.criado_por)?`<button class="lk del" data-dma="${esc(m._id)}">apagar</button>`:""}</td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty">Nenhum pedido ${UI.maFilt==="Todos"?"registrado":UI.maFilt.toLowerCase()}.</div>`;
}

function rCon(){
  const fs = ["Todos","Abertos","Viraram POP"];
  $("co-filt").innerHTML = fs.map(f=>`<button type="button" class="chip${UI.coFilt===f?" on":""}" data-cof="${f}">${f}</button>`).join("");
  if (!S.ready.conhecimento){ $("co-lista").innerHTML = `<div class="empty">carregando...</div>`; return; }
  let L = [...S.conhecimento].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  if (UI.coFilt==="Abertos") L = L.filter(c=>!["Virou POP","Implementado","Descartado"].includes(c.status));
  if (UI.coFilt==="Viraram POP") L = L.filter(c=>["Virou POP","Implementado"].includes(c.status));
  $("co-lista").innerHTML = L.length ? `<ul class="tl">${L.map(c=>`<li><span class="d">${br(c.data)}</span><span><span class="tag">[${esc((c.tipo||"").toUpperCase())}]</span> <b>${esc(c.titulo)}</b><br>${esc(c.desc)}
    ${c.acao?`<br><span class="x">ação: ${esc(c.acao)}${c.resp?" · resp.: "+esc(c.resp):""}</span>`:""}${c.placas?`<br><span class="x">placas: ${esc(c.placas)}${c.produto?" · "+esc(c.produto):""}</span>`:""}
    <div class="row" style="margin-top:4px">${UI.ro?`<span class="muted">${esc(c.status||"Registrado")}</span>`:`<select data-cst="${esc(c._id)}" aria-label="status" style="width:auto">${opts(CSTAT,c.status||"Registrado")}</select>${canDel(c.criado_por)?`<button class="lk del w-only" data-dco="${esc(c._id)}">apagar</button>`:""}`}</div></span></li>`).join("")}</ul>`
    : `<div class="empty">Nada aqui ainda. Defeito que se repete, procedimento que pode virar POP, falta de documentação: registre acima.</div>`;
}

/* relatório */
function rRel(){
  const sel = $("re-q"); const list = qzList(); const cur = sel.value || qzOf(today()).key;
  sel.innerHTML = list.map(q=>`<option value="${q.key}"${q.key===cur?" selected":""}>${esc(q.label)}</option>`).join("");
  const q = list.find(z=>z.key===sel.value) || list[0]; const p = qzPrev(q);
  $("re-per").innerHTML = `período ${br(q.ini)} a ${br(q.fim)} · comparado com ${br(p.ini)} a ${br(p.fim)} · técnico: ${esc(cfg().tecnico||"-")}`;
  if (loading()){ $("re-body").innerHTML = `<div class="box"><h2>Relatório</h2><div class="empty">carregando...</div></div>`; return; }
  const a = metrics(q.ini,q.fim), b = metrics(p.ini,p.fim);
  const dv = (x,y,fmt) => { const d = x-y; if (!isFinite(d)||!d) return `<span class="muted">=</span>`; return `<span class="${d>0?"up":"down"}">${d>0?"+":""}${fmt(d)}</span>`; };
  const row = (l,x,y,fmt=v=>v) => `<tr><td>${esc(l)}</td><td class="n">${fmt(y)}</td><td class="n"><b>${fmt(x)}</b></td><td class="n">${dv(x,y,fmt)}</td></tr>`;
  const cmp = (title, rows) => `<div class="box"><h2>${esc(title)}</h2><div class="tw"><table class="cmp"><thead><tr><th></th><th class="n">Anterior</th><th class="n">Atual</th><th class="n">Var.</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  const A = abertas(), fases = ["Fila","Diagnóstico","Reparo","Teste","Espera"];
  const impA = {}; A.forEach(x=>{ const k = x.imp || "Sem impedimento (em trabalho)"; impA[k]=(impA[k]||0)+1; });
  const defAc = {}; DEFEITO.forEach(c=>defAc[c]=D().filter(x=>x.defeito===c).length);
  const maxDef = Math.max(1,...Object.values(defAc));
  const matP = S.materiais.filter(m=>MPEND.has(m.status||"Solicitado"));
  let html = `<div class="grid2">` + cmp("1. Volume de trabalho",
      row("Placas recebidas",a.recebidas,b.recebidas) + row("Placas trabalhadas",a.trabalhadas,b.trabalhadas) + row("Registros no diário",a.registros,b.registros) +
      row("Horas registradas",a.horas,b.horas,h) + GRUPOS.map(g=>row("   em "+g.toLowerCase(),a.hg[g],b.hg[g],h)).join("") +
      row("% do tempo em diagnóstico",a.pDiag,b.pDiag,pct))
    + cmp("2. Resultados",
      row("Diagnósticos concluídos",a.diag,b.diag) + row("Reparadas",a.rep,b.rep) + row("Sem defeito constatado",a.sem,b.sem) + row("Irrecuperáveis",a.irr,b.irr) +
      row("Devolvidas sem reparo",a.dev,b.dev) + row("Taxa de reparo",a.taxa,b.taxa,pct) + row("Dias médios até encerrar",a.diasMed,b.diasMed,v=>h(v)) + row("Horas médias por placa encerrada",a.horasMed,b.horasMed,h))
    + `</div><div class="grid2">`
    + `<div class="box"><h2>3. Situação hoje</h2><div class="tw"><table><tbody>${fases.map(f=>{const n=A.filter(x=>x.fase===f).length;return `<tr><td>${st(Object.keys(STATUS).find(s=>STATUS[s].fase===f))} ${f}</td><td>${bar(n,Math.max(1,A.length),12)}</td><td class="n">${n}</td></tr>`}).join("")}<tr><td><b>Total em aberto</b></td><td></td><td class="n"><b>${A.length}</b></td></tr></tbody></table></div>
      <h3 class="muted" style="font-size:11px;letter-spacing:.06em;margin:14px 0 4px">PENDÊNCIAS POR MOTIVO</h3>
      <div class="tw"><table><tbody>${Object.entries(impA).sort((x,y)=>y[1]-x[1]).map(([k,n])=>`<tr><td>${esc(k)}</td><td class="n">${n}</td></tr>`).join("") || `<tr><td class="muted">nenhuma placa aberta</td></tr>`}</tbody></table></div></div>`
    + `<div class="box"><h2>4. Placas pendentes</h2>${A.length?`<div class="tw"><table><thead><tr><th>Placa</th><th>Status</th><th class="n">Dias</th><th>Motivo</th></tr></thead><tbody>${A.map(x=>`<tr class="click" data-ficha="${esc(x.id)}"><td class="id">${esc(x.id)} <span class="muted">${esc(x.produto)}</span></td><td>${st(x.status)}</td><td class="n">${x.dias}</td><td>${esc(x.imp||"-")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">nenhuma</div>`}</div>`
    + `</div><div class="grid2">`
    + `<div class="box"><h2>5. Principais defeitos <small>quinzena · acumulado</small></h2><div class="tw"><table><tbody>${DEFEITO.filter(c=>defAc[c]).sort((x,y)=>defAc[y]-defAc[x]).map(c=>`<tr><td>${esc(c)}</td><td class="n">${a.def[c]}</td><td>${bar(defAc[c],maxDef,12)}</td><td class="n">${defAc[c]}</td></tr>`).join("") || `<tr><td class="muted">nenhum diagnóstico com defeito constatado ainda</td></tr>`}</tbody></table></div></div>`
    + cmp("6. Materiais", row("Pedidos feitos",a.pedidos,b.pedidos) + row("Pedidos recebidos",a.recebidosMat,b.recebidosMat) + `<tr><td>Pendentes hoje</td><td></td><td class="n"><b>${matP.length}</b></td><td></td></tr>` +
      matP.map(m=>`<tr><td colspan="4" class="muted">· ${esc(m.item)} (${esc(m.placa||"-")}, ${m.data?diff(m.data,today()):0} dias, ${esc(m.status||"Solicitado")})</td></tr>`).join(""))
    + `</div>`
    + porProduto(q)
    + cmp("7. Dificuldades: impedimentos registrados no diário", IMPED.filter(i=>a.imp[i]||b.imp[i]).map(i=>row(i,a.imp[i],b.imp[i])).join("") || `<tr><td class="muted" colspan="4">nenhum impedimento registrado nas duas quinzenas</td></tr>`)
    + `<div class="box"><h2>8. Destaques do diário na quinzena</h2>${a.dest.length?`<ul class="tl">${a.dest.map(d=>`<li><span class="d">${br(d.data)}</span><span><span class="tag">★ ${esc(d.destaque)}</span> <b>${esc(d.placa)}</b> · ${esc(d.feito)}${d.obs?`<br><span class="x">${esc(d.obs)}</span>`:""}</span></li>`).join("")}</ul>`:`<div class="empty">Nenhum destaque marcado nesta quinzena.</div>`}</div>`
    + cmp("9. Conhecimento gerado", CTIPO.filter(t=>a.con[t]||b.con[t]).map(t=>row(t,a.con[t],b.con[t])).join("") + `<tr><td>Viraram POP ou implementados (acumulado)</td><td></td><td class="n"><b>${S.conhecimento.filter(c=>["Virou POP","Implementado"].includes(c.status)).length}</b></td><td></td></tr>`);
  $("re-body").innerHTML = html;
  const r = S.relat[q.key] || {};
  if (!UI.relDirty || UI.relKey!==q.key){ $("re-com").value = r.comentario||""; $("re-dec").value = r.decisoes||""; UI.relDirty=false; UI.relKey=q.key; }
  $("re-txt").textContent = relText(q,p,a,b);
}
function prodRows(q){
  const inP = s => !!s && s>=q.ini && s<=q.fim; const m = {};
  for (const x of D()){ const k = x.produto || "-"; const r = m[k] ||= {produto:k, linha:x.linha, rec:0, enc:0, rep:0, irr:0, ab:0, tot:0, def:{}};
    r.tot++; if (inP(x.entrada)) r.rec++; if (inP(x.encerradaEm)){ r.enc++; if (x.resultado==="Reparada") r.rep++; if (x.resultado==="Irrecuperável") r.irr++; }
    if (x.aberta) r.ab++; if (x.defeito) r.def[x.defeito]=(r.def[x.defeito]||0)+1; }
  return Object.values(m).map(r=>({...r, top: Object.entries(r.def).sort((a,b)=>b[1]-a[1])[0]})).sort((a,b)=>(a.linha||"").localeCompare(b.linha||"") || b.tot-a.tot);
}
function porProduto(q){
  const R = prodRows(q); if (!R.length) return "";
  return `<div class="box"><h2>Por produto <small>quinzena · hoje · acumulado</small></h2><div class="tw"><table><thead><tr><th>Linha</th><th>Produto</th><th class="n">Receb.</th><th class="n">Encerr.</th><th class="n">Repar.</th><th class="n">Irrec.</th><th class="n">Abertas hoje</th><th class="n">Total</th><th>Defeito mais comum</th></tr></thead><tbody>${
    R.map(r=>`<tr><td class="muted">${esc(r.linha)}</td><td><b>${esc(r.produto)}</b></td><td class="n">${r.rec}</td><td class="n">${r.enc}</td><td class="n">${r.rep}</td><td class="n">${r.irr}</td><td class="n">${r.ab}</td><td class="n">${r.tot}</td><td>${r.top?esc(r.top[0])+` <span class="muted">(${r.top[1]})</span>`:""}</td></tr>`).join("")}</tbody></table></div></div>`;
}
function relText(q,p,a,b){
  const W=44, L=[], ln=(t="")=>L.push(t), rule=c=>ln(c.repeat(72));
  const r=(l,x,y,f=v=>String(v))=>ln(("  "+l).padEnd(W)+f(y).padStart(9)+f(x).padStart(9));
  rule("="); ln(`RELATÓRIO QUINZENAL · MANUTENÇÃO DE PLACAS · 3V3 TECNOLOGIA`); ln(`${q.label}  (${br(q.ini)} a ${br(q.fim)})`); ln(`Técnico: ${cfg().tecnico||"-"}   Gerado em ${br(today())}`); rule("=");
  ln(); ln("1. VOLUME".padEnd(W)+"anterior".padStart(9)+"atual".padStart(9)); rule("-");
  r("Placas recebidas",a.recebidas,b.recebidas); r("Placas trabalhadas",a.trabalhadas,b.trabalhadas); r("Registros no diário",a.registros,b.registros);
  r("Horas registradas",a.horas,b.horas,h); GRUPOS.forEach(g=>r("  em "+g.toLowerCase(),a.hg[g],b.hg[g],h)); r("% do tempo em diagnóstico",a.pDiag,b.pDiag,pct);
  ln(); ln("2. RESULTADOS"); rule("-");
  r("Diagnósticos concluídos",a.diag,b.diag); r("Reparadas",a.rep,b.rep); r("Sem defeito constatado",a.sem,b.sem); r("Irrecuperáveis",a.irr,b.irr);
  r("Devolvidas sem reparo",a.dev,b.dev); r("Taxa de reparo",a.taxa,b.taxa,pct); r("Dias médios até encerrar",a.diasMed,b.diasMed,h);
  const A = abertas();
  ln(); ln(`3. PENDÊNCIAS HOJE (${A.length} em aberto)`); rule("-");
  A.forEach(x=>ln(`  ${x.id.padEnd(8)} ${String(x.produto||"").padEnd(10)} ${x.status.padEnd(23)} ${String(x.dias).padStart(3)}d  ${x.imp||""}`));
  if (!A.length) ln("  nenhuma");
  const defAc = {}; DEFEITO.forEach(c=>defAc[c]=D().filter(x=>x.defeito===c).length); const mx=Math.max(1,...Object.values(defAc));
  ln(); ln("4. PRINCIPAIS DEFEITOS (acumulado)"); rule("-");
  DEFEITO.filter(c=>defAc[c]).sort((x,y)=>defAc[y]-defAc[x]).forEach(c=>ln(`  ${c.padEnd(28)} ${tbar(defAc[c],mx,14)} ${defAc[c]}`));
  ln(); ln("4b. POR PRODUTO".padEnd(30)+"receb".padStart(6)+"encer".padStart(6)+"abert".padStart(6)+"total".padStart(6)); rule("-");
  prodRows(q).forEach(r=>ln(`  ${(r.produto+"").slice(0,26).padEnd(28)}${String(r.rec).padStart(6)}${String(r.enc).padStart(6)}${String(r.ab).padStart(6)}${String(r.tot).padStart(6)}${r.top?"  "+r.top[0]:""}`));
  const matP = S.materiais.filter(m=>MPEND.has(m.status||"Solicitado"));
  ln(); ln(`5. MATERIAIS: ${a.pedidos} pedidos, ${a.recebidosMat} recebidos, ${matP.length} pendentes`); rule("-");
  matP.forEach(m=>ln(`  · ${m.item} (${m.placa||"-"}, ${m.data?diff(m.data,today()):0} dias, ${m.status||"Solicitado"})`));
  ln(); ln("6. DIFICULDADES (impedimentos registrados)"); rule("-");
  IMPED.filter(i=>a.imp[i]).forEach(i=>ln(`  ${i.padEnd(40)} ${a.imp[i]}`)); if (!IMPED.some(i=>a.imp[i])) ln("  nenhum");
  ln(); ln("7. DESTAQUES"); rule("-");
  a.dest.forEach(d=>{ ln(`  ${brs(d.data)} [${d.destaque}] ${d.placa}: ${d.feito}`); if (d.obs) ln(`        ${d.obs}`); }); if (!a.dest.length) ln("  nenhum");
  ln(); ln("8. CONHECIMENTO GERADO"); rule("-");
  CTIPO.filter(t=>a.con[t]).forEach(t=>ln(`  ${t.padEnd(40)} ${a.con[t]}`)); if (!CTIPO.some(t=>a.con[t])) ln("  nenhum registro novo");
  const com = $("re-com").value.trim(), dec = $("re-dec").value.trim();
  ln(); ln("9. COMENTÁRIO DO TÉCNICO"); rule("-"); ln(com ? "  "+com.replace(/\n/g,"\n  ") : "  -");
  ln(); ln("10. DECISÕES / APOIO DA GESTÃO"); rule("-"); ln(dec ? "  "+dec.replace(/\n/g,"\n  ") : "  -");
  rule("=");
  return L.join("\n");
}

function rEvo(){
  if (loading()){ $("ev-body").innerHTML = `<div class="empty">carregando...</div>`; return; }
  const list = qzList().reverse(); const rows = list.map(q=>{ const m = metrics(q.ini,q.fim);
    const ab = D().filter(x=>x.entrada && x.entrada<=q.fim && !(x.encerradaEm && x.encerradaEm<=q.fim)).length;
    return {q, m, ab}; });
  const mh = Math.max(1,...rows.map(r=>r.m.horas)), mr = Math.max(1,...rows.map(r=>r.m.rep)), ma = Math.max(1,...rows.map(r=>r.ab));
  $("ev-body").innerHTML = `<div class="tw"><table><thead><tr><th>Quinzena</th><th class="n">Receb.</th><th class="n">Reg.</th><th>Horas</th><th class="n">% diag</th><th class="n">Diagn.</th><th>Reparadas</th><th class="n">Irrec.</th><th class="n">Taxa</th><th>Abertas no fim</th><th class="n">Conhec.</th></tr></thead><tbody>${
    rows.map(({q,m,ab})=>`<tr><td class="nw">${esc(q.label)}</td><td class="n">${m.recebidas}</td><td class="n">${m.registros}</td><td class="nw">${bar(m.horas,mh,10)} ${h(m.horas)}</td><td class="n">${pct(m.pDiag)}</td><td class="n">${m.diag}</td><td class="nw">${bar(m.rep,mr,8)} ${m.rep}</td><td class="n">${m.irr}</td><td class="n">${pct(m.taxa)}</td><td class="nw">${bar(ab,ma,8)} ${ab}</td><td class="n">${Object.values(m.con).reduce((a,b)=>a+b,0)}</td></tr>`).join("")}</tbody></table></div>`;
}

function rCfg(){
  if (!UI.cfgFilled && S.ready.config){ $("cf-tec").value = cfg().tecnico; $("cf-alerta").value = cfg().alerta; $("cf-cat").value = catTxt(cfg().catalogo); UI.cfgFilled = true; }
  const ex = Object.values(S.placas).filter(p=>p.exemplo).length;
  $("ex-msg").textContent = ex ? `${ex} placas de exemplo carregadas.` : "Nenhum exemplo carregado.";
  $("exp-btns").innerHTML = ["placas","diario","materiais","conhecimento"].map(c=>`<button class="btn sec" type="button" data-exp="${c}">${c}.csv</button>`).join("");
  $("mc-info").textContent = ME ? `${ME.nome||""} · ${ME.email||""} · papel: ${ME.papel==="tecnico"?"técnico":ME.papel}` : "";
  if (isAdm()){
    const L = Object.values(PROFILES).sort((a,b)=>(a.nome||"").localeCompare(b.nome||""));
    $("us-lista").innerHTML = `<div class="tw"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Ativo</th><th></th></tr></thead><tbody>${L.map(p=>`<tr>
      <td><input data-unome="${esc(p.id)}" value="${esc(p.nome)}" maxlength="60" aria-label="nome"></td><td class="muted">${esc(p.email)}</td>
      <td><select data-upapel="${esc(p.id)}" aria-label="papel" style="width:auto">${["admin","tecnico","leitura"].map(x=>`<option value="${x}"${x===p.papel?" selected":""}>${x==="tecnico"?"técnico":x}</option>`).join("")}</select></td>
      <td><input type="checkbox" data-uativo="${esc(p.id)}"${p.ativo?" checked":""} style="width:auto" aria-label="ativo"${p.id===ME.id?" disabled":""}></td>
      <td><button class="lk" type="button" data-usave="${esc(p.id)}">salvar</button></td></tr>`).join("")}</tbody></table></div>`;
  }
}

/* autores */
function resolveAuthors(){
  document.querySelectorAll("[data-uid]").forEach(c=>{ const p = PROFILES[c.dataset.uid]; c.textContent = p && p.nome ? p.nome.split(" ")[0] : ""; });
}

/* datalist de placas: abertas primeiro, depois GERAL e as encerradas */
let dlSig = "";
function fillDatalist(){
  const A = abertas().map(x=>x.id), E = D().filter(x=>!x.aberta).map(x=>x.id).sort().reverse();
  const sig = A.join()+"|"+E.join(); if (sig===dlSig) return; dlSig = sig;
  $("dl-placas").innerHTML = ["GERAL",...A,...E].map(id=>{ const x=S.derived[id]; return `<option value="${esc(id)}">${x?esc(`${x.status} · ${x.produto}${x.versao?" "+x.versao:""}${x.firmware?" "+x.firmware:""} · ${x.relatado}`):"atividade sem placa"}</option>`; }).join("");
}

/* ---------------- navegação ---------------- */
function go(v, opt={}){
  if (v==="ficha"){ if (opt.id){ if (UI.ficha!==opt.id) UI.fichaDirty=false; UI.ficha = opt.id; } }
  UI.view = v;
  document.querySelectorAll(".view").forEach(s=>s.hidden = s.id!=="v-"+v);
  $("nav").querySelectorAll("button").forEach(b=>b.setAttribute("aria-current", (b.dataset.v===v || (v==="ficha"&&b.dataset.v==="placas")) ? "page" : "false"));
  try { history.replaceState(null,"", v==="ficha" ? "#placas" : "#"+v); } catch(e){}
  render(); window.scrollTo({top:0});
}
$("nav").innerHTML = VIEWS.map(([k,l],i)=>`<button type="button" data-v="${k}"><span class="k">[${i+1}]</span>${l}</button>`).join("");
$("nav").addEventListener("click", e=>{ const b=e.target.closest("button[data-v]"); if (b) go(b.dataset.v); });

document.addEventListener("click", e=>{
  const t = e.target;
  const f = t.closest("[data-ficha]"); if (f && !t.closest("select")){ go("ficha",{id:f.dataset.ficha}); return; }
  const g = t.closest("[data-go]"); if (g){ go(g.dataset.go); return; }
  if (t.dataset.plf){ UI.plFilt=t.dataset.plf; render(); }
  if (t.dataset.dif){ UI.diFilt=t.dataset.dif; render(); }
  if (t.dataset.maf){ UI.maFilt=t.dataset.maf; render(); }
  if (t.dataset.cof){ UI.coFilt=t.dataset.cof; render(); }
  if (t.dataset.edi) editDiario(t.dataset.edi);
  if (t.dataset.ddi) confirmDel(t, ()=>delDoc("diario",t.dataset.ddi));
  if (t.dataset.dma) confirmDel(t, ()=>delDoc("materiais",t.dataset.dma));
  if (t.dataset.dco) confirmDel(t, ()=>delDoc("conhecimento",t.dataset.dco));
  if (t.dataset.exp) exportCsv(t.dataset.exp);
  if (t.dataset.h){ $("di-horas").value = t.dataset.h; }
  if (t.dataset.usave) salvarUsuario(t.dataset.usave);
});
document.addEventListener("change", async e=>{
  const t = e.target;
  if (t.dataset.mst){ const m = S.materiais.find(x=>x._id===t.dataset.mst); const upd = {status:t.value};
    if (t.value==="Recebido" && !(m&&m.recebido)) upd.recebido = today(); if (t.value!=="Recebido") upd.recebido = "";
    if (upd.recebido==="") upd.recebido = null;
    await write(()=>sb.from("materiais").update(upd).eq("id", t.dataset.mst), "Status do material atualizado.", ["materiais"]); }
  if (t.dataset.cst) await write(()=>sb.from("conhecimento").update({status:t.value}).eq("id", t.dataset.cst), "Status atualizado.", ["conhecimento"]);
});
function confirmDel(btn, fn){
  if (btn.dataset.armed){ delete btn.dataset.armed; fn(); return; }
  btn.dataset.armed = "1"; const old = btn.textContent; btn.textContent = "confirmar?";
  setTimeout(()=>{ if (btn.isConnected && btn.dataset.armed){ delete btn.dataset.armed; btn.textContent = old; } }, 4000);
}
document.addEventListener("keydown", e=>{
  const tag = (e.target.tagName||"").toLowerCase();
  if ((e.ctrlKey||e.metaKey) && e.key==="Enter"){ const f = e.target.closest && e.target.closest("form"); if (f){ e.preventDefault(); f.requestSubmit(); } return; }
  if (["input","textarea","select"].includes(tag) || e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains("out")) return;
  if (/^[1-8]$/.test(e.key)){ go(VIEWS[+e.key-1][0]); }
  else if (e.key==="n"||e.key==="N"){ e.preventDefault(); if (!UI.ro){ go("diario"); $("di-placa").focus(); } }
});

/* ---------------- gravação ---------------- */
function errMsg(e){
  const c = (e && e.code) || ""; const m = (e && e.message) || "erro";
  if (c==="42501" || /row-level security|permission denied/i.test(m)) return "Seu perfil não tem permissão para isso. Fale com o administrador.";
  if (c==="23503") return "Não dá para apagar: existem registros ligados a este item.";
  if (c==="23514") return "Algum campo está fora do permitido (confira horas, status e textos).";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  return "Não foi possível salvar: " + m;
}
async function write(fn, ok, tables){
  if (!sb || !ME){ toast("Sem conexão com o banco. Nada foi salvo.", true); return false; }
  let res;
  try { res = await fn(); } catch(e){ res = {error:e}; }
  if (res && res.error){ toast(errMsg(res.error), true); return false; }
  if (ok) toast(ok);
  if (tables) tables.forEach(t=>queueReload(t, 0));
  return (res && res.data) || true;
}
const delDoc = (col,id) => write(()=>sb.from(col).delete().eq("id", id), "Apagado.", [col]);
const nz = v => (v===undefined || v==="") ? null : v;
const fd = f => Object.fromEntries([...new FormData(f).entries()].map(([k,v])=>[k, typeof v==="string" ? v.trim() : v]));

/* placa */
$("f-placa").addEventListener("submit", async e=>{
  e.preventDefault(); const v = fd(e.target); const err = $("pl-err"); err.textContent="";
  const miss = [["entrada","data"],["produto","produto"],["origem","origem"],["relatado","defeito relatado"]].filter(([k])=>!v[k]).map(x=>x[1]);
  if (miss.length){ err.textContent = "!! falta: "+miss.join(", "); return; }
  const ci = catInfo(v.produto);
  const doc = {entrada:v.entrada, produto:v.produto, versao:nz(v.versao), firmware:nz(v.firmware), linha:ci.linha, tipo:nz(ci.tipo), origem:v.origem, relatado:v.relatado, prio:v.prio||"Normal", serie:nz(v.serie), ref:nz(v.ref)};
  const r = await write(()=>sb.from("placas").insert(doc).select("id").single(), null, ["placas"]);
  if (r){ toast(`${r.id} cadastrada. Escreva o ID na placa.`);
    ["pl-relatado","pl-serie","pl-ref","pl-versao","pl-firmware"].forEach(i=>$(i).value=""); $("pl-prio").value="Normal"; $("pl-relatado").focus();
  }
});
/* ficha */
$("f-ficha").addEventListener("input", ()=>UI.fichaDirty=true);
$("f-ficha").addEventListener("submit", async e=>{
  e.preventDefault(); const v = fd(e.target); const id = UI.ficha; if (!S.placas[id]) return;
  const ci = catInfo(v.produto);
  const upd = {versao:nz(v.versao), firmware:nz(v.firmware), linha:ci.linha, tipo:nz(ci.tipo), defeito:nz(v.defeito), causa:nz(v.causa), componentes:nz(v.componentes), destino:nz(v.destino), entrada:v.entrada, produto:v.produto, origem:v.origem, prio:v.prio||"Normal", relatado:v.relatado, serie:nz(v.serie), ref:nz(v.ref)};
  if (await write(()=>sb.from("placas").update(upd).eq("id", id), "Ficha salva.", ["placas"])){ UI.fichaDirty=false; render(); }
});
$("fi-del").addEventListener("click", e=>confirmDel(e.target, async ()=>{ const id=UI.ficha; if (await delDoc("placas",id)) go("placas"); }));
$("fi-reg").addEventListener("click", ()=>{ resetDiForm(); $("di-placa").value = UI.ficha; go("diario"); updStNow(); $("di-ativ").focus(); });

/* diário */
$("di-placa").addEventListener("input", updStNow);
function resetDiForm(keep){
  const f = $("f-diario"); const d = $("di-data").value, p = $("di-placa").value;
  f.reset(); $("di-mat-ped").checked = true;
  $("di-data").value = keep ? d : today(); if (keep) $("di-placa").value = p;
  UI.editDi = null; $("di-save").textContent = "Registrar"; $("di-cancel").hidden = true; $("di-title").textContent = "Registrar sessão";
  $("di-more").open = false; updStNow();
}
$("di-cancel").addEventListener("click", ()=>resetDiForm(false));
function editDiario(id){
  const d = S.diario.find(x=>x._id===id); if (!d) return;
  UI.editDi = id; $("di-title").textContent = "Editando registro de "+br(d.data);
  $("di-data").value=d.data||""; $("di-placa").value=d.placa||""; $("di-ativ").value=d.atividade||""; $("di-horas").value=d.horas||"";
  $("di-feito").value=d.feito||""; $("di-status").value=d.status||""; $("di-teste").value=d.teste||""; $("di-comp").value=d.componente||"";
  $("di-imp").value=d.impedimento||""; $("di-mat").value=d.material||""; $("di-mat-ped").checked=false; $("di-dest").value=d.destaque||""; $("di-obs").value=d.obs||"";
  $("di-more").open = !!(d.teste||d.componente||d.impedimento||d.material||d.destaque||d.obs);
  $("di-save").textContent = "Salvar alteração"; $("di-cancel").hidden = false; updStNow(); window.scrollTo({top:0}); $("di-feito").focus();
}
$("f-diario").addEventListener("submit", async e=>{
  e.preventDefault(); const v = fd(e.target); const err = $("di-err"); err.textContent = "";
  v.placa = (v.placa||"").toUpperCase(); const geral = v.placa==="GERAL";
  const miss = []; if (!v.data) miss.push("data"); if (!v.placa) miss.push("placa"); if (!v.atividade) miss.push("atividade");
  if (!(+v.horas>0)) miss.push("horas"); if (!v.feito) miss.push("o que foi feito"); if (!geral && !v.status) miss.push("status após");
  if (miss.length){ err.textContent = "!! falta: "+miss.join(", "); return; }
  if (!geral && !S.placas[v.placa]){ err.textContent = `!! ${v.placa} não está cadastrada. Cadastre em [2] PLACAS antes.`; return; }
  const doc = {data:v.data, placa_id: geral?null:v.placa, atividade:v.atividade, horas:Math.round(+v.horas*100)/100, feito:v.feito, status: geral?null:v.status,
    teste:nz(v.teste), componente:nz(v.componente), impedimento:nz(v.impedimento), material:nz(v.material), destaque:nz(v.destaque), obs:nz(v.obs)};
  let ok;
  if (UI.editDi){ const id = UI.editDi; ok = await write(()=>sb.from("diario").update(doc).eq("id", id), "Registro alterado.", ["diario"]); }
  else {
    ok = await write(()=>sb.from("diario").insert(doc), geral ? "Atividade registrada." : `Sessão registrada · ${v.placa} → ${v.status}`, ["diario"]);
    if (ok && v.material && $("di-mat-ped").checked)
      await write(()=>sb.from("materiais").insert({data:v.data, item:v.material, spec:nz(v.componente), qtd:1, placa:geral?"GERAL":v.placa, urg:"Normal", status:"Solicitado", obs:"aberto pelo diário"}), "Pedido de material aberto.", ["materiais"]);
  }
  if (ok){ resetDiForm(true); $("di-ativ").focus(); }
});
/* materiais */
$("f-mat").addEventListener("submit", async e=>{
  e.preventDefault(); const v = fd(e.target); $("ma-err").textContent="";
  if (!v.item){ $("ma-err").textContent = "!! falta: item"; return; }
  const doc = {data:today(), item:v.item, spec:nz(v.spec), qtd:+v.qtd||1, placa:nz((v.placa||"").toUpperCase()), urg:v.urg||"Normal", status:"Solicitado", obs:nz(v.obs)};
  if (await write(()=>sb.from("materiais").insert(doc), "Pedido registrado.", ["materiais"])){ e.target.reset(); $("ma-qtd").value=1; $("ma-urg").value="Normal"; }
});
/* conhecimento */
$("f-con").addEventListener("submit", async e=>{
  e.preventDefault(); const v = fd(e.target); $("co-err").textContent="";
  if (!v.tipo || !v.titulo){ $("co-err").textContent = "!! falta: tipo e título"; return; }
  const doc = {data:today(), tipo:v.tipo, titulo:v.titulo, descricao:nz(v.desc), placas:nz((v.placas||"").toUpperCase()), produto:nz(v.produto), acao:nz(v.acao), resp:nz(v.resp), status:"Registrado"};
  if (await write(()=>sb.from("conhecimento").insert(doc), "Conhecimento registrado.", ["conhecimento"])) e.target.reset();
});
/* relatório */
$("re-q").addEventListener("change", ()=>{ UI.relDirty=false; render(); });
$("f-rel").addEventListener("input", ()=>{ UI.relDirty=true; });
$("f-rel").addEventListener("submit", async e=>{
  e.preventDefault(); const key = $("re-q").value || qzOf(today()).key;
  if (await write(()=>sb.from("relatorios").upsert({quinzena:key, comentario:nz($("re-com").value.trim()), decisoes:nz($("re-dec").value.trim())}), "Textos salvos.", ["relatorios"])){ UI.relDirty=false; $("re-saved").textContent = "salvo às "+new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); render(); }
});
$("re-copy").addEventListener("click", async ()=>{
  const txt = $("re-txt").textContent;
  try { await navigator.clipboard.writeText(txt); toast("Relatório copiado. Cole no e-mail ou WhatsApp."); }
  catch(e){ const r = document.createRange(); r.selectNodeContents($("re-txt")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Texto selecionado. Use Ctrl+C para copiar."); }
});
$("re-dl").addEventListener("click", async ()=>{
  baixar(`relatorio-manutencao-${$("re-q").value}.txt`, "\ufeff"+$("re-txt").textContent, "text/plain");
});
/* config */
$("cf-restaurar").addEventListener("click", e=>confirmDel(e.target, async ()=>{
  if (await write(()=>sb.from("config").update({catalogo:null}).eq("id", 1), "Catálogo oficial 2026.1 restaurado.", ["config"])){ UI.cfgFilled=false; }
}));
$("f-cfg").addEventListener("submit", async e=>{
  e.preventDefault(); const v = fd(e.target);
  const cat = parseCat($("cf-cat").value);
  if (!cat.length){ $("cf-err").textContent = "!! o catálogo ficou vazio"; return; }
  const doc = {tecnico:v.tecnico||"", alerta:Math.max(1,+v.alerta||3), catalogo: cat};
  if (await write(()=>sb.from("config").update(doc).eq("id", 1), "Configuração salva.", ["config"])){ fillStaticSelects(); }
});

/* exportação */
async function exportCsv(col){
  const cols = {
    placas:["id","entrada","produto","versao","firmware","linha","tipo","origem","relatado","prio","serie","ref","defeito","causa","componentes","destino"],
    diario:["data","placa","atividade","horas","feito","status","teste","componente","impedimento","material","destaque","obs"],
    materiais:["data","item","spec","qtd","placa","urg","status","recebido","obs"],
    conhecimento:["data","tipo","titulo","descricao","placas","produto","acao","resp","status"],
  }[col];
  let rows = col==="placas" ? D() : S[col];
  const extra = col==="placas" ? ["status","fase","diagEm","encerradaEm","resultado","dias","horas"] : [];
  const all = [...cols, ...extra];
  const cell = v => { let s = typeof v==="number" ? String(v).replace(".",",") : String(v??""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv = "﻿" + [all.join(";"), ...rows.map(r=>all.map(k=>cell(r[k])).join(";"))].join("\r\n");
  baixar(`manutencao-${col}-${today()}.csv`, csv, "text/csv");
}

/* exemplos */
function exemplo(){
  const off = diff("2026-10-22", today()); const d = n => addDays("2026-10-01", n-1+off);
  const P = [
    ["EX-01",1,"DIR PRO","Linha de produção","Curto na alimentação (P1)","Normal","","NC-0001","Ponte de solda","Montagem/solda","","Devolvida à linha (P2)"],
    ["EX-02",1,"DIR PRO","Linha de produção","Reprovada na JIGA (P4)","Normal","","NC-0002","Componente danificado","Componente (lote/fornecedor)","Q5","Devolvida à linha (P4)"],
    ["EX-03",2,"DIR Nutri","Linha de produção","Válvula 14 não abre (P6)","Alta","","NC-0004","Componente danificado","Não identificada","",""],
    ["EX-04",3,"DIR Energy Plus","Retorno de campo","Não liga depois de chuva forte","Normal","NB-2207","Cliente A","Oxidação/umidade","Ambiente (umidade, surto)","","Sucata; cliente avisado"],
    ["EX-05",6,"DIR PRO","Retorno de campo","Saídas 15 a 18 não acionam","Alta","DP-0412","Cliente B","Trilha/ilha danificada","Não identificada","U12",""],
    ["EX-06",8,"DIR Nutri","Linha de produção","5V fora da faixa (P2)","Normal","","NC-0007","Componente danificado","Componente (lote/fornecedor)","Regulador 5V","Devolvida à linha (P2)"],
    ["EX-07",9,"CCPS Solar","Estoque","Placa parada no estoque, testar antes de usar","Baixa","CC-1180","","Sem defeito constatado","","","Volta ao estoque"],
    ["EX-08",13,"DIR PRO","Linha de produção","Duas saídas acionam juntas (P6)","Normal","","NC-0011","Ponte de solda","Montagem/solda","","Devolvida à linha (P6)"],
    ["EX-09",16,"DIR PRO","Linha de produção","LED da saída 7 apagado (P6)","Normal","","NC-0013","Componente errado/invertido","Montagem/solda","LED saída 7","Devolvida à linha (P6)"],
    ["EX-10",19,"REP","Garantia","Não comunica pelo rádio","Urgente","REP-0311","Cliente C","","","",""],
    ["EX-11",21,"DIR Nutri","Linha de produção","Hidrômetro HID3 não conta (P7)","Normal","","NC-0015","Componente danificado","Não identificada","R48",""],
    ["EX-12",22,"DIR PRO","Retorno de campo","Não inicializa pelo painel solar","Normal","DP-0388","Cliente D","","","",""],
  ].map(r=>({id:r[0],entrada:d(r[1]),produto:r[2],versao:({"EX-04":"DIR ENERGY V2.0","EX-07":"CCPS V3.1","EX-05":"não identificada","EX-10":"DIR V5.1"})[r[0]]||((["DIR PRO","DIR Nutri"].includes(r[2]))?"ECO v2.1":null),
    firmware:({"EX-04":"D011","EX-07":"CCPS_V5","EX-10":"D011"})[r[0]]||(r[2]==="DIR PRO"?"D011":r[2]==="DIR Nutri"?"D014":null),linha:catInfo(r[2]).linha,tipo:catInfo(r[2]).tipo,origem:r[3],relatado:r[4],prio:r[5],serie:r[6],ref:r[7],defeito:r[8],causa:r[9],componentes:r[10],destino:r[11],exemplo:true}));
  const [TR,DG,PD,RP,TS,AC,OR,DOC,TRN] = Object.keys(ATIV);
  const Dx = [
    [1,"GERAL",OR,3,"Organização da bancada e levantamento de ferramentas e componentes","", "","","","Bico 3 mm para estação de ar quente","Dificuldade","Estação de ar quente só tem bico largo"],
    [1,"EX-01",TR,.5,"Inspeção visual e continuidade: curto entre 3V3 e GND confirmado","Em diagnóstico","Reprovado","","","","",""],
    [2,"EX-01",DG,1.5,"Inspeção com lupa: ponte de solda entre pinos do U30","Em reparo","","U30 (AMS1117)","","","",""],
    [2,"EX-01",RP,.5,"Remoção da ponte com malha e fluxo","Em teste","","U30","","","",""],
    [2,"EX-01",TS,.5,"Continuidade OK, 5V e 3V3 na faixa","Concluída: reparada","Aprovado","","","","",""],
    [2,"EX-02",TR,.5,"Reprovada na JIGA na etapa de carga da bateria","Em diagnóstico","Reprovado","","","","",""],
    [2,"EX-02",DG,2,"Medições no circuito do CCPS: Q5 não chaveia","Em diagnóstico","","Q5","","","",""],
    [3,"EX-02",DG,2,"Q5 em curto entre coletor e emissor. Sem reposição no estoque","Aguardando peça","","Q5","Falta de peça/componente","Transistor Q5","",""],
    [3,"EX-03",TR,.5,"Válvula 14 não abre no teste de nutrição","Em diagnóstico","Reprovado","","","","",""],
    [3,"EX-03",DG,1.5,"Driver de ponte H U22 sem saída, alimentação dele OK","Aguardando peça","","U22","Falta de peça/componente","Driver de ponte H (U22)","",""],
    [6,"EX-04",TR,1,"Oxidação generalizada perto dos conectores e do MCU","Em diagnóstico","","Região do MCU","","","",""],
    [6,"EX-04",DG,1,"Trilhas corroídas sob o MCU; reparo custa mais que placa nova","Irrecuperável","","Trilhas sob o MCU","","","Descoberta técnica","Instalação no cliente sem caixa vedada"],
    [6,"EX-05",TR,.5,"Saídas 15 a 18 não acionam","Em diagnóstico","Reprovado","","","","",""],
    [7,"EX-05",DG,3,"Rastreio das trilhas das saídas 15 a 18; placa é de revisão antiga","Em diagnóstico","","Saídas 15-18","","","",""],
    [8,"EX-05",PD,2,"Procura do esquemático da revisão antiga, sem sucesso","Aguardando informação","","","Falta de esquemático/documentação","","Ponto para a gestão","Precisamos dos esquemáticos de todas as revisões da DIR PRO"],
    [8,"EX-06",TR,.5,"5V em 4,3 V no test point","Em diagnóstico","Reprovado","","","","",""],
    [8,"EX-06",DG,1,"Regulador de 5V aquecendo acima do normal","Em reparo","","Regulador 5V","","","",""],
    [9,"EX-06",RP,1,"Troca do regulador com estação de ar quente","Em teste","","Regulador 5V","","","",""],
    [9,"EX-06",TS,.5,"5V em 5,02 V, teste de alimentação aprovado","Concluída: reparada","Aprovado","","","","Candidato a POP","A troca do regulador segue sempre a mesma sequência"],
    [9,"EX-07",TS,1,"Teste completo de bancada: todas as funções OK","Concluída: sem defeito","Aprovado","","","","",""],
    [10,"GERAL",DOC,2,"Rascunho do fluxo de entrada de placas na manutenção","","","","","","",""],
    [13,"EX-05",PD,1,"Esquemático recebido da engenharia; comparação com a placa","Em diagnóstico","","","","","",""],
    [13,"EX-08",TR,.5,"Duas saídas acionam juntas na varredura","Em diagnóstico","Reprovado","","","","",""],
    [14,"EX-08",DG,1,"Ponte de solda entre pinos do MCU","Em reparo","","MCU","","","Descoberta técnica","Segunda ponte de solda no MCU no mês: avisar a montagem"],
    [14,"EX-08",RP,.5,"Remoção da ponte de solda","Em teste","","MCU","","","",""],
    [14,"EX-08",TS,.5,"Varredura das 32 saídas OK","Concluída: reparada","Aprovado","","","","",""],
    [14,"EX-02",AC,.25,"Q5 recebido do compras","Em reparo","","","","","",""],
    [15,"EX-02",RP,1,"Troca do Q5","Em teste","","Q5","","","",""],
    [15,"EX-02",TS,.5,"JIGA: APROVADO","Concluída: reparada","Aprovado","","","","",""],
    [15,"GERAL",TRN,1.5,"Acompanhamento do POP 36 na linha para entender os testes","","","","","","",""],
    [16,"EX-05",DG,3,"Expansor U12 sem resposta nas saídas 15 a 18","Em reparo","","U12","","Expansor de I/O (U12)","",""],
    [16,"EX-09",TR,.25,"LED da saída 7 não acende","Em reparo","Reprovado","LED saída 7","","","",""],
    [16,"EX-09",RP,.5,"LED estava invertido; ressoldado na posição correta","Em teste","","LED saída 7","","","",""],
    [16,"EX-09",TS,.25,"Todos os LEDs OK","Concluída: reparada","Aprovado","","","","",""],
    [17,"EX-05",RP,1.5,"Troca do U12","Em teste","","U12","","","",""],
    [17,"EX-05",TS,1,"Saídas 15 e 16 OK; 17 e 18 ainda falham","Em diagnóstico","Parcial","","","","Dificuldade","Defeito em dois pontos diferentes da mesma placa"],
    [20,"EX-05",DG,2,"Trilha rompida entre U12 e os relés 17-18, sob o relé","Em reparo","","Trilha saídas 17-18","","","",""],
    [20,"EX-10",TR,.5,"Sem comunicação pelo rádio","Em diagnóstico","Reprovado","","","","",""],
    [20,"EX-10",DG,2,"Hardware do rádio OK; suspeita de firmware ou configuração de canal","Aguardando outro setor","","Módulo de rádio","Depende de outro setor","","Ponto para a gestão","Precisa de apoio da engenharia de firmware"],
    [21,"EX-11",TR,1,"HID3 não conta pulsos; sinal não chega ao MCU","Em diagnóstico","Reprovado","Entrada HID3","","","",""],
    [21,"GERAL",DOC,1,"Registro das falhas recorrentes da semana","","","","","Lupa de bancada ou microscópio","Melhoria sugerida","Lupa ou microscópio reduziria o tempo de inspeção do MCU"],
    [22,"EX-05",RP,1,"Jumper na trilha rompida das saídas 17-18","Em teste","","Trilha saídas 17-18","","","",""],
    [22,"EX-11",DG,1.5,"Resistor de pull-up R48 aberto","Em reparo","","R48","","","",""],
  ].map((r,i)=>({data:d(r[0]),placa_id:r[1]==="GERAL"?null:r[1],atividade:r[2],horas:r[3],feito:r[4],status:nz(r[5]),teste:nz(r[6]),componente:nz(r[7]),impedimento:nz(r[8]),material:nz(r[9]),destaque:nz(r[10]),obs:nz(r[11]),criado_em:new Date(Date.now()-60000+i*100).toISOString(),exemplo:true}));
  const M = [
    [1,"Bico 3 mm para estação de ar quente","",1,"GERAL","Normal","Solicitado",0,""],
    [3,"Transistor Q5","Mesmo código da BOM DIR PRO",5,"EX-02","Urgente","Recebido",14,"Compras"],
    [3,"Driver de ponte H (U22)","Código da BOM DIR Nutri",5,"EX-03","Urgente","Comprado",0,"Prazo do fornecedor: 15 dias"],
    [8,"Regulador 5V","Código da BOM DIR",10,"EX-06","Normal","Recebido",9,"Estoque da produção"],
    [16,"Expansor de I/O (U12)","Código da BOM DIR PRO",2,"EX-05","Alta","Recebido",17,"Estoque da produção"],
    [21,"Lupa de bancada ou microscópio","Aumento de 10x a 40x",1,"GERAL","Normal","Solicitado",0,""],
  ].map(r=>({data:d(r[0]),item:r[1],spec:r[2],qtd:r[3],placa:r[4],urg:r[5],status:r[6],recebido:r[7]?d(r[7]):null,obs:r[8],exemplo:true}));
  const C = [
    [6,"Falha de rastreabilidade","Placas de campo sem identificação de revisão","Não dá para saber a revisão da placa sem comparar com fotos","EX-04; EX-05","DIR PRO","Etiqueta com revisão e nº de série já na montagem","Gestão","Registrado"],
    [8,"Dependência de outro setor","Esquemáticos de revisões antigas indisponíveis","Placas de campo são de revisões anteriores; diagnóstico parou 5 dias esperando","EX-05","DIR PRO","Engenharia manter pasta com todas as revisões","Gestão","Em análise"],
    [9,"Procedimento padronizável","Troca do regulador de 5V","Sequência repetível: remover com ar quente, limpar ilhas, soldar, medir 5V","EX-06","DIR Nutri","Escrever POP de manutenção","Técnico","Registrado"],
    [14,"Defeito recorrente","Ponte de solda no MCU das DIR PRO","Dois casos no mês vindos da linha","EX-01; EX-08","DIR PRO","Levar à montagem: revisar estêncil e inspeção depois da solda","Gestão / montagem","Em análise"],
    [21,"Necessidade de ferramenta","Lupa ou microscópio para inspeção do MCU","Pontes finas só aparecem com aumento","EX-01; EX-08","","Comprar lupa de bancada","Gestão","Registrado"],
  ].map(r=>({data:d(r[0]),tipo:r[1],titulo:r[2],descricao:r[3],placas:r[4],produto:nz(r[5]),acao:r[6],resp:r[7],status:r[8],exemplo:true}));
  return {P,Dx,M,C};
}
$("ex-load").addEventListener("click", async ()=>{
  if (!sb) return; if (Object.values(S.placas).some(p=>p.exemplo)){ $("ex-msg").textContent = "Os exemplos já estão carregados."; return; }
  const {P,Dx,M,C} = exemplo(); $("ex-msg").textContent = "carregando...";
  for (const [t,rows] of [["placas",P],["diario",Dx],["materiais",M],["conhecimento",C]]){
    if (!(await write(()=>sb.from(t).insert(rows), null, [t]))){ $("ex-msg").textContent = ""; return; }
  }
  toast("Exemplos carregados. Veja o PAINEL."); $("ex-msg").textContent = "";
});
$("ex-del").addEventListener("click", e=>confirmDel(e.target, async ()=>{
  if (!sb) return; $("ex-msg").textContent = "apagando...";
  for (const t of ["diario","materiais","conhecimento","placas"]){
    if (!(await write(()=>sb.from(t).delete().eq("exemplo", true), null, [t]))) break;
  }
  toast("Exemplos apagados."); $("ex-msg").textContent = "";
}));

/* ---------------- selects fixos ---------------- */
function fillStaticSelects(){
  const P = cfg().produtos;
  const keep = (id, html) => { const el=$(id); const v=el.value; el.innerHTML = html; if (v) el.value = v; };
  keep("pl-produto", prodOpts(undefined, "escolha...")); fillVersoes($("pl-produto").value); keep("pl-origem", opts(ORIGEM, undefined, "escolha...")); keep("pl-prio", opts(PRIO, "Normal"));
  if (!$("pl-prio").value) $("pl-prio").value = "Normal";
  keep("di-ativ", opts(Object.keys(ATIV), undefined, "escolha...")); keep("di-status", opts(Object.keys(STATUS), undefined, "escolha..."));
  keep("di-teste", opts(TESTE, undefined, "-")); keep("di-imp", opts(IMPED, undefined, "nenhum")); keep("di-dest", opts(DEST, undefined, "-"));
  keep("ma-urg", opts(URG, "Normal")); if (!$("ma-urg").value) $("ma-urg").value="Normal";
  keep("co-tipo", opts(CTIPO, undefined, "escolha...")); keep("co-prod", prodOpts(undefined, "-"));
  $("di-quick").innerHTML = ["0.25","0.5","1","1.5","2","3"].map(v=>`<button type="button" data-h="${v}">${v.replace(".",",")}</button>`).join("");
}

/* ---------------- relógio ---------------- */
function clock(){ const n = new Date(); $("hdr-clock").textContent = `${br(isoOf(n))} ${pad(n.getHours())}:${pad(n.getMinutes())}`; }
clock(); setInterval(clock, 30000);
let lastDay = today(); setInterval(()=>{ if (today()!==lastDay){ lastDay=today(); render(); } }, 60000);

/* ---------------- inicialização ---------------- */
fillStaticSelects();
$("pl-entrada").value = today(); $("di-data").value = today();
$("pl-busca").addEventListener("input", render); $("pl-linha").addEventListener("change", render);
$("pl-produto").addEventListener("change", e=>fillVersoes(e.target.value));
$("fi-produto").addEventListener("change", e=>fillVersoes(e.target.value)); $("di-busca").addEventListener("input", render);
const HASH0 = location.hash || "";

function setDb(state, txt){ $("hdr-dot").className = "dot "+state; $("hdr-db").textContent = txt; }
function setRO(on, msg, bad){ UI.ro = on; document.body.classList.toggle("ro", on); $("banner").innerHTML = msg ? `<div class="banner${bad?" bad":""}">${esc(msg)}</div>` : ""; render(); }
function showView(v){ document.querySelectorAll(".view").forEach(s=>s.hidden = s.id!=="v-"+v); }
function baixar(nome, texto, mime){
  const b = new Blob([texto], {type: mime+";charset=utf-8"}); const a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ---------------- carga de dados (Supabase) ---------------- */
const TABELAS = ["placas","diario","materiais","conhecimento","relatorios","config","profiles"];
const ORDEM = {placas:"id", diario:"criado_em", materiais:"criado_em", conhecimento:"criado_em", relatorios:"quinzena", config:"id", profiles:"criado_em"};
const clean = r => { const o = {}; for (const k in r) o[k] = r[k]===null ? "" : r[k]; return o; };
async function fetchAll(t){
  const out = [];
  for (let from=0;; from+=1000){
    const {data, error} = await sb.from(t).select("*").order(ORDEM[t]).range(from, from+999);
    if (error) throw error;
    out.push(...data); if (data.length < 1000) break;
  }
  return out;
}
async function loadTable(t){
  try {
    const rows = await fetchAll(t);
    if (t==="placas"){ const o={}; rows.forEach(r=>o[r.id]=clean(r)); S.placas=o; }
    else if (t==="diario") S.diario = rows.map(r=>({...clean(r), _id:r.id, placa:r.placa_id||"GERAL", horas:+r.horas, ts:Date.parse(r.criado_em)||0}));
    else if (t==="materiais") S.materiais = rows.map(r=>({...clean(r), _id:r.id}));
    else if (t==="conhecimento") S.conhecimento = rows.map(r=>({...clean(r), _id:r.id, desc:r.descricao||""}));
    else if (t==="relatorios"){ const o={}; rows.forEach(r=>o[r.quinzena]=clean(r)); S.relat=o; }
    else if (t==="config"){ const c = rows[0]||{}; S.config = {tecnico:c.tecnico||"", alerta:c.alerta||3, catalogo:Array.isArray(c.catalogo)?c.catalogo:null}; fillStaticSelects(); UI.cfgFilled=false; }
    else if (t==="profiles"){
      for (const k in PROFILES) delete PROFILES[k];
      rows.forEach(r=>PROFILES[r.id]=clean(r));
      const p = ME && PROFILES[ME.id];
      if (p && (p.papel!==ME.papel || p.ativo!==ME.ativo)){ toast("Seu acesso mudou. Recarregando..."); setTimeout(()=>location.reload(), 1200); return; }
    }
    S.ready[t] = 1; render();
  } catch(e){ console.error(t, e); toast("Erro ao carregar "+t+": "+errMsg(e), true); }
}
const RQ = {};
function queueReload(t, ms=300){ clearTimeout(RQ[t]); RQ[t] = setTimeout(()=>loadTable(t), ms); }

/* ---------------- login, senha e usuários ---------------- */
function telaLogin(msg){ document.body.classList.add("out"); showView("login"); $("lg-err").textContent = msg||""; setTimeout(()=>$("lg-email").focus(), 50); }
$("f-login").addEventListener("submit", async e=>{
  e.preventDefault(); $("lg-err").textContent = "entrando...";
  const {error} = await sb.auth.signInWithPassword({email:$("lg-email").value.trim(), password:$("lg-senha").value});
  if (error) $("lg-err").textContent = /invalid/i.test(error.message) ? "!! e-mail ou senha incorretos" : "!! "+error.message;
  else { $("lg-err").textContent = ""; const {data:{session}} = await sb.auth.getSession(); if (session) iniciar(session); }
});
$("lg-esqueci").addEventListener("click", async ()=>{
  const em = $("lg-email").value.trim(); if (!em){ $("lg-err").textContent = "!! digite seu e-mail acima"; return; }
  const {error} = await sb.auth.resetPasswordForEmail(em, {redirectTo: location.origin + location.pathname});
  if (error) $("lg-err").textContent = "!! "+error.message;
  else { $("lg-err").textContent = ""; toast("Se o e-mail estiver cadastrado, chega um link para criar nova senha."); }
});
$("f-senha").addEventListener("submit", async e=>{
  e.preventDefault(); const a = $("ns-1").value, b = $("ns-2").value; $("ns-err").textContent = "";
  if (a.length < 8){ $("ns-err").textContent = "!! mínimo 8 caracteres"; return; }
  if (a !== b){ $("ns-err").textContent = "!! as senhas não conferem"; return; }
  const {error} = await sb.auth.updateUser({password:a});
  if (error){ $("ns-err").textContent = "!! "+error.message; return; }
  toast("Senha salva."); try { history.replaceState(null, "", location.pathname); } catch(_){}
  const {data:{session}} = await sb.auth.getSession(); if (session) iniciar(session); else telaLogin();
});
$("f-minha").addEventListener("submit", async e=>{
  e.preventDefault(); const a = $("mc-senha").value; $("mc-err").textContent = "";
  if (a.length < 8){ $("mc-err").textContent = "!! mínimo 8 caracteres"; return; }
  const {error} = await sb.auth.updateUser({password:a});
  if (error) $("mc-err").textContent = "!! "+error.message; else { $("mc-senha").value = ""; toast("Senha trocada."); }
});
$("btn-sair").addEventListener("click", async ()=>{ await sb.auth.signOut(); try { history.replaceState(null, "", location.pathname); } catch(_){} location.reload(); });
async function salvarUsuario(id){
  const q = s => document.querySelector(`[data-${s}="${id}"]`);
  const upd = {nome:q("unome").value.trim(), papel:q("upapel").value, ativo:q("uativo").checked};
  await write(()=>sb.from("profiles").update(upd).eq("id", id), "Usuário atualizado.", ["profiles"]);
}

/* ---------------- início da sessão ---------------- */
let iniciado = false;
async function iniciar(session){
  if (iniciado) return; iniciado = true;
  const {data:p, error} = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (error || !p){
    iniciado = false; await sb.auth.signOut();
    telaLogin(error ? "!! "+errMsg(error) : "!! Seu perfil não existe no banco. O administrador precisa rodar o script SQL e convidar você de novo.");
    return;
  }
  if (!p.ativo){ iniciado = false; await sb.auth.signOut(); telaLogin("!! Seu acesso está desativado. Fale com o administrador."); return; }
  ME = clean(p);
  document.body.classList.remove("out"); document.body.classList.toggle("adm", p.papel==="admin");
  $("hdr-me").innerHTML = `${esc(p.nome||p.email)} <small>[${p.papel==="tecnico"?"técnico":esc(p.papel)}]</small>`;
  if (p.papel==="leitura") setRO(true, "Modo leitura: você vê tudo, mas não registra. Para registrar, peça ao administrador o papel de técnico.");
  else setRO(false);
  const hsh = HASH0.slice(1); go(VIEWS.some(v=>v[0]===hsh) ? hsh : "painel");
  setDb("", "carregando");
  await Promise.all(TABELAS.map(loadTable));
  sb.channel("mudancas")
    .on("postgres_changes", {event:"*", schema:"public"}, pl=>{ if (TABELAS.includes(pl.table)) queueReload(pl.table); })
    .subscribe(st=>{ if (st==="SUBSCRIBED") setDb("on","online"); else if (["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(st)) setDb("off","sem tempo real"); });
  setInterval(()=>TABELAS.forEach(t=>queueReload(t, 0)), 120000);
  window.addEventListener("focus", ()=>TABELAS.forEach(t=>queueReload(t, 200)));
}

(async function boot(){
  const C = window.APP_CONFIG || {};
  showView("nenhuma");
  if (!window.supabase || !C.SUPABASE_URL || !C.SUPABASE_ANON_KEY || /COLE_AQUI/.test(C.SUPABASE_ANON_KEY)){
    setDb("off", "sem configuração");
    $("banner").innerHTML = `<div class="banner bad">Configuração incompleta: preencha SUPABASE_URL e SUPABASE_ANON_KEY no arquivo config.js (veja o README).</div>`;
    return;
  }
  sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  const definirSenha = /type=(invite|recovery)/.test(HASH0);
  sb.auth.onAuthStateChange((ev)=>{ if (ev==="PASSWORD_RECOVERY"){ document.body.classList.add("out"); showView("senha"); } });
  const {data:{session}} = await sb.auth.getSession();
  if (!session){ setDb("off", "desconectado"); telaLogin(); return; }
  if (definirSenha){ document.body.classList.add("out"); showView("senha"); return; }
  iniciar(session);
})();
