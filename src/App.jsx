import { useState, useEffect } from "react";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";

/* =
   HOOKS & THEME
= */
function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" ? window.innerWidth < 700 : false);
  useEffect(() => { const h = () => setM(window.innerWidth < 700); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return m;
}

const C = { bg:"#09090f", surface:"#111120", border:"#1e1e2e", orange:"#f97316", green:"#22c55e", red:"#ef4444", blue:"#3b82f6", purple:"#a855f7", yellow:"#eab308", text:"#e2e8f0", muted:"#64748b", dim:"#1a1a28" };
const TT = { background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:12 };
const fmt  = v => (v||0).toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:0,maximumFractionDigits:0});
const pct  = v => `${(v||0).toFixed(1)}%`;
const now  = () => new Date().toISOString().split("T")[0];
const uid  = () => Date.now() + Math.floor(Math.random()*1000);

/* Florida Sales Tax */
const FL_TAX_COUNTIES = {"Miami-Dade":7,"Broward":7,"Palm Beach":7,"Orange":6.5,"Hillsborough":8.5,"Pinellas":7,"Duval":7,"Other":7};
const DEFAULT_COUNTY = "Broward";

/* ================================================================
   SUPABASE CONFIG
   Substitua com suas credenciais: supabase.com > Settings > API
   ================================================================ */
const SUPABASE_URL = "https://dczouvsecgencomvzalq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjem91dnNlY2dlbmNvbXZ6YWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTU0ODMsImV4cCI6MjA5Mjk3MTQ4M30.bWQfbdWlFnw6hpC1bXmoxyJ-BvSJ7H9l15wwVKmdqPk";
const IS_CONNECTED = !SUPABASE_URL.includes("SEU-PROJECT");

// Cliente HTTP simples — sem biblioteca externa
const sb = {
  url: (table, params="") => `${SUPABASE_URL}/rest/v1/${table}${params}`,
  hdr: (extra={}) => ({
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
    ...extra
  }),
  async select(table, params="?order=id.asc") {
    try {
      const r = await fetch(this.url(table, params), { headers: this.hdr() });
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    } catch { return []; }
  },
  async insert(table, rows) {
    try {
      const r = await fetch(this.url(table), {
        method: "POST", headers: this.hdr(),
        body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
      });
      return await r.json();
    } catch(e) { console.error("sb.insert", e); return null; }
  },
  async update(table, row, id) {
    try {
      const r = await fetch(this.url(table, `?id=eq.${id}`), {
        method: "PATCH", headers: this.hdr(),
        body: JSON.stringify(row)
      });
      return await r.json();
    } catch(e) { console.error("sb.update", e); return null; }
  },
  async remove(table, id) {
    try {
      await fetch(this.url(table, `?id=eq.${id}`), {
        method: "DELETE", headers: this.hdr({"Prefer":""})
      });
    } catch(e) { console.error("sb.remove", e); }
  },
  async upsert(table, rows) {
    try {
      const r = await fetch(this.url(table), {
        method: "POST",
        headers: this.hdr({"Prefer":"resolution=merge-duplicates,return=representation"}),
        body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
      });
      return await r.json();
    } catch(e) { console.error("sb.upsert", e); return null; }
  }
};

// Row mappers: DB (snake_case) ↔ App (camelCase)
const toCliente  = r => ({ id:r.id, nome:r.nome, email:r.email||"", phone:r.phone||"", cidade:r.cidade||"" });
const toVendedor = r => ({ id:r.id, nome:r.nome, email:r.email||"", comissao:+r.comissao });
const toBanco    = r => ({ id:r.id, nome:r.nome, banco:r.banco, routing:r.routing||"", account:r.account||"", tipo:r.tipo||"Checking", saldoInicial:+r.saldo_inicial, transacoes:[] });
const toBancoTx  = r => ({ id:r.id, data:r.data, descricao:r.descricao, tipo:r.tipo, valor:+r.valor, forma:r.forma||"" });
const toDespesa  = r => ({ id:r.id, descricao:r.descricao, valor:+r.valor, tipo:r.tipo||"Fixo" });
const toReceita  = r => ({ id:r.id, descricao:r.descricao, valor:+r.valor, conheceu:r.conheceu||"", perfil:r.perfil||"", categoria:r.categoria||"", obs:r.obs||"" });
const toVenda    = r => ({ id:r.id, data:r.data, clienteId:r.cliente_id, vendedorId:r.vendedor_id, categoria:r.categoria||"", descricao:r.descricao||"", valor:+r.valor, status:r.status, forma:r.forma||"", bancoId:r.banco_id, comissao:+r.comissao||0, custoMaterial:+r.custo_material||0, custoMaoObra:+r.custo_mao_obra||0, taxavel:r.taxavel!==false, salesTax:+r.sales_tax||0 });
const toCaixa    = r => ({ id:r.id, data:r.data, descricao:r.descricao, tipo:r.tipo, valor:+r.valor, categoria:r.categoria||"", forma:r.forma||"", bancoId:r.banco_id });
const toCR       = r => ({ id:r.id, clienteId:r.cliente_id, descricao:r.descricao||"", valor:+r.valor, vencimento:r.vencimento, status:r.status });
const toCP       = r => ({ id:r.id, fornecedor:r.fornecedor, descricao:r.descricao||"", valor:+r.valor, vencimento:r.vencimento, status:r.status });
const toComPaga  = r => ({ id:r.id, vendedorId:r.vendedor_id, valor:+r.valor, data:r.data, bancoId:r.banco_id, forma:r.forma||"", obs:r.obs||"" });

// App → DB mappers (for insert/update)
const fromCliente  = d => ({ nome:d.nome, email:d.email||"", phone:d.phone||"", cidade:d.cidade||"" });
const fromVendedor = d => ({ nome:d.nome, email:d.email||"", comissao:+d.comissao||5 });
const fromBanco    = d => ({ nome:d.nome, banco:d.banco, routing:d.routing||"", account:d.account||"", tipo:d.tipo||"Checking", saldo_inicial:+d.saldoInicial||0 });
const fromBancoTx  = (d, bancoId) => ({ banco_id:bancoId, data:d.data, descricao:d.descricao, tipo:d.tipo, valor:+d.valor, forma:d.forma||"" });
const fromDespesa  = d => ({ descricao:d.descricao, valor:+d.valor, tipo:d.tipo||"Fixo" });
const fromReceita  = d => ({ descricao:d.descricao, valor:+d.valor, conheceu:d.conheceu||"", perfil:d.perfil||"", categoria:d.categoria||"", obs:d.obs||"" });
const fromVenda    = d => ({ data:d.data, cliente_id:d.clienteId||null, vendedor_id:d.vendedorId||null, categoria:d.categoria||"", descricao:d.descricao||"", valor:+d.valor, status:d.status||"Pendente", forma:d.forma||"", banco_id:d.bancoId||null, comissao:+d.comissao||0, custo_material:+d.custoMaterial||0, custo_mao_obra:+d.custoMaoObra||0, taxavel:d.taxavel!==false, sales_tax:+d.salesTax||0 });
const fromCaixa    = d => ({ data:d.data, descricao:d.descricao, tipo:d.tipo, valor:+d.valor, categoria:d.categoria||"", forma:d.forma||"", banco_id:d.bancoId||null });
const fromCR       = d => ({ cliente_id:d.clienteId||null, descricao:d.descricao||"", valor:+d.valor, vencimento:d.vencimento, status:d.status||"Aberto" });
const fromCP       = d => ({ fornecedor:d.fornecedor, descricao:d.descricao||"", valor:+d.valor, vencimento:d.vencimento, status:d.status||"Aberto" });
const fromComPaga  = d => ({ vendedor_id:d.vendedorId, valor:+d.valor, data:d.data, banco_id:d.bancoId||null, forma:d.forma||"", obs:d.obs||"" });


/* Alert helpers */
const daysDiff = (dateStr) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.ceil((d - today) / 86400000);
};
const alertLevel = (dateStr, status) => {
  if (status !== "Aberto") return null;
  const d = daysDiff(dateStr);
  if (d < 0)  return "vencido";
  if (d === 0) return "hoje";
  if (d <= 3)  return "em3dias";
  return null;
};

const STATUS_STYLE = {
  Aprovado:{bg:"#14532d40",color:"#4ade80",border:"#166534"}, Enviado:{bg:"#1e3a5f40",color:"#60a5fa",border:"#1d4ed8"},
  Pendente:{bg:"#78350f40",color:"#fbbf24",border:"#92400e"}, Rascunho:{bg:"#1e1e3040",color:"#94a3b8",border:"#334155"},
  Recusado:{bg:"#450a0a40",color:"#f87171",border:"#991b1b"}, Recebido:{bg:"#14532d40",color:"#4ade80",border:"#166534"},
  Aberto:  {bg:"#1e3a5f40",color:"#60a5fa",border:"#1d4ed8"}, Vencido:{bg:"#450a0a40",color:"#f87171",border:"#991b1b"},
  Pago:    {bg:"#14532d40",color:"#4ade80",border:"#166534"},
};

const SIGN_CATS  = ["ACM Panels","Totem / Pylon","Channel Letters","Vehicle Wrap","Wayfinding","Monument Sign","LED / Digital","Banners & Vinyl","ADA Signs","Other"];
const EXP_CATS   = ["Material","Labor","Utilities","Salaries","Rent","Marketing","Equipment","Other"];
const FORMAS     = ["Cheque","ACH / Wire Transfer","Cartão de Crédito","Zelle / Venmo","Cash"];
const FORMA_ICON = {"Cheque":"🗒️","ACH / Wire Transfer":"🔁","Cartão de Crédito":"💳","Zelle / Venmo":"📱","Cash":"💵","Transferência":"↔️"};

/* =
   INITIAL DATA
= */
const INIT = {
  clientes:  [
    {id:1,nome:"ABC Corporation",  phone:"954-555-0101",email:"abc@corp.com",    cidade:"Fort Lauderdale"},
    {id:2,nome:"XYZ Realty Group", phone:"305-555-0202",email:"contact@xyz.com", cidade:"Miami"},
    {id:3,nome:"City Mall FL",     phone:"561-555-0303",email:"ops@citymall.com",cidade:"West Palm Beach"},
  ],
  vendedores:[
    {id:1,nome:"Carlos Mendes",email:"carlos@prosigns.com",comissao:5},
    {id:2,nome:"Ana Lima",     email:"ana@prosigns.com",   comissao:6},
    {id:3,nome:"Roberto Silva",email:"roberto@prosigns.com",comissao:5.5},
  ],
  bancos:[
    {id:1,nome:"Conta Principal",banco:"Bank of America",routing:"063100277",account:"****4321",tipo:"Checking",saldoInicial:5000,
     transacoes:[
      {id:101,data:"2026-04-02",descricao:"Recebimento ABC Corp", tipo:"entrada",valor:4200,forma:"ACH / Wire Transfer"},
      {id:102,data:"2026-04-10",descricao:"Recebimento City Mall",tipo:"entrada",valor:9500,forma:"Cheque"},
      {id:103,data:"2026-04-15",descricao:"Recebimento FL Biz",   tipo:"entrada",valor:3300,forma:"Zelle / Venmo"},
      {id:104,data:"2026-04-22",descricao:"Salários quinzena",    tipo:"saida",  valor:5200,forma:"ACH / Wire Transfer"},
      {id:105,data:"2026-04-01",descricao:"Aluguel galpão",       tipo:"saida",  valor:3500,forma:"Cheque"},
    ]},
    {id:2,nome:"Conta Reserva",banco:"Chase Bank",routing:"021000021",account:"****7890",tipo:"Savings",saldoInicial:8000,
     transacoes:[
      {id:201,data:"2026-04-15",descricao:"Reserva transferida",tipo:"entrada",valor:3000,forma:"Transferência"},
    ]},
  ],
  despesas:[
    {id:1,descricao:"Aluguel Galpão",     valor:3500,tipo:"Fixo"},
    {id:2,descricao:"Salários",            valor:5200,tipo:"Fixo"},
    {id:3,descricao:"Energia Elétrica",   valor:820, tipo:"Fixo"},
    {id:4,descricao:"Internet / Telefone",valor:180, tipo:"Fixo"},
    {id:5,descricao:"Seguro",              valor:350, tipo:"Fixo"},
    {id:6,descricao:"Material ACM",        valor:1200,tipo:"Variável"},
    {id:7,descricao:"Tinta e insumos",     valor:480, tipo:"Variável"},
  ],
  margemVariavel: 35,
  taxCounty: "Broward",
  vendas:[
    {id:1,data:"2026-04-02",clienteId:1,vendedorId:1,categoria:"ACM Panels",   descricao:"Painéis ACM 4x8",   valor:4200,status:"Recebido",forma:"ACH / Wire Transfer",bancoId:1,custoMaterial:980,custoMaoObra:620,taxavel:true,salesTax:294},
    {id:2,data:"2026-04-10",clienteId:3,vendedorId:1,categoria:"Wayfinding",   descricao:"Kit wayfinding",    valor:9500,status:"Recebido",forma:"Cheque",              bancoId:1,custoMaterial:2200,custoMaoObra:1800,taxavel:true,salesTax:665},
    {id:3,data:"2026-04-15",clienteId:2,vendedorId:3,categoria:"Vehicle Wrap",descricao:"Envelopamento van",valor:3300,status:"Recebido",forma:"Zelle / Venmo",      bancoId:1,custoMaterial:850,custoMaoObra:600,taxavel:true,salesTax:231},
    {id:4,data:"2026-04-20",clienteId:3,vendedorId:2,categoria:"LED / Digital",descricao:"Totens LED",     valor:6700,status:"Pendente",forma:"",                   bancoId:null,custoMaterial:1800,custoMaoObra:1200,taxavel:true,salesTax:469},
    {id:5,data:"2026-04-25",clienteId:1,vendedorId:2,categoria:"Channel Letters",descricao:"Letras fachada",valor:5100,status:"Pendente",forma:"",                  bancoId:null,custoMaterial:1200,custoMaoObra:900,taxavel:true,salesTax:357},
  ],
  caixa:[
    {id:1, data:"2026-04-01",descricao:"Aluguel galpão",       tipo:"saida",  valor:3500,categoria:"Rent",    forma:"Cheque",             bancoId:1},
    {id:2, data:"2026-04-02",descricao:"Recebimento ABC Corp", tipo:"entrada",valor:4200,categoria:"Venda",   forma:"ACH / Wire Transfer",bancoId:1},
    {id:3, data:"2026-04-03",descricao:"Material ACM",         tipo:"saida",  valor:1200,categoria:"Material",forma:"Cheque",             bancoId:1},
    {id:4, data:"2026-04-05",descricao:"Tinta e insumos",      tipo:"saida",  valor:480, categoria:"Material",forma:"Cash",               bancoId:1},
    {id:5, data:"2026-04-10",descricao:"Recebimento City Mall",tipo:"entrada",valor:9500,categoria:"Venda",   forma:"Cheque",             bancoId:1},
    {id:6, data:"2026-04-12",descricao:"FPL Energy",           tipo:"saida",  valor:820, categoria:"Utilities",forma:"ACH / Wire Transfer",bancoId:1},
    {id:7, data:"2026-04-15",descricao:"Recebimento FL Biz",   tipo:"entrada",valor:3300,categoria:"Venda",   forma:"Zelle / Venmo",      bancoId:1},
    {id:8, data:"2026-04-18",descricao:"Marketing / Ads",      tipo:"saida",  valor:600, categoria:"Marketing",forma:"Cartão de Crédito",  bancoId:1},
    {id:9, data:"2026-04-22",descricao:"Salários quinzena",    tipo:"saida",  valor:5200,categoria:"Salaries",forma:"ACH / Wire Transfer",bancoId:1},
    {id:10,data:"2026-04-23",descricao:"Parcial Sun Hotels",   tipo:"entrada",valor:2000,categoria:"Venda",   forma:"Zelle / Venmo",      bancoId:1},
    {id:11,data:"2026-04-25",descricao:"Material vinil",       tipo:"saida",  valor:720, categoria:"Material",forma:"Cash",               bancoId:1},
  ],
  contasReceber:[
    {id:1,clienteId:2,descricao:"Totem ACM – 50%",         valor:2800,vencimento:"2026-05-05",status:"Aberto"},
    {id:2,clienteId:3,descricao:"LED Totens – saldo",      valor:4700,vencimento:"2026-05-10",status:"Aberto"},
    {id:3,clienteId:1,descricao:"Channel Letters – sinal", valor:1500,vencimento:"2026-04-28",status:"Vencido"},
  ],
  receitas:[],
  comissoesPagas:[], // {id, vendedorId, valor, data, bancoId, forma, obs}
  contasPagar:[
    {id:1,fornecedor:"ACM Supplies Inc",descricao:"Material ACM maio",valor:3200,vencimento:"2026-05-01",status:"Aberto"},
    {id:2,fornecedor:"Galpão Owner LLC",descricao:"Aluguel maio",     valor:3500,vencimento:"2026-05-01",status:"Aberto"},
    {id:3,fornecedor:"FPL Energy",      descricao:"Energia maio",     valor:820, vencimento:"2026-05-12",status:"Aberto"},
  ],
};

/* =
   CORE BUSINESS LOGIC — all mutations go through these functions
= */
function calcSaldoBanco(banco) {
  const txs = banco.transacoes || [];
  return banco.saldoInicial + txs.reduce((s,t) => s + (t.tipo==="entrada" ? t.valor : -t.valor), 0);
}

function creditarBanco(bancos, bancoId, tx) {
  return bancos.map(b => b.id === bancoId ? { ...b, transacoes:[...(b.transacoes||[]), tx] } : b);
}

function debitarBanco(bancos, bancoId, tx) {
  return bancos.map(b => b.id === bancoId ? { ...b, transacoes:[...(b.transacoes||[]), {...tx, tipo:"saida"}] } : b);
}

// Venda → Recebido: lança caixa + credita banco
function receberVenda(d, vendaId, forma, bancoId) {
  const venda = d.vendas.find(v => v.id === vendaId);
  if (!venda) return d;
  const caixaTx = { id:uid(), data:now(), descricao:`Venda recebida — ${venda.descricao}`, tipo:"entrada", valor:venda.valor, categoria:"Venda", forma, bancoId:+bancoId };
  const bancoTx = { id:uid(), data:now(), descricao:`Venda — ${venda.descricao}`, tipo:"entrada", valor:venda.valor, forma };
  return {
    ...d,
    vendas:  d.vendas.map(v => v.id === vendaId ? {...v, status:"Recebido", forma, bancoId:+bancoId} : v),
    caixa:   [...d.caixa, caixaTx],
    bancos:  bancoId ? creditarBanco(d.bancos, +bancoId, bancoTx) : d.bancos,
  };
}

// Conta a Receber → Pago: lança caixa + credita banco
function pagarContaReceber(d, contaId, forma, bancoId) {
  const conta = d.contasReceber.find(c => c.id === contaId);
  if (!conta) return d;
  const cli = d.clientes.find(c => c.id === conta.clienteId);
  const caixaTx = { id:uid(), data:now(), descricao:`Recebimento — ${conta.descricao}${cli ? ` (${cli.nome})` : ""}`, tipo:"entrada", valor:conta.valor, categoria:"Venda", forma, bancoId:+bancoId };
  const bancoTx = { id:uid(), data:now(), descricao:`Recebimento — ${conta.descricao}`, tipo:"entrada", valor:conta.valor, forma };
  return {
    ...d,
    contasReceber: d.contasReceber.map(c => c.id === contaId ? {...c, status:"Pago"} : c),
    caixa:  [...d.caixa, caixaTx],
    bancos: bancoId ? creditarBanco(d.bancos, +bancoId, bancoTx) : d.bancos,
  };
}

// Conta a Pagar → Pago: lança caixa + debita banco
function pagarContaPagar(d, contaId, forma, bancoId) {
  const conta = d.contasPagar.find(c => c.id === contaId);
  if (!conta) return d;
  const caixaTx = { id:uid(), data:now(), descricao:`Pagamento — ${conta.descricao} (${conta.fornecedor})`, tipo:"saida", valor:conta.valor, categoria:"Other", forma, bancoId:+bancoId };
  const bancoTx = { id:uid(), data:now(), descricao:`Pagamento — ${conta.fornecedor}`, tipo:"saida", valor:conta.valor, forma };
  return {
    ...d,
    contasPagar: d.contasPagar.map(c => c.id === contaId ? {...c, status:"Pago"} : c),
    caixa:  [...d.caixa, caixaTx],
    bancos: bancoId ? debitarBanco(d.bancos, +bancoId, bancoTx) : d.bancos,
  };
}

/* =
   UI PRIMITIVES
= */
function Badge({s}) {
  const st = STATUS_STYLE[s]||STATUS_STYLE.Rascunho;
  return <span style={{background:st.bg,color:st.color,border:`1px solid ${st.border}`,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",display:"inline-block"}}>{s}</span>;
}

function Card({children,style={},accent=false}) {
  return <div style={{background:C.surface,border:`1px solid ${accent?C.orange:C.border}`,borderRadius:14,padding:14,...style}}>{children}</div>;
}

function Btn({children,onClick,v="primary",size="md",style={},disabled=false}) {
  const sz = size==="sm"?{fontSize:12,padding:"6px 12px"}:{fontSize:13,padding:"9px 16px"};
  const vs = {
    primary:{background:C.orange,color:"#000"},
    ghost:  {background:"rgba(255,255,255,0.07)",color:C.text,border:`1px solid ${C.border}`},
    green:  {background:"rgba(34,197,94,0.15)",color:C.green,border:"1px solid rgba(34,197,94,0.3)"},
    danger: {background:"rgba(239,68,68,0.12)",color:C.red,border:"1px solid rgba(239,68,68,0.25)"},
  };
  return <button onClick={onClick} disabled={disabled} style={{cursor:disabled?"not-allowed":"pointer",border:"none",borderRadius:10,fontWeight:600,fontFamily:"inherit",touchAction:"manipulation",...sz,...vs[v],...style,opacity:disabled?0.5:1}}>{children}</button>;
}

function Fld({label,value,onChange,type="text",options,span=false,isMobile=false}) {
  const inp = {background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontSize:15,width:"100%",outline:"none",fontFamily:"inherit",WebkitAppearance:"none"};
  return (
    <div style={span&&!isMobile?{gridColumn:"1 / -1"}:{}}>
      {label&&<label style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5}}>{label}</label>}
      {options
        ?<select value={value} onChange={e=>onChange(e.target.value)} style={inp}><option value="">Selecione...</option>{options.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}</select>
        :<input type={type} value={value} onChange={e=>onChange(e.target.value)} style={inp}/>
      }
    </div>
  );
}

function Grid({children,cols=2,isMobile=false,style={}}) {
  return <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":`repeat(${cols},1fr)`,gap:10,...style}}>{children}</div>;
}

function SectionHead({title,action}) {
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}><h2 style={{color:C.text,fontSize:18,fontWeight:700,fontFamily:"Syne,sans-serif"}}>{title}</h2>{action}</div>;
}

function Tabs({tabs,active,onChange}) {
  return <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>{tabs.map(([id,label])=><button key={id} onClick={()=>onChange(id)} style={{cursor:"pointer",border:"none",borderRadius:99,padding:"7px 14px",fontSize:12,fontWeight:600,fontFamily:"inherit",touchAction:"manipulation",background:active===id?C.orange:"rgba(255,255,255,0.07)",color:active===id?"#000":C.muted}}>{label}</button>)}</div>;
}

function StatCard({label,value,color=C.orange,sub}) {
  return <Card><p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{label}</p><p style={{color,fontSize:20,fontWeight:700,fontFamily:"monospace"}}>{value}</p>{sub&&<p style={{color:C.muted,fontSize:11,marginTop:2}}>{sub}</p>}</Card>;
}

// Modal to collect forma + banco before marking paid/received
function PayModal({title,onConfirm,onCancel,bancos,isIncome=true}) {
  const [forma,setForma] = useState("");
  const [bancoId,setBancoId] = useState("");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}}>
      <Card style={{width:"100%",maxWidth:400,padding:20}} accent>
        <p style={{color:C.text,fontWeight:700,fontSize:16,marginBottom:14,fontFamily:"Syne,sans-serif"}}>{title}</p>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          <Fld label="Forma de Pagamento *" value={forma} onChange={setForma} options={FORMAS.map(f=>({v:f,l:FORMA_ICON[f]+" "+f}))}/>
          <Fld label={isIncome?"Creditar em qual Banco *":"Debitar de qual Banco *"} value={bancoId} onChange={setBancoId}
            options={bancos.map(b=>({v:b.id,l:`${b.nome} — ${fmt(calcSaldoBanco(b))}`}))}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={()=>{if(forma&&bancoId)onConfirm(forma,bancoId);}} disabled={!forma||!bancoId} v={isIncome?"green":"primary"}>
            {isIncome?"✓ Confirmar Recebimento":"✓ Confirmar Pagamento"}
          </Btn>
          <Btn v="ghost" onClick={onCancel}>Cancelar</Btn>
        </div>
      </Card>
    </div>
  );
}

/* =
   DASHBOARD
= */
function Dashboard({data,setData}) {
  const isMobile = useIsMobile();
  const [dreTab, setDreTab] = useState("resumo");

  // Auto-mark overdue accounts on every render
  const today = now();
  const contasReceber = data.contasReceber.map(c =>
    c.status==="Aberto" && c.vencimento < today ? {...c, status:"Vencido"} : c
  );
  const contasPagar = data.contasPagar.map(c =>
    c.status==="Aberto" && c.vencimento < today ? {...c, status:"Vencido"} : c
  );

  // Alerts
  const alertsR = contasReceber.filter(c => alertLevel(c.vencimento, c.status) !== null)
    .map(c => ({...c, level: alertLevel(c.vencimento, c.status), tipo:"Receber"}));
  const alertsP = contasPagar.filter(c => alertLevel(c.vencimento, c.status) !== null)
    .map(c => ({...c, level: alertLevel(c.vencimento, c.status), tipo:"Pagar"}));
  const allAlerts = [...alertsR, ...alertsP].sort((a,b) => a.vencimento.localeCompare(b.vencimento));

  const alertColor = {vencido:C.red, hoje:C.orange, em3dias:C.yellow};
  const alertLabel = {vencido:"VENCIDO", hoje:"VENCE HOJE", em3dias:"VENCE EM 3 DIAS"};

  // KPIs
  const totalVendas   = data.vendas.reduce((s,v) => s+v.valor, 0);
  const recebido      = data.vendas.filter(v=>v.status==="Recebido").reduce((s,v)=>s+v.valor,0);
  const totalE        = data.caixa.filter(c=>c.tipo==="entrada").reduce((s,c)=>s+c.valor,0);
  const totalS        = data.caixa.filter(c=>c.tipo==="saida").reduce((s,c)=>s+c.valor,0);
  const aReceber      = contasReceber.filter(c=>c.status==="Aberto").reduce((s,c)=>s+c.valor,0);
  const aPagar        = contasPagar.filter(c=>c.status==="Aberto").reduce((s,c)=>s+c.valor,0);
  const saldoBancos   = data.bancos.reduce((s,b)=>s+calcSaldoBanco(b),0);

  // DRE
  const taxRate       = FL_TAX_COUNTIES[data.taxCounty||DEFAULT_COUNTY] / 100;
  const totalSalesTax = data.vendas.filter(v=>v.status==="Recebido").reduce((s,v)=>s+(v.salesTax||0),0);
  const receitaLiq    = recebido - totalSalesTax;
  const custoMat      = data.vendas.filter(v=>v.status==="Recebido").reduce((s,v)=>s+(v.custoMaterial||0),0);
  const custoMO       = data.vendas.filter(v=>v.status==="Recebido").reduce((s,v)=>s+(v.custoMaoObra||0),0);
  const custoTotal    = custoMat + custoMO;
  const lucroBruto    = receitaLiq - custoTotal;
  const margemBruta   = receitaLiq > 0 ? (lucroBruto/receitaLiq*100) : 0;
  const despFixas     = data.despesas.filter(d=>d.tipo==="Fixo").reduce((s,d)=>s+d.valor,0);
  const despVar       = data.despesas.filter(d=>d.tipo==="Variável").reduce((s,d)=>s+d.valor,0);
  const lucroOp       = lucroBruto - despFixas - despVar;
  const margemOp      = receitaLiq > 0 ? (lucroOp/receitaLiq*100) : 0;

  // Break-even
  const fixos     = data.despesas.filter(d=>d.tipo==="Fixo").reduce((s,d)=>s+d.valor,0);
  const margem    = Math.max((100-data.margemVariavel)/100,0.01);
  const breakEven = fixos/margem;
  const progresso = Math.min((recebido/breakEven)*100,100);

  // Daily cash flow
  const diasMap={};
  data.caixa.filter(c=>c.data>="2026-04-01"&&c.data<="2026-04-30").forEach(c=>{
    const d=c.data.split("-")[2];
    if(!diasMap[d]) diasMap[d]={dia:+d,ent:0,sai:0};
    if(c.tipo==="entrada") diasMap[d].ent+=c.valor; else diasMap[d].sai+=c.valor;
  });
  const diario=Object.values(diasMap).sort((a,b)=>a.dia-b.dia);

  // By category
  const porCat=SIGN_CATS.map(cat=>({cat:cat.split(" ")[0],val:data.vendas.filter(v=>v.categoria===cat).reduce((s,v)=>s+v.valor,0)})).filter(x=>x.val>0);
  const porForma=FORMAS.map(f=>({forma:f.split(" ")[0],val:data.caixa.filter(c=>c.tipo==="entrada"&&c.forma===f).reduce((s,c)=>s+c.valor,0)})).filter(x=>x.val>0);

  const mgColor = (m) => m >= 40 ? C.green : m >= 25 ? C.yellow : C.red;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* ALERTS BANNER */}
      {allAlerts.length > 0 && (
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {allAlerts.map((a,i) => {
            const color = alertColor[a.level];
            const d = daysDiff(a.vencimento);
            const nome = a.tipo==="Receber"
              ? (data.clientes.find(c=>c.id===a.clienteId)?.nome || "Cliente")
              : a.fornecedor;
            return (
              <div key={i} style={{background:`${color}15`,border:`1px solid ${color}40`,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:16}}>{a.level==="vencido"?"🔴":a.level==="hoje"?"🟠":"🟡"}</span>
                  <div>
                    <p style={{color,fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:"0.06em"}}>{alertLabel[a.level]} — {a.tipo==="Receber"?"A Receber":"A Pagar"}</p>
                    <p style={{color:C.text,fontSize:13}}>{nome} · {a.descricao}</p>
                    <p style={{color:C.muted,fontSize:11}}>
                      {a.vencimento}
                      {d < 0 ? ` · ${Math.abs(d)} dia(s) em atraso` : d===0 ? " · Vence hoje" : ` · ${d} dia(s)`}
                    </p>
                  </div>
                </div>
                <p style={{color,fontFamily:"monospace",fontWeight:700,fontSize:16,flexShrink:0}}>{fmt(a.valor)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Card><p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Vendas do Mes</p><p style={{color:C.orange,fontSize:20,fontWeight:700,fontFamily:"monospace"}}>{fmt(totalVendas)}</p><p style={{color:C.muted,fontSize:11,marginTop:2}}>{fmt(recebido)} recebido</p></Card>
        <Card><p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Saldo em Bancos</p><p style={{color:saldoBancos>=0?C.green:C.red,fontSize:20,fontWeight:700,fontFamily:"monospace"}}>{fmt(saldoBancos)}</p><p style={{color:C.muted,fontSize:11,marginTop:2}}>{data.bancos.length} conta(s)</p></Card>
        <Card><p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>A Receber</p><p style={{color:C.blue,fontSize:20,fontWeight:700,fontFamily:"monospace"}}>{fmt(aReceber)}</p>{allAlerts.filter(a=>a.tipo==="Receber").length>0&&<p style={{color:C.red,fontSize:11,marginTop:2}}>{allAlerts.filter(a=>a.tipo==="Receber").length} alerta(s)</p>}</Card>
        <Card><p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>A Pagar</p><p style={{color:C.red,fontSize:20,fontWeight:700,fontFamily:"monospace"}}>{fmt(aPagar)}</p>{allAlerts.filter(a=>a.tipo==="Pagar").length>0&&<p style={{color:C.red,fontSize:11,marginTop:2}}>{allAlerts.filter(a=>a.tipo==="Pagar").length} alerta(s)</p>}</Card>
      </div>

      {/* DRE */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <p style={{color:C.text,fontWeight:700,fontSize:15,fontFamily:"Syne,sans-serif"}}>DRE — Resultado do Mes</p>
          <div style={{display:"flex",gap:6}}>
            {[["resumo","Resumo"],["detalhe","Detalhe"]].map(([id,label])=>(
              <button key={id} onClick={()=>setDreTab(id)}
                style={{cursor:"pointer",border:"none",borderRadius:99,padding:"5px 12px",fontSize:11,fontWeight:600,fontFamily:"inherit",background:dreTab===id?C.orange:"rgba(255,255,255,0.07)",color:dreTab===id?"#000":C.muted}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {dreTab==="resumo" && (
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {[
              ["(+) Receita Bruta (vendas recebidas)", recebido,      C.green,  false],
              ["(-) Sales Tax Coletado (FL)",          -totalSalesTax,C.muted,  true],
              ["(=) Receita Liquida",                  receitaLiq,    C.green,  false],
              ["(-) Custo de Material",                -custoMat,     C.red,    true],
              ["(-) Custo de Mao de Obra",             -custoMO,      C.red,    true],
              ["(=) Lucro Bruto",                      lucroBruto,    mgColor(margemBruta), false],
              ["(-) Despesas Fixas",                   -despFixas,    C.red,    true],
              ["(-) Despesas Variaveis",               -despVar,      C.orange, true],
              ["(=) Resultado Operacional",            lucroOp,       mgColor(margemOp), false],
            ].map(([label,val,color,indent],i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.dim}`,paddingLeft:indent?12:0}}>
                <span style={{color:indent?C.muted:C.text,fontSize:13,fontWeight:indent?400:600}}>{label}</span>
                <span style={{color,fontFamily:"monospace",fontWeight:700,fontSize:13}}>{val<0?fmt(-val):fmt(val)}</span>
              </div>
            ))}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
              <div style={{background:`${mgColor(margemBruta)}10`,borderRadius:10,padding:"10px 14px",border:`1px solid ${mgColor(margemBruta)}25`}}>
                <p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Margem Bruta</p>
                <p style={{color:mgColor(margemBruta),fontFamily:"monospace",fontWeight:700,fontSize:20,marginTop:4}}>{pct(margemBruta)}</p>
              </div>
              <div style={{background:`${mgColor(margemOp)}10`,borderRadius:10,padding:"10px 14px",border:`1px solid ${mgColor(margemOp)}25`}}>
                <p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Margem Operacional</p>
                <p style={{color:mgColor(margemOp),fontFamily:"monospace",fontWeight:700,fontSize:20,marginTop:4}}>{pct(margemOp)}</p>
              </div>
            </div>
          </div>
        )}

        {dreTab==="detalhe" && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{background:`${C.green}08`,borderRadius:10,padding:12,border:`1px solid ${C.green}20`}}>
              <p style={{color:C.green,fontWeight:700,fontSize:13,marginBottom:8}}>Receitas</p>
              {[
                ["Vendas recebidas", recebido],
                ["(-) Sales Tax FL", -totalSalesTax],
                ["Receita Liquida", receitaLiq],
              ].map(([l,v],i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.dim}`}}>
                  <span style={{color:C.muted,fontSize:12}}>{l}</span>
                  <span style={{color:v>=0?C.green:C.red,fontFamily:"monospace",fontWeight:600,fontSize:12}}>{v<0?"-"+fmt(-v):fmt(v)}</span>
                </div>
              ))}
            </div>
            <div style={{background:`${C.red}08`,borderRadius:10,padding:12,border:`1px solid ${C.red}20`}}>
              <p style={{color:C.red,fontWeight:700,fontSize:13,marginBottom:8}}>Custos de Producao (CPV)</p>
              {[
                ["Material", custoMat],
                ["Mao de Obra", custoMO],
                ["Total CPV", custoTotal],
              ].map(([l,v],i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.dim}`}}>
                  <span style={{color:C.muted,fontSize:12}}>{l}</span>
                  <span style={{color:C.red,fontFamily:"monospace",fontWeight:600,fontSize:12}}>{fmt(v)}</span>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(249,115,22,0.06)",borderRadius:10,padding:12,border:"1px solid rgba(249,115,22,0.2)"}}>
              <p style={{color:C.orange,fontWeight:700,fontSize:13,marginBottom:8}}>Despesas Operacionais</p>
              {data.despesas.map(d=>(
                <div key={d.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.dim}`}}>
                  <span style={{color:C.muted,fontSize:12}}>{d.descricao} <span style={{fontSize:10,color:`${C.muted}88`}}>({d.tipo})</span></span>
                  <span style={{color:C.orange,fontFamily:"monospace",fontWeight:600,fontSize:12}}>{fmt(d.valor)}</span>
                </div>
              ))}
            </div>
            <div style={{background:`${mgColor(lucroOp)}10`,borderRadius:10,padding:"12px 14px",border:`1px solid ${mgColor(lucroOp)}25`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <p style={{color:C.text,fontWeight:700}}>Resultado Operacional</p>
              <p style={{color:mgColor(lucroOp),fontFamily:"monospace",fontWeight:700,fontSize:22}}>{fmt(lucroOp)}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Break-even */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
          <div>
            <p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Ponto de Equilibrio</p>
            <p style={{color:C.orange,fontSize:22,fontWeight:700,fontFamily:"monospace"}}>{fmt(breakEven)}</p>
            <p style={{color:C.muted,fontSize:12,marginTop:2}}>Fixos: {fmt(fixos)} · Margem: {pct(100-data.margemVariavel)}</p>
          </div>
          <div style={{textAlign:"right"}}>
            {breakEven<=recebido
              ?<span style={{color:C.green,fontWeight:700}}>Atingido!</span>
              :<><p style={{color:C.red,fontWeight:700,fontFamily:"monospace",fontSize:18}}>{fmt(breakEven-recebido)}</p><p style={{color:C.muted,fontSize:11}}>para equilibrar</p></>
            }
          </div>
        </div>
        <div style={{background:"#1e2030",borderRadius:99,height:10,overflow:"hidden"}}>
          <div style={{width:`${progresso}%`,height:"100%",background:progresso>=100?C.green:`linear-gradient(90deg,${C.orange},#facc15)`,borderRadius:99,transition:"width 0.5s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
          <span style={{color:C.muted,fontSize:11}}>Recebido: {fmt(recebido)} ({pct(progresso)})</span>
          <span style={{color:C.muted,fontSize:11}}>Meta: {fmt(breakEven)}</span>
        </div>
      </Card>

      {/* Saldo por banco */}
      <Card>
        <p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Saldo por Conta Bancaria</p>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {data.bancos.map(b=>{
            const saldo=calcSaldoBanco(b);
            return(
              <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.dim,borderRadius:10,padding:"10px 14px"}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:18}}>B</span>
                  <div><p style={{color:C.text,fontWeight:600,fontSize:14}}>{b.nome}</p><p style={{color:C.muted,fontSize:11}}>{b.banco}</p></div>
                </div>
                <p style={{color:saldo>=0?C.green:C.red,fontFamily:"monospace",fontWeight:700,fontSize:16}}>{fmt(saldo)}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Fluxo diario */}
      <Card>
        <p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Fluxo Diario — Abril</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={diario} margin={{top:0,right:0,left:isMobile?-28:-10,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
            <XAxis dataKey="dia" tick={{fill:C.muted,fontSize:11}}/>
            <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} tick={{fill:C.muted,fontSize:10}}/>
            <Tooltip contentStyle={TT} formatter={v=>fmt(v)}/>
            <Legend wrapperStyle={{fontSize:12}}/>
            <Bar dataKey="ent" fill={C.green} radius={[3,3,0,0]} name="Entrada"/>
            <Bar dataKey="sai" fill={C.red}   radius={[3,3,0,0]} name="Saida"/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Vendas por categoria */}
      {porCat.length>0&&<Card>
        <p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Vendas por Categoria</p>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={porCat} layout="vertical" margin={{top:0,right:8,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
            <XAxis type="number" tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} tick={{fill:C.muted,fontSize:10}}/>
            <YAxis dataKey="cat" type="category" tick={{fill:C.muted,fontSize:11}} width={60}/>
            <Tooltip contentStyle={TT} formatter={v=>fmt(v)}/>
            <Bar dataKey="val" fill={C.orange} radius={[0,4,4,0]} name="Valor"/>
          </BarChart>
        </ResponsiveContainer>
      </Card>}

      {/* Comissoes */}
      <Card>
        <p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Comissoes do Mes</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {data.vendedores.map(v=>{
            const base=data.vendas.filter(s=>s.vendedorId===v.id&&s.status==="Recebido").reduce((s,x)=>s+x.valor,0);
            return(
              <div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.dim,borderRadius:10,padding:"10px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(249,115,22,0.2)",color:C.orange,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,flexShrink:0}}>{v.nome[0]}</div>
                  <div><p style={{color:C.text,fontWeight:600,fontSize:14}}>{v.nome.split(" ")[0]}</p><p style={{color:C.muted,fontSize:11}}>{v.comissao||0}% · base {fmt(base)}</p></div>
                </div>
                <p style={{color:C.orange,fontWeight:700,fontFamily:"monospace",fontSize:16}}>{fmt(base*(v.comissao||0)/100)}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Vendas({data,setData}) {
  const isMobile  = useIsMobile();
  const [show,    setShow]    = useState(false);
  const [editId,  setEditId]  = useState(null);  // venda being edited
  const [modal,   setModal]   = useState(null);  // vendaId for payment modal
  const emptyForm = {data:"",clienteId:"",vendedorId:"",categoria:"",descricao:"",valor:"",status:"Pendente",comissaoCustom:"",custoMaterial:"",custoMaoObra:"",taxavel:true};
  const [form,    setForm]    = useState(emptyForm);
  const ff = k => v => setForm(f => ({...f,[k]:v}));

  // Comissão efetiva: custom override OR vendedor padrão
  const getComissao = (f) => {
    if (f.comissaoCustom !== "" && f.comissaoCustom !== undefined && f.comissaoCustom !== null) return +f.comissaoCustom;
    return 0;
  };
  const comissaoPreview = form.valor && getComissao(form) > 0
    ? +form.valor * getComissao(form) / 100 : 0;

  const save = () => {
    if (!form.data || !form.clienteId || !form.valor) return;
    const comissao = getComissao(form);
    const taxRate = FL_TAX_COUNTIES[data.taxCounty||DEFAULT_COUNTY] / 100;
    const salesTax = form.taxavel ? Math.round(+form.valor * taxRate2 * 100) / 100 : 0;
    const cm = +form.custoMaterial || 0;
    const co = +form.custoMaoObra  || 0;
    if (editId) {
      setData(d => ({...d, vendas: d.vendas.map(v =>
        v.id === editId
          ? {...v, data:form.data, clienteId:+form.clienteId, vendedorId:+form.vendedorId,
             categoria:form.categoria, descricao:form.descricao, valor:+form.valor,
             status:form.status, comissao, salesTax:salesTax,
             custoMaterial:cm, custoMaoObra:co, taxavel:form.taxavel}
          : v
      )}));
      setEditId(null);
    } else {
      setData(d => ({...d, vendas:[...d.vendas,
        {...form, id:uid(), clienteId:+form.clienteId, vendedorId:+form.vendedorId,
         valor:+form.valor, forma:"", bancoId:null, comissao,
         salesTax:salesTax, custoMaterial:cm, custoMaoObra:co, taxavel:form.taxavel}
      ]}));
    }
    setForm(emptyForm);
    setShow(false);
  };

  const startEdit = (v) => {
    const vend = data.vendedores.find(x => x.id === v.vendedorId);
    // If venda has a custom comissao different from vendedor default, show it
    setForm({
      data: v.data, clienteId: String(v.clienteId), vendedorId: String(v.vendedorId||""),
      categoria: v.categoria||"", descricao: v.descricao||"", valor: String(v.valor),
      status: v.status, comissaoCustom: v.comissao !== undefined ? String(v.comissao) : "",
      custoMaterial: String(v.custoMaterial||""), custoMaoObra: String(v.custoMaoObra||""),
      taxavel: v.taxavel !== false
    });
    setEditId(v.id);
    setShow(true);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const cancelEdit = () => { setEditId(null); setForm(emptyForm); setShow(false); };
  const del = id => setData(d => ({...d, vendas:d.vendas.filter(v=>v.id!==id)}));

  const total    = data.vendas.reduce((s,v) => s+v.valor, 0);
  const recebido = data.vendas.filter(v=>v.status==="Recebido").reduce((s,v)=>s+v.valor,0);
  const totalCom = data.vendas
    .filter(v => v.status==="Recebido")
    .reduce((s,v) => {
      const com = v.comissao !== undefined ? v.comissao : (data.vendedores.find(x=>x.id===v.vendedorId)?.comissao||0);
      return s + v.valor * com / 100;
    }, 0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {modal&&<PayModal title="Confirmar Recebimento" bancos={data.bancos} isIncome
        onConfirm={(forma,bancoId)=>{setData(d=>receberVenda(d,modal,forma,bancoId));setModal(null);}}
        onCancel={()=>setModal(null)}/>}

      <SectionHead title="Vendas / Pedidos" action={
        !show
          ? <Btn onClick={()=>{setEditId(null);setForm(emptyForm);setShow(true);}}>+ Nova Venda</Btn>
          : null
      }/>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Total Mês</p><p style={{color:C.orange,fontSize:15,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(total)}</p></Card>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Recebido</p><p style={{color:C.green,fontSize:15,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(recebido)}</p></Card>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Pendente</p><p style={{color:C.orange,fontSize:15,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(total-recebido)}</p></Card>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Comissões</p><p style={{color:C.purple,fontSize:15,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(totalCom)}</p></Card>
      </div>

      {/* FORM — create or edit */}
      {show && (
        <Card accent>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <p style={{color:C.text,fontWeight:700,fontSize:15,fontFamily:"Syne,sans-serif"}}>
              {editId ? "✏️ Editar Venda" : "Nova Venda"}
            </p>
            {editId && <Badge s="Pendente"/>}
          </div>
          <Grid cols={3} isMobile={isMobile} style={{marginBottom:10}}>
            <Fld label="Data *"       value={form.data}       onChange={ff("data")}       type="date"   isMobile={isMobile}/>
            <Fld label="Cliente *"    value={form.clienteId}  onChange={ff("clienteId")}  options={data.clientes.map(c=>({v:c.id,l:c.nome}))}   isMobile={isMobile}/>
            <Fld label="Vendedor"     value={form.vendedorId} onChange={v=>{ff("vendedorId")(v);ff("comissaoCustom")("");}} options={data.vendedores.map(x=>({v:x.id,l:x.nome}))} isMobile={isMobile}/>
            <Fld label="Categoria"    value={form.categoria}  onChange={ff("categoria")}  options={SIGN_CATS} isMobile={isMobile}/>
            <Fld label="Valor ($) *"  value={form.valor}      onChange={ff("valor")}      type="number" isMobile={isMobile}/>
            <Fld label="Status"            value={form.status}       onChange={ff("status")}       options={["Pendente","Recebido"]} isMobile={isMobile}/>
            <Fld label="Custo Material ($)" value={form.custoMaterial} onChange={ff("custoMaterial")} type="number" isMobile={isMobile}/>
            <Fld label="Custo Mao de Obra ($)" value={form.custoMaoObra}  onChange={ff("custoMaoObra")}  type="number" isMobile={isMobile}/>
            <Fld label="Descricao"         value={form.descricao}    onChange={ff("descricao")}    span isMobile={isMobile}/>
          </Grid>

          {/* SALES TAX FL */}
          <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:12,marginBottom:12}}>
            <p style={{color:C.blue,fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Florida Sales Tax</p>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:10,alignItems:"end"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <input type="checkbox" checked={form.taxavel} onChange={e=>setForm(f=>({...f,taxavel:e.target.checked}))}
                  style={{width:18,height:18,cursor:"pointer",accentColor:C.blue}}/>
                <label style={{color:C.text,fontSize:14,cursor:"pointer"}}>Aplicar Sales Tax</label>
              </div>
              <Fld label="County" value={data.taxCounty||DEFAULT_COUNTY} onChange={v=>setData(d=>({...d,taxCounty:v}))}
                options={Object.entries(FL_TAX_COUNTIES).map(([k,v])=>({v:k,l:`${k} — ${v}%`}))} isMobile={isMobile}/>
              <div style={{background:"rgba(59,130,246,0.1)",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(59,130,246,0.25)"}}>
                <p style={{color:C.muted,fontSize:11,textTransform:"uppercase"}}>Sales Tax calculado</p>
                <p style={{color:C.blue,fontFamily:"monospace",fontWeight:700,fontSize:18,marginTop:4}}>
                  {form.taxavel && form.valor ? fmt(+form.valor * (FL_TAX_COUNTIES[data.taxCounty||DEFAULT_COUNTY]/100)) : fmt(0)}
                </p>
                <p style={{color:C.muted,fontSize:11,marginTop:2}}>
                  {FL_TAX_COUNTIES[data.taxCounty||DEFAULT_COUNTY]}% de {fmt(+form.valor||0)}
                </p>
              </div>
            </div>
          </div>

          {/* MARGEM PREVIEW */}
          {(form.valor && (+form.custoMaterial > 0 || +form.custoMaoObra > 0)) && (() => {
            const val = +form.valor, cm = +form.custoMaterial||0, co = +form.custoMaoObra||0;
            const lucro = val - cm - co;
            const margem = val > 0 ? (lucro/val*100) : 0;
            const color = margem >= 40 ? C.green : margem >= 25 ? C.yellow : C.red;
            return (
              <div style={{background:`${color}10`,border:`1px solid ${color}30`,borderRadius:12,padding:12,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div>
                  <p style={{color:C.muted,fontSize:11,textTransform:"uppercase"}}>Margem Bruta desta venda</p>
                  <p style={{color,fontFamily:"monospace",fontWeight:700,fontSize:22,marginTop:2}}>{pct(margem)}</p>
                </div>
                <div style={{display:"flex",gap:16}}>
                  <div style={{textAlign:"right"}}><p style={{color:C.muted,fontSize:11}}>Custo total</p><p style={{color:C.red,fontFamily:"monospace",fontWeight:700}}>{fmt(cm+co)}</p></div>
                  <div style={{textAlign:"right"}}><p style={{color:C.muted,fontSize:11}}>Lucro bruto</p><p style={{color,fontFamily:"monospace",fontWeight:700}}>{fmt(lucro)}</p></div>
                </div>
              </div>
            );
          })()}

          {/* COMISSAO SECTION */}
          <div style={{background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:12,marginBottom:12}}>
            <p style={{color:C.purple,fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>💜 Comissão</p>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,alignItems:"end"}}>


              <div>
                <p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Comissão (%)</p>
                <div style={{position:"relative"}}>
                  <input
                    type="number" step="0.1" min="0" max="100"
                    value={form.comissaoCustom}
                    onChange={e=>ff("comissaoCustom")(e.target.value)}
                    placeholder="Ex: 7.5"
                    style={{background:C.bg,border:`1px solid ${form.comissaoCustom?"rgba(168,85,247,0.6)":C.border}`,borderRadius:8,padding:"10px 32px 10px 12px",color:C.text,fontSize:15,width:"100%",outline:"none",fontFamily:"inherit"}}
                  />
                  <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:C.muted,fontSize:13}}>%</span>
                </div>

              </div>
              {/* Preview */}
              <div style={{background:"rgba(168,85,247,0.1)",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(168,85,247,0.25)"}}>
                <p style={{color:C.muted,fontSize:11,textTransform:"uppercase"}}>Comissão calculada</p>
                <p style={{color:C.purple,fontFamily:"monospace",fontWeight:700,fontSize:20,marginTop:4}}>
                  {form.valor && +form.valor > 0 ? fmt(comissaoPreview) : "—"}
                </p>
                {form.valor && +form.valor > 0 && (
                  <p style={{color:C.muted,fontSize:11,marginTop:2}}>
                    {pct(getComissao(form))} de {fmt(+form.valor)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div style={{display:"flex",gap:8}}>
            <Btn onClick={save}>{editId ? "Salvar Alterações" : "Salvar Venda"}</Btn>
            <Btn v="ghost" onClick={cancelEdit}>Cancelar</Btn>
          </div>
        </Card>
      )}

      {/* VENDAS LIST */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {data.vendas.map(v => {
          const cli   = data.clientes.find(c=>c.id===v.clienteId);
          const vend  = data.vendedores.find(x=>x.id===v.vendedorId);
          const banco = data.bancos.find(b=>b.id===v.bancoId);
          const comPct  = v.comissao !== undefined ? v.comissao : (vend?.comissao||0);
          const comVal  = v.valor * comPct / 100;
          const isEditing = editId === v.id;

          return (
            <Card key={v.id} style={{borderColor: isEditing ? C.orange : C.border}}>
              {/* Top row */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{flex:1,minWidth:0,paddingRight:12}}>
                  <p style={{color:C.text,fontWeight:600,fontSize:15}}>{cli?.nome||"—"}</p>
                  <p style={{color:C.muted,fontSize:13,marginTop:2}}>{v.descricao||"—"}</p>
                  <p style={{color:C.muted,fontSize:12,marginTop:2}}>
                    {vend?.nome?.split(" ")[0]||"—"} · {v.data}
                    {v.forma && <> · {FORMA_ICON[v.forma]||""} {v.forma}</>}
                    {banco  && <> · 🏦 {banco.nome}</>}
                  </p>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <p style={{color:C.text,fontWeight:700,fontFamily:"monospace",fontSize:18}}>{fmt(v.valor)}</p>
                  {v.categoria && <p style={{color:C.orange,fontSize:11,marginTop:2}}>{v.categoria}</p>}
                </div>
              </div>

              {/* Comissão row */}
              <div style={{background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:14}}>💜</span>
                  <span style={{color:C.muted,fontSize:12}}>{vend?.nome?.split(" ")[0]||"—"}</span>
                  <span style={{background:"rgba(168,85,247,0.15)",color:C.purple,borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:600}}>
                    {comPct}%
                  </span>
                </div>
                <span style={{color:C.purple,fontFamily:"monospace",fontWeight:700,fontSize:14}}>
                  {v.status==="Recebido" ? fmt(comVal) : <span style={{color:C.muted}}>Pendente</span>}
                </span>
              </div>

              {/* Margin + Tax row */}
              {(v.custoMaterial > 0 || v.custoMaoObra > 0) && (() => {
                const custo = (v.custoMaterial||0) + (v.custoMaoObra||0);
                const lucro = v.valor - custo;
                const mg    = v.valor > 0 ? (lucro/v.valor*100) : 0;
                const mgColor = mg >= 40 ? C.green : mg >= 25 ? C.yellow : C.red;
                return (
                  <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,background:`${mgColor}10`,borderRadius:8,padding:"6px 10px",border:`1px solid ${mgColor}25`}}>
                      <p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Margem</p>
                      <p style={{color:mgColor,fontFamily:"monospace",fontWeight:700,fontSize:14}}>{pct(mg)}</p>
                    </div>
                    <div style={{flex:1,background:`${C.red}10`,borderRadius:8,padding:"6px 10px",border:`1px solid ${C.red}25`}}>
                      <p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Custo</p>
                      <p style={{color:C.red,fontFamily:"monospace",fontWeight:700,fontSize:14}}>{fmt(custo)}</p>
                    </div>
                    <div style={{flex:1,background:`${C.green}10`,borderRadius:8,padding:"6px 10px",border:`1px solid ${C.green}25`}}>
                      <p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Lucro</p>
                      <p style={{color:C.green,fontFamily:"monospace",fontWeight:700,fontSize:14}}>{fmt(lucro)}</p>
                    </div>
                    {v.taxavel && v.salesTax > 0 && (
                      <div style={{flex:1,background:"rgba(59,130,246,0.1)",borderRadius:8,padding:"6px 10px",border:"1px solid rgba(59,130,246,0.25)"}}>
                        <p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Sales Tax</p>
                        <p style={{color:C.blue,fontFamily:"monospace",fontWeight:700,fontSize:14}}>{fmt(v.salesTax)}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Actions */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <Badge s={v.status}/>
                <div style={{display:"flex",gap:6}}>
                  {v.status==="Pendente" && <Btn v="green" size="sm" onClick={()=>setModal(v.id)}>✓ Receber</Btn>}
                  <Btn v="ghost" size="sm" onClick={()=>startEdit(v)}>✏️ Editar</Btn>
                  <Btn v="danger" size="sm" onClick={()=>del(v.id)}>✕</Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


/* =
   FLUXO DE CAIXA
= */
function FluxoCaixa({data,setData}) {
  const isMobile=useIsMobile();
  const [tab,setTab]=useState("lancamentos");
  const [mes,setMes]=useState("2026-04");
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({data:"",descricao:"",tipo:"entrada",valor:"",categoria:"Venda",forma:"",bancoId:""});
  const ff=k=>v=>setForm(f=>({...f,[k]:v}));

  const save=()=>{
    if(!form.data||!form.descricao||!form.valor) return;
    const tx={...form,id:uid(),valor:+form.valor,bancoId:form.bancoId?+form.bancoId:null};
    const bancoTx={id:uid(),data:form.data,descricao:form.descricao,tipo:form.tipo,valor:+form.valor,forma:form.forma};
    setData(d=>({
      ...d,
      caixa:[...d.caixa,tx],
      bancos: form.bancoId ? (form.tipo==="entrada" ? creditarBanco(d.bancos,+form.bancoId,bancoTx) : debitarBanco(d.bancos,+form.bancoId,bancoTx)) : d.bancos,
    }));
    setForm({data:"",descricao:"",tipo:"entrada",valor:"",categoria:"Venda",forma:"",bancoId:""});
    setShow(false);
  };
  const del=id=>setData(d=>({...d,caixa:d.caixa.filter(c=>c.id!==id)}));

  const sorted=[...data.caixa].sort((a,b)=>a.data.localeCompare(b.data));
  let acc=0;
  const rows=sorted.map(c=>{acc+=c.tipo==="entrada"?c.valor:-c.valor;return{...c,saldo:acc};});
  const totalE=data.caixa.filter(c=>c.tipo==="entrada").reduce((s,c)=>s+c.valor,0);
  const totalS=data.caixa.filter(c=>c.tipo==="saida").reduce((s,c)=>s+c.valor,0);

  const diasMap={};
  sorted.filter(c=>c.data.startsWith(mes)).forEach(c=>{
    if(!diasMap[c.data]) diasMap[c.data]={data:c.data,entrada:0,saida:0,itens:[]};
    if(c.tipo==="entrada") diasMap[c.data].entrada+=c.valor; else diasMap[c.data].saida+=c.valor;
    diasMap[c.data].itens.push(c);
  });
  let sd=0;
  const diario=Object.values(diasMap).map(d=>{sd+=d.entrada-d.saida;return{...d,saldoDia:sd};});

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <SectionHead title="Fluxo de Caixa" action={<Btn onClick={()=>setShow(!show)}>+ Lançamento</Btn>}/>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Entradas</p><p style={{color:C.green,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(totalE)}</p></Card>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Saídas</p><p style={{color:C.red,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(totalS)}</p></Card>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Saldo</p><p style={{color:(totalE-totalS)>=0?C.green:C.red,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(totalE-totalS)}</p></Card>
      </div>

      <Tabs tabs={[["lancamentos","= Lançamentos"],["diario","~ Diário"],["grafico","^ Gráfico"]]} active={tab} onChange={setTab}/>

      {show&&(
        <Card accent>
          <p style={{color:C.text,fontWeight:700,marginBottom:12,fontFamily:"Syne,sans-serif"}}>Novo Lançamento</p>
          <Grid cols={3} isMobile={isMobile} style={{marginBottom:10}}>
            <Fld label="Data *"        value={form.data}       onChange={ff("data")}      type="date" isMobile={isMobile}/>
            <Fld label="Tipo"          value={form.tipo}       onChange={ff("tipo")}      options={[{v:"entrada",l:"▲ Entrada"},{v:"saida",l:"▼ Saída"}]} isMobile={isMobile}/>
            <Fld label="Categoria"     value={form.categoria}  onChange={ff("categoria")} options={EXP_CATS} isMobile={isMobile}/>
            <Fld label="Valor ($) *"   value={form.valor}      onChange={ff("valor")}     type="number" isMobile={isMobile}/>
            <Fld label="Forma Pgto"    value={form.forma}      onChange={ff("forma")}     options={FORMAS.map(f=>({v:f,l:FORMA_ICON[f]+" "+f}))} isMobile={isMobile}/>
            <Fld label="Banco"         value={form.bancoId}    onChange={ff("bancoId")}   options={data.bancos.map(b=>({v:b.id,l:`${b.nome} (${fmt(calcSaldoBanco(b))})`}))} isMobile={isMobile}/>
            <Fld label="Descrição *"   value={form.descricao}  onChange={ff("descricao")} span isMobile={isMobile}/>
          </Grid>
          <div style={{display:"flex",gap:8}}><Btn onClick={save}>Salvar</Btn><Btn v="ghost" onClick={()=>setShow(false)}>Cancelar</Btn></div>
        </Card>
      )}

      {tab==="lancamentos"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {rows.map(c=>{
            const banco=data.bancos.find(b=>b.id===c.bancoId);
            return(
              <Card key={c.id} style={{padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0,paddingRight:10}}>
                    <p style={{color:C.text,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.descricao}</p>
                    <p style={{color:C.muted,fontSize:12,marginTop:2}}>
                      {c.data} · {c.categoria}
                      {c.forma&&<> · {FORMA_ICON[c.forma]||""} {c.forma}</>}
                      {banco&&<> · 🏦 {banco.nome}</>}
                    </p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{color:c.tipo==="entrada"?C.green:C.red,fontWeight:700,fontFamily:"monospace",fontSize:15}}>{c.tipo==="entrada"?"+":"-"}{fmt(c.valor)}</p>
                    <p style={{color:C.muted,fontSize:11,marginTop:1}}>saldo: {fmt(c.saldo)}</p>
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:8,alignItems:"center"}}>
                  <span style={{background:c.tipo==="entrada"?`${C.green}20`:`${C.red}20`,color:c.tipo==="entrada"?C.green:C.red,border:`1px solid ${c.tipo==="entrada"?C.green:C.red}40`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600}}>
                    {c.tipo==="entrada"?"▲ Entrada":"▼ Saída"}
                  </span>
                  <Btn v="danger" size="sm" onClick={()=>del(c.id)}>✕</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab==="diario"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Fld label="Filtrar por mês" value={mes} onChange={setMes} type="month"/>
          <Card style={{padding:0,overflow:"hidden"}}>
            {diario.length===0&&<p style={{color:C.muted,fontSize:14,textAlign:"center",padding:24}}>Nenhum lançamento neste mês.</p>}
            {diario.map(d=>(
              <div key={d.data}>
                <div style={{background:C.dim,padding:"10px 14px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                  <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{color:C.text,fontWeight:700,fontSize:13}}>{d.data}</span>
                    <span style={{color:C.green,fontSize:12,fontFamily:"monospace"}}>+{fmt(d.entrada)}</span>
                    <span style={{color:C.red,fontSize:12,fontFamily:"monospace"}}>-{fmt(d.saida)}</span>
                  </div>
                  <span style={{color:(d.entrada-d.saida)>=0?C.green:C.red,fontFamily:"monospace",fontWeight:700,fontSize:13}}>
                    {fmt(d.entrada-d.saida)}<span style={{color:C.muted,fontWeight:400,fontSize:11}}> acum: {fmt(d.saldoDia)}</span>
                  </span>
                </div>
                {d.itens.map(item=>{
                  const banco=data.bancos.find(b=>b.id===item.bancoId);
                  return(
                    <div key={item.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 20px",borderBottom:`1px solid ${C.dim}`,alignItems:"center"}}>
                      <div style={{display:"flex",gap:8,flex:1,minWidth:0,alignItems:"center"}}>
                        <span style={{color:item.tipo==="entrada"?C.green:C.red,fontSize:14}}>{item.tipo==="entrada"?"▲":"▼"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{color:C.muted,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.descricao}</p>
                          {(item.forma||banco)&&<p style={{color:`${C.muted}99`,fontSize:11}}>{item.forma&&`${FORMA_ICON[item.forma]||""} ${item.forma}`}{banco&&` · 🏦 ${banco.nome}`}</p>}
                        </div>
                      </div>
                      <span style={{color:item.tipo==="entrada"?C.green:C.red,fontFamily:"monospace",fontSize:13,fontWeight:600,flexShrink:0,marginLeft:8}}>{fmt(item.valor)}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab==="grafico"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card>
            <p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Entradas e Saídas por Dia</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={diario} margin={{top:0,right:0,left:isMobile?-28:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
                <XAxis dataKey="data" tick={{fill:C.muted,fontSize:10}}/>
                <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} tick={{fill:C.muted,fontSize:10}}/>
                <Tooltip contentStyle={TT} formatter={v=>fmt(v)}/>
                <Legend wrapperStyle={{fontSize:12}}/>
                <Bar dataKey="entrada" fill={C.green} radius={[3,3,0,0]} name="Entrada"/>
                <Bar dataKey="saida"   fill={C.red}   radius={[3,3,0,0]} name="Saída"/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Saldo Acumulado</p>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={diario.map(d=>({...d,saldo:d.saldoDia}))} margin={{top:0,right:0,left:isMobile?-28:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
                <XAxis dataKey="data" tick={{fill:C.muted,fontSize:10}}/>
                <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} tick={{fill:C.muted,fontSize:10}}/>
                <Tooltip contentStyle={TT} formatter={v=>fmt(v)}/>
                <ReferenceLine y={0} stroke={C.muted} strokeDasharray="4 4"/>
                <Area type="monotone" dataKey="saldo" stroke={C.blue} fill={`${C.blue}20`} name="Saldo"/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  );
}

/* =
   CONTAS
= */
function Contas({data,setData}) {
  const isMobile=useIsMobile();
  const [tab,setTab]=useState("receber");
  const [show,setShow]=useState(false);
  const [modal,setModal]=useState(null); // {id, tipo: "receber"|"pagar"}
  const [form,setForm]=useState({clienteId:"",fornecedor:"",descricao:"",valor:"",vencimento:""});
  const ff=k=>v=>setForm(f=>({...f,[k]:v}));

  const isR=tab==="receber";
  const key=isR?"contasReceber":"contasPagar";
  const list=data[key];
  const aberto=list.filter(c=>c.status==="Aberto").reduce((s,c)=>s+c.valor,0);
  const vencido=list.filter(c=>c.status==="Vencido").reduce((s,c)=>s+c.valor,0);

  const save=()=>{
    const ok=isR?form.clienteId:form.fornecedor;
    if(!ok||!form.valor||!form.vencimento) return;
    const item=isR
      ?{id:uid(),clienteId:parseInt(form.clienteId),descricao:form.descricao,valor:+form.valor,vencimento:form.vencimento,status:"Aberto"}
      :{id:uid(),fornecedor:form.fornecedor,descricao:form.descricao,valor:+form.valor,vencimento:form.vencimento,status:"Aberto"};
    setData(d=>({...d,[key]:[...d[key],item]}));
    setForm({clienteId:"",fornecedor:"",descricao:"",valor:"",vencimento:""});
    setShow(false);
  };
  const del=id=>setData(d=>({...d,[key]:d[key].filter(c=>c.id!==id)}));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {modal&&<PayModal
        title={modal.tipo==="receber"?"Confirmar Recebimento":"Confirmar Pagamento"}
        bancos={data.bancos} isIncome={modal.tipo==="receber"}
        onConfirm={(forma,bancoId)=>{
          setData(d=>modal.tipo==="receber"?pagarContaReceber(d,modal.id,forma,bancoId):pagarContaPagar(d,modal.id,forma,bancoId));
          setModal(null);
        }}
        onCancel={()=>setModal(null)}/>}

      <SectionHead title="Contas" action={<Btn onClick={()=>setShow(!show)}>+ Adicionar</Btn>}/>

      <Tabs tabs={[["receber","+ A Receber"],["pagar","- A Pagar"]]} active={tab} onChange={setTab}/>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Em Aberto</p><p style={{color:isR?C.blue:C.red,fontSize:18,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(aberto)}</p></Card>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Vencidas</p><p style={{color:C.red,fontSize:18,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(vencido)}</p></Card>
      </div>

      {show&&(
        <Card accent>
          <p style={{color:C.text,fontWeight:700,marginBottom:12,fontFamily:"Syne,sans-serif"}}>{isR?"Nova Conta a Receber":"Nova Conta a Pagar"}</p>
          <Grid cols={3} isMobile={isMobile} style={{marginBottom:10}}>
            {isR
              ?<Fld label="Cliente *"    value={form.clienteId}  onChange={ff("clienteId")}  options={data.clientes.map(c=>({v:c.id,l:c.nome}))} isMobile={isMobile}/>
              :<Fld label="Fornecedor *" value={form.fornecedor} onChange={ff("fornecedor")} isMobile={isMobile}/>
            }
            <Fld label="Valor ($) *"  value={form.valor}      onChange={ff("valor")}      type="number" isMobile={isMobile}/>
            <Fld label="Vencimento *" value={form.vencimento} onChange={ff("vencimento")} type="date" isMobile={isMobile}/>
            <Fld label="Descrição"    value={form.descricao}  onChange={ff("descricao")}  span isMobile={isMobile}/>
          </Grid>
          <div style={{display:"flex",gap:8}}><Btn onClick={save}>Salvar</Btn><Btn v="ghost" onClick={()=>setShow(false)}>Cancelar</Btn></div>
        </Card>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {list.map(c=>{
          const nome=isR?data.clientes.find(x=>x.id===c.clienteId)?.nome:c.fornecedor;
          return(
            <Card key={c.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <p style={{color:C.text,fontWeight:600}}>{nome}</p>
                  <p style={{color:C.muted,fontSize:13,marginTop:2}}>{c.descricao}</p>
                  <p style={{color:C.muted,fontSize:12,marginTop:2}}>Vence: <span style={{color:c.status==="Vencido"?C.red:C.muted}}>{c.vencimento}</span></p>
                </div>
                <p style={{color:C.text,fontWeight:700,fontFamily:"monospace",fontSize:18}}>{fmt(c.valor)}</p>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <Badge s={c.status}/>
                <div style={{display:"flex",gap:6}}>
                  {c.status==="Aberto"&&(
                    <Btn v={isR?"green":"primary"} size="sm"
                      onClick={()=>setModal({id:c.id,tipo:isR?"receber":"pagar"})}>
                      {isR?"✓ Marcar Recebido":"✓ Marcar Pago"}
                    </Btn>
                  )}
                  {c.status!=="Aberto"&&<Btn v="ghost" size="sm" onClick={()=>setData(d=>({...d,[key]:d[key].map(x=>x.id===c.id?{...x,status:"Aberto"}:x)}))}>Reabrir</Btn>}
                  <Btn v="danger" size="sm" onClick={()=>del(c.id)}>✕</Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* =
   COMISSÕES
= */
function Comissoes({data,setData}) {
  const isMobile = useIsMobile();
  const [modal, setModal]   = useState(null); // vendedorId to pay
  const [showHist, setShowHist] = useState(null); // vendedorId history
  const [forma, setForma]   = useState("");
  const [bancoId, setBancoId] = useState("");
  const [obs, setObs]       = useState("");

  const comissoesPagas = data.comissoesPagas || [];

  const pagarComissao = (vendedor, valor) => {
    if (!forma || !bancoId) return;
    const tx = { id:uid(), vendedorId:vendedor.id, valor, data:now(), bancoId:+bancoId, forma, obs };
    const bancoTx = { id:uid(), data:now(), descricao:`Comissão — ${vendedor.nome}`, tipo:"saida", valor, forma };
    const caixaTx = { id:uid(), data:now(), descricao:`Comissão ${vendedor.nome}`, tipo:"saida", valor, categoria:"Salaries", forma, bancoId:+bancoId };
    setData(d => ({
      ...d,
      comissoesPagas: [...(d.comissoesPagas||[]), tx],
      bancos: debitarBanco(d.bancos, +bancoId, bancoTx),
      caixa:  [...d.caixa, caixaTx],
    }));
    setModal(null); setForma(""); setBancoId(""); setObs("");
  };

  const totalGeral = data.vendedores.reduce((s,v) => {
    const base = data.vendas.filter(x => x.vendedorId===v.id && x.status==="Recebido").reduce((a,x) => a+x.valor, 0);
    return s + base * v.comissao / 100;
  }, 0);
  const totalPago = comissoesPagas.reduce((s,c) => s+c.valor, 0);
  const totalPendente = totalGeral - totalPago;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <SectionHead title="Comissões de Vendedores"/>

      {/* Modal pagar comissão */}
      {modal && (() => {
        const v = data.vendedores.find(x => x.id === modal.vendedorId);
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}}>
            <Card style={{width:"100%",maxWidth:420,padding:20}} accent>
              <p style={{color:C.text,fontWeight:700,fontSize:16,marginBottom:4,fontFamily:"Syne,sans-serif"}}>Pagar Comissão</p>
              <p style={{color:C.muted,fontSize:13,marginBottom:14}}>{v?.nome} — <span style={{color:C.orange,fontWeight:700,fontFamily:"monospace"}}>{fmt(modal.valor)}</span></p>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                <Fld label="Forma de Pagamento *" value={forma} onChange={setForma} options={FORMAS.map(f=>({v:f,l:FORMA_ICON[f]+" "+f}))}/>
                <Fld label="Debitar do Banco *" value={bancoId} onChange={setBancoId}
                  options={data.bancos.map(b=>({v:b.id,l:`${b.nome} — ${fmt(calcSaldoBanco(b))}`}))}/>
                <Fld label="Observação (opcional)" value={obs} onChange={setObs}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={()=>pagarComissao(v,modal.valor)} disabled={!forma||!bancoId} v="primary">✓ Confirmar Pagamento</Btn>
                <Btn v="ghost" onClick={()=>{setModal(null);setForma("");setBancoId("");setObs("");}}>Cancelar</Btn>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Totais */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Total a Pagar</p><p style={{color:C.orange,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(totalGeral)}</p></Card>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Já Pago</p><p style={{color:C.green,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(totalPago)}</p></Card>
        <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Pendente</p><p style={{color:totalPendente>0?C.red:C.green,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(totalPendente)}</p></Card>
      </div>

      {/* Por vendedor */}
      {data.vendedores.map(v => {
        const todasVendas   = data.vendas.filter(s => s.vendedorId === v.id);
        const vendasReceb   = todasVendas.filter(s => s.status === "Recebido");
        const base          = vendasReceb.reduce((s,x) => s+x.valor, 0);
        const comTotal      = base * v.comissao / 100;
        const jaPago        = comissoesPagas.filter(c => c.vendedorId === v.id).reduce((s,c) => s+c.valor, 0);
        const saldoCom      = comTotal - jaPago;
        const histVendedor  = comissoesPagas.filter(c => c.vendedorId === v.id);
        const isOpen        = showHist === v.id;

        return (
          <Card key={v.id} style={{borderColor:`${C.orange}30`}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(249,115,22,0.2)",color:C.orange,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18,flexShrink:0}}>{v.nome[0]}</div>
              <div style={{flex:1}}>
                <p style={{color:C.text,fontWeight:700,fontSize:16}}>{v.nome}</p>
                <p style={{color:C.muted,fontSize:12}}>{v.comissao}% comissão · {v.email}</p>
              </div>
            </div>

            {/* Stats */}
            <div style={{display:"flex",flexDirection:"column",gap:0,marginBottom:12}}>
              {[
                ["Pedidos totais",    todasVendas.length,                         C.text],
                ["Vendas recebidas",  vendasReceb.length,                         C.text],
                ["Volume recebido",   fmt(base),                                   C.text],
                ["Comissão gerada",   fmt(comTotal),                               C.orange],
                ["Já pago",           fmt(jaPago),                                 C.green],
              ].map(([l,val,color]) => (
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.dim}`}}>
                  <span style={{color:C.muted,fontSize:13}}>{l}</span>
                  <span style={{color,fontSize:13,fontWeight:600}}>{val}</span>
                </div>
              ))}
            </div>

            {/* Saldo + botão pagar */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:saldoCom>0?"rgba(249,115,22,0.08)":"rgba(34,197,94,0.08)",borderRadius:10,padding:"12px 14px",marginBottom:12,border:`1px solid ${saldoCom>0?"rgba(249,115,22,0.2)":"rgba(34,197,94,0.2)"}`}}>
              <div>
                <p style={{color:C.muted,fontSize:11,textTransform:"uppercase"}}>Saldo a Pagar</p>
                <p style={{color:saldoCom>0?C.orange:C.green,fontWeight:700,fontFamily:"monospace",fontSize:22}}>{fmt(saldoCom)}</p>
              </div>
              {saldoCom > 0 && (
                <Btn v="primary" onClick={()=>setModal({vendedorId:v.id,valor:saldoCom})}>
                  $ Pagar {fmt(saldoCom)}
                </Btn>
              )}
              {saldoCom <= 0 && <span style={{color:C.green,fontWeight:700,fontSize:13}}>✓ Em dia</span>}
            </div>

            {/* Vendas recebidas detalhadas */}
            {vendasReceb.length > 0 && (
              <div style={{marginBottom:10}}>
                <p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Vendas que geram comissão</p>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {vendasReceb.map(s => {
                    const cli   = data.clientes.find(c => c.id === s.clienteId);
                    const banco = data.bancos.find(b => b.id === s.bancoId);
                    return (
                      <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:C.dim,borderRadius:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{color:C.text,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.descricao}</p>
                          <p style={{color:`${C.muted}99`,fontSize:11}}>
                            {cli?.nome||"—"} · {s.data}
                            {s.forma&&` · ${FORMA_ICON[s.forma]||""} ${s.forma}`}
                            {banco&&` · 🏦 ${banco.nome}`}
                          </p>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                          <p style={{color:C.green,fontFamily:"monospace",fontWeight:700,fontSize:12}}>{fmt(s.valor*v.comissao/100)}</p>
                          <p style={{color:`${C.muted}88`,fontSize:10}}>{pct(v.comissao)} de {fmt(s.valor)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Histórico de pagamentos */}
            {histVendedor.length > 0 && (
              <div>
                <button onClick={()=>setShowHist(isOpen?null:v.id)}
                  style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",padding:"4px 0",marginBottom:isOpen?8:0}}>
                  {isOpen?"▲ Ocultar":"▼ Ver"} histórico de pagamentos ({histVendedor.length})
                </button>
                {isOpen && (
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {histVendedor.map(h => {
                      const banco = data.bancos.find(b => b.id === h.bancoId);
                      return (
                        <div key={h.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:`${C.green}10`,borderRadius:8,border:`1px solid ${C.green}20`}}>
                          <div>
                            <p style={{color:C.text,fontSize:12}}>Pagamento realizado · {h.data}</p>
                            <p style={{color:`${C.muted}99`,fontSize:11}}>
                              {FORMA_ICON[h.forma]||""} {h.forma}
                              {banco&&` · 🏦 ${banco.nome}`}
                              {h.obs&&` · ${h.obs}`}
                            </p>
                          </div>
                          <p style={{color:C.green,fontFamily:"monospace",fontWeight:700,fontSize:13,flexShrink:0,marginLeft:8}}>{fmt(h.valor)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}


/* CADASTROS */
function Cadastros({data,setData}) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("receitas");

  // form states
  const [showC,  setShowC]  = useState(false);
  const [showV,  setShowV]  = useState(false);
  const [showD,  setShowD]  = useState(false);
  const [showR,  setShowR]  = useState(false);
  const [showB,  setShowB]  = useState(false);
  const [showTR, setShowTR] = useState(false);

  // edit states
  const [editC,  setEditC]  = useState(null);
  const [editV,  setEditV]  = useState(null);
  const [editD,  setEditD]  = useState(null);
  const [editR,  setEditR]  = useState(null);

  const emptyC = {nome:"",email:"",phone:"",cidade:""};
  const emptyV = {nome:"",email:"",comissao:5};
  const emptyD = {descricao:"",valor:"",tipo:"Fixo"};
  const emptyR = {descricao:"",valor:"",conheceu:"",perfil:"",categoria:"Venda",obs:""};
  const emptyB = {nome:"",banco:"",routing:"",account:"",tipo:"Checking",saldoInicial:""};
  const emptyTR = {de:"",para:"",valor:"",data:now(),descricao:""};

  const [fC,  setFC]  = useState(emptyC);
  const [fV,  setFV]  = useState(emptyV);
  const [fD,  setFD]  = useState(emptyD);
  const [fR,  setFR]  = useState(emptyR);
  const [fB,  setFB]  = useState(emptyB);
  const [fTR, setFTR] = useState(emptyTR);

  const COMO_CONHECEU = ["Carteira de Clientes","Web","Indicacao","Walk-in","Prospeccao"];
const PERFIL_CLIENTE = ["Cliente Final","Contractor","Revenda"];
  const CATS_RECEITA  = ["Venda de Serviço","Venda de Material","Manutenção","Consultoria","Outros"];

  // CLIENTES
  const saveC = () => {
    if (!fC.nome) return;
    if (editC) {
      setData(d => ({...d, clientes: d.clientes.map(c => c.id===editC ? {...c,...fC} : c)}));
      setEditC(null);
    } else {
      setData(d => ({...d, clientes: [...d.clientes, {...fC, id:uid()}]}));
    }
    setFC(emptyC); setShowC(false);
  };
  const startEditC = c => { setFC({nome:c.nome,email:c.email||"",phone:c.phone||"",cidade:c.cidade||""}); setEditC(c.id); setShowC(true); };
  const delC = id => setData(d => ({...d, clientes: d.clientes.filter(c => c.id !== id)}));

  // VENDEDORES
  const saveV = () => {
    if (!fV.nome) return;
    if (editV) {
      setData(d => ({...d, vendedores: d.vendedores.map(v => v.id===editV ? {...v,...fV,comissao:+fV.comissao} : v)}));
      setEditV(null);
    } else {
      setData(d => ({...d, vendedores: [...d.vendedores, {...fV, id:uid(), comissao:+fV.comissao}]}));
    }
    setFV(emptyV); setShowV(false);
  };
  const startEditV = v => { setFV({nome:v.nome,email:v.email||"",comissao:v.comissao}); setEditV(v.id); setShowV(true); };
  const delV = id => setData(d => ({...d, vendedores: d.vendedores.filter(v => v.id !== id)}));

  // DESPESAS
  const saveD = () => {
    if (!fD.descricao || !fD.valor) return;
    if (editD) {
      setData(d => ({...d, despesas: d.despesas.map(x => x.id===editD ? {...x,...fD,valor:+fD.valor} : x)}));
      setEditD(null);
    } else {
      setData(d => ({...d, despesas: [...d.despesas, {...fD, id:uid(), valor:+fD.valor}]}));
    }
    setFD(emptyD); setShowD(false);
  };
  const startEditD = d => { setFD({descricao:d.descricao,valor:String(d.valor),tipo:d.tipo||"Fixo"}); setEditD(d.id); setShowD(true); };
  const delD = id => setData(d => ({...d, despesas: d.despesas.filter(x => x.id !== id)}));

  // RECEITAS
  const receitas = data.receitas || [];
  const saveR = () => {
    if (!fR.descricao || !fR.valor) return;
    if (editR) {
      setData(d => ({...d, receitas: (d.receitas||[]).map(x => x.id===editR ? {...x,...fR,valor:+fR.valor} : x)}));
      setEditR(null);
    } else {
      setData(d => ({...d, receitas: [...(d.receitas||[]), {...fR, id:uid(), valor:+fR.valor}]}));
    }
    setFR(emptyR); setShowR(false);
  };
  const startEditR = r => { setFR({descricao:r.descricao,valor:String(r.valor),conheceu:r.conheceu||"",perfil:r.perfil||"",categoria:r.categoria||"Venda",obs:r.obs||""}); setEditR(r.id); setShowR(true); };
  const delR = id => setData(d => ({...d, receitas: (d.receitas||[]).filter(x => x.id !== id)}));

  // BANCOS
  const addB = () => {
    if (!fB.nome || !fB.banco) return;
    setData(d => ({...d, bancos:[...d.bancos,{...fB,id:uid(),saldoInicial:+fB.saldoInicial||0,transacoes:[]}]}));
    setFB(emptyB); setShowB(false);
  };
  const delB = id => setData(d => ({...d, bancos: d.bancos.filter(b => b.id !== id)}));
  const doTR = () => {
    if (!fTR.de||!fTR.para||!fTR.valor||fTR.de===fTR.para) return;
    const val=+fTR.valor;
    const desc=fTR.descricao||"Transferência entre contas";
    setData(d=>({
      ...d,
      bancos:d.bancos.map(b=>{
        if(b.id===+fTR.de)   return{...b,transacoes:[...(b.transacoes||[]),{id:uid(),data:fTR.data,descricao:desc+" (saída)", tipo:"saida",  valor:val,forma:"Transferência"}]};
        if(b.id===+fTR.para) return{...b,transacoes:[...(b.transacoes||[]),{id:uid(),data:fTR.data,descricao:desc+" (entrada)",tipo:"entrada",valor:val,forma:"Transferência"}]};
        return b;
      }),
      caixa:[...d.caixa,
        {id:uid(),data:fTR.data,descricao:`Transf. saída — ${desc}`, tipo:"saida",  valor:val,categoria:"Other",forma:"Transferência",bancoId:+fTR.de},
        {id:uid(),data:fTR.data,descricao:`Transf. entrada — ${desc}`,tipo:"entrada",valor:val,categoria:"Other",forma:"Transferência",bancoId:+fTR.para},
      ],
    }));
    setFTR(emptyTR); setShowTR(false);
  };

  // COMPUTED
  const totalFixo  = data.despesas.filter(d=>d.tipo==="Fixo").reduce((s,d)=>s+d.valor,0);
  const totalVar   = data.despesas.filter(d=>d.tipo==="Variável").reduce((s,d)=>s+d.valor,0);
  const be         = totalFixo / Math.max((100-data.margemVariavel)/100,0.01);
  const saldoTotal = data.bancos.reduce((s,b)=>s+calcSaldoBanco(b),0);
  const totalRec   = receitas.reduce((s,r)=>s+r.valor,0);

  const FormHeader = ({title, onCancel}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <p style={{color:C.text,fontWeight:700,fontSize:15,fontFamily:"Syne,sans-serif"}}>{title}</p>
      <Btn v="ghost" size="sm" onClick={onCancel}>✕ Cancelar</Btn>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <SectionHead title="Cadastros"/>
      <Tabs
        tabs={[
          ["receitas",   "$ Receitas"],
          ["despesas",   "# Despesas"],
          ["bancos",     "B Bancos"],
          ["clientes",   "C Clientes"],
          ["vendedores", "V Vendedores"],
          ["formas",     "P Formas Pgto"],
        ]}
        active={tab} onChange={t=>{setTab(t);setShowC(false);setShowV(false);setShowD(false);setShowR(false);setShowB(false);}}
      />

      {/* -- RECEITAS -- */}
      {tab==="receitas" && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {/* Totais */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Total Receitas</p><p style={{color:C.green,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(totalRec)}</p></Card>
            <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Via Indicação</p><p style={{color:C.blue,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(receitas.filter(r=>r.conheceu==="Indicacao").reduce((s,r)=>s+r.valor,0))}</p></Card>
            <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Qtd. Fontes</p><p style={{color:C.orange,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{receitas.length}</p></Card>
          </div>

          <Btn onClick={()=>{setFR(emptyR);setEditR(null);setShowR(true);}} style={{alignSelf:"flex-start"}}>+ Nova Receita</Btn>

          {showR && (
            <Card accent>
              <FormHeader title={editR?"✏️ Editar Receita":"Nova Receita"} onCancel={()=>{setShowR(false);setEditR(null);setFR(emptyR);}}/>
              <Grid cols={3} isMobile={isMobile} style={{marginBottom:10}}>
                <Fld label="Descrição *"       value={fR.descricao}  onChange={v=>setFR(f=>({...f,descricao:v}))}  span isMobile={isMobile}/>
                <Fld label="Valor ($) *"       value={fR.valor}      onChange={v=>setFR(f=>({...f,valor:v}))}      type="number" isMobile={isMobile}/>
                <Fld label="Categoria"         value={fR.categoria}  onChange={v=>setFR(f=>({...f,categoria:v}))}  options={CATS_RECEITA} isMobile={isMobile}/>
                <Fld label="Como Conheceu"     value={fR.conheceu}   onChange={v=>setFR(f=>({...f,conheceu:v}))}   options={COMO_CONHECEU} isMobile={isMobile}/>
                <Fld label="Perfil do Cliente" value={fR.perfil}     onChange={v=>setFR(f=>({...f,perfil:v}))}     options={PERFIL_CLIENTE} isMobile={isMobile}/>
                <Fld label="Observações"       value={fR.obs}        onChange={v=>setFR(f=>({...f,obs:v}))}        span isMobile={isMobile}/>
              </Grid>
              <Btn onClick={saveR}>{editR?"Salvar Alterações":"Salvar Receita"}</Btn>
            </Card>
          )}

          {receitas.length===0 && !showR && (
            <Card style={{textAlign:"center",padding:32}}>
              <p style={{fontSize:32,marginBottom:8}}>💰</p>
              <p style={{color:C.muted,fontSize:14}}>Nenhuma receita cadastrada.</p>
              <p style={{color:C.muted,fontSize:13,marginTop:4}}>Cadastre suas fontes de receita recorrentes ou eventuais.</p>
            </Card>
          )}

          {/* Agrupar por tipo */}
          {COMO_CONHECEU.map(origem => {
            const items = receitas.filter(r => r.conheceu === origem);
            if (items.length === 0) return null;
            const total = items.reduce((s,r)=>s+r.valor,0);
            const colors = {"Carteira de Clientes":C.green,"Web":C.blue,"Indicacao":C.orange,"Walk-in":C.purple,"Prospeccao":C.yellow};
            const color  = colors[origem]||C.text;
            return (
              <Card key={origem} style={{background:`${color}08`,borderColor:`${color}20`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <p style={{color,fontWeight:700,fontSize:14}}>{origem}</p>
                  <p style={{color,fontFamily:"monospace",fontWeight:700,fontSize:15}}>{fmt(total)}</p>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {items.map(r => (
                    <div key={r.id} style={{background:C.surface,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                        <div style={{flex:1,minWidth:0,paddingRight:10}}>
                          <p style={{color:C.text,fontWeight:600,fontSize:14}}>{r.descricao}</p>
                          <p style={{color:C.muted,fontSize:12,marginTop:2}}>
                            {r.categoria}
                            {r.obs&&` · ${r.obs}`}
                          </p>
                        </div>
                        <p style={{color,fontFamily:"monospace",fontWeight:700,fontSize:16,flexShrink:0}}>{fmt(r.valor)}</p>
                      </div>
                      <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                        <Btn v="ghost" size="sm" onClick={()=>{startEditR(r);setShowR(true);}}>✏️ Editar</Btn>
                        <Btn v="danger" size="sm" onClick={()=>delR(r.id)}>✕</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* -- DESPESAS -- */}
      {tab==="despesas" && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Fixo/mês</p><p style={{color:C.red,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(totalFixo)}</p></Card>
            <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Variável/mês</p><p style={{color:C.orange,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(totalVar)}</p></Card>
            <Card style={{padding:10}}><p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Break-even</p><p style={{color:C.purple,fontSize:16,fontWeight:700,fontFamily:"monospace",marginTop:2}}>{fmt(be)}</p></Card>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <Btn onClick={()=>{setFD(emptyD);setEditD(null);setShowD(true);}}>+ Nova Despesa</Btn>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{color:C.muted,fontSize:13}}>Custo variável sobre vendas:</span>
              <input type="number" value={data.margemVariavel} onChange={e=>setData(d=>({...d,margemVariavel:+e.target.value}))}
                style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",color:C.text,fontSize:14,width:56,outline:"none",fontFamily:"inherit"}}/>
              <span style={{color:C.muted,fontSize:13}}>%</span>
            </div>
          </div>

          {showD && (
            <Card accent>
              <FormHeader title={editD?"✏️ Editar Despesa":"Nova Despesa"} onCancel={()=>{setShowD(false);setEditD(null);setFD(emptyD);}}/>
              <Grid cols={3} isMobile={isMobile} style={{marginBottom:10}}>
                <Fld label="Descrição *"      value={fD.descricao} onChange={v=>setFD(f=>({...f,descricao:v}))} span isMobile={isMobile}/>
                <Fld label="Valor Mensal ($)" value={fD.valor}     onChange={v=>setFD(f=>({...f,valor:v}))}     type="number" isMobile={isMobile}/>
                <Fld label="Tipo"             value={fD.tipo}      onChange={v=>setFD(f=>({...f,tipo:v}))}      options={["Fixo","Variável"]} isMobile={isMobile}/>
              </Grid>
              <Btn onClick={saveD}>{editD?"Salvar Alterações":"Salvar Despesa"}</Btn>
            </Card>
          )}

          {["Fixo","Variável"].map(tipo => {
            const items = data.despesas.filter(d=>d.tipo===tipo);
            const total = items.reduce((s,d)=>s+d.valor,0);
            const color = tipo==="Fixo"?C.red:C.orange;
            return (
              <Card key={tipo} style={{background:`${color}08`,borderColor:`${color}20`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <p style={{color,fontWeight:700}}>{tipo==="Fixo"?"📌 Despesas Fixas":"📈 Despesas Variáveis"}</p>
                  <p style={{color,fontFamily:"monospace",fontWeight:700,fontSize:15}}>{fmt(total)}</p>
                </div>
                {items.length===0 && <p style={{color:C.muted,fontSize:13}}>Nenhuma despesa cadastrada.</p>}
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {items.map(d => (
                    <div key={d.id} style={{background:C.surface,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{color:C.text,fontSize:14,flex:1}}>{d.descricao}</span>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:10}}>
                          <span style={{color,fontFamily:"monospace",fontWeight:700}}>{fmt(d.valor)}</span>
                          <Btn v="ghost" size="sm" onClick={()=>{startEditD(d);setShowD(true);}}>✏️</Btn>
                          <button onClick={()=>delD(d.id)} style={{background:"none",border:"none",color:"rgba(239,68,68,0.5)",cursor:"pointer",fontSize:18,padding:"0 2px",lineHeight:1}}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}

          <Card style={{background:"rgba(168,85,247,0.05)",borderColor:"rgba(168,85,247,0.2)"}}>
            <p style={{color:C.muted,fontSize:12,marginBottom:4}}>📐 Break-even = Custos Fixos ÷ Margem de Contribuição</p>
            <p style={{color:C.muted,fontSize:13}}>{fmt(totalFixo)} ÷ {(100-data.margemVariavel).toFixed(0)}%</p>
            <p style={{color:C.purple,fontFamily:"monospace",fontWeight:700,fontSize:22,marginTop:6}}>{fmt(be)}</p>
            <p style={{color:C.muted,fontSize:12,marginTop:4}}>Você precisa faturar {fmt(be)}/mês para cobrir todos os custos fixos.</p>
          </Card>
        </div>
      )}

      {/* -- BANCOS -- */}
      {tab==="bancos" && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Card style={{background:"rgba(249,115,22,0.06)",borderColor:"rgba(249,115,22,0.25)"}}>
            <p style={{color:C.muted,fontSize:11,textTransform:"uppercase"}}>Saldo Total — Todas as Contas</p>
            <p style={{color:C.orange,fontSize:26,fontWeight:700,fontFamily:"monospace",marginTop:4}}>{fmt(saldoTotal)}</p>
          </Card>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn onClick={()=>setShowB(true)}>+ Nova Conta</Btn>
            {data.bancos.length>=2&&<Btn v="ghost" onClick={()=>setShowTR(!showTR)}>↔ Transferência</Btn>}
          </div>
          {showB&&(
            <Card accent>
              <FormHeader title="Nova Conta Bancária" onCancel={()=>{setShowB(false);setFB(emptyB);}}/>
              <Grid cols={3} isMobile={isMobile} style={{marginBottom:10}}>
                <Fld label="Nome da Conta *"      value={fB.nome}         onChange={v=>setFB(f=>({...f,nome:v}))}         isMobile={isMobile}/>
                <Fld label="Banco / Instituição *"value={fB.banco}        onChange={v=>setFB(f=>({...f,banco:v}))}        isMobile={isMobile}/>
                <Fld label="Tipo"                 value={fB.tipo}         onChange={v=>setFB(f=>({...f,tipo:v}))}         options={["Checking","Savings","Business","Credit"]} isMobile={isMobile}/>
                <Fld label="Routing Number"       value={fB.routing}      onChange={v=>setFB(f=>({...f,routing:v}))}      isMobile={isMobile}/>
                <Fld label="Account Number"       value={fB.account}      onChange={v=>setFB(f=>({...f,account:v}))}      isMobile={isMobile}/>
                <Fld label="Saldo Inicial ($)"    value={fB.saldoInicial} onChange={v=>setFB(f=>({...f,saldoInicial:v}))} type="number" isMobile={isMobile}/>
              </Grid>
              <Btn onClick={addB}>Salvar Conta</Btn>
            </Card>
          )}
          {showTR&&(
            <Card accent>
              <FormHeader title="↔ Transferência entre Contas" onCancel={()=>{setShowTR(false);setFTR(emptyTR);}}/>
              <Grid cols={3} isMobile={isMobile} style={{marginBottom:10}}>
                <Fld label="De (origem) *"    value={fTR.de}       onChange={v=>setFTR(f=>({...f,de:v}))}       options={data.bancos.map(b=>({v:b.id,l:`${b.nome} — ${fmt(calcSaldoBanco(b))}`}))} isMobile={isMobile}/>
                <Fld label="Para (destino) *" value={fTR.para}     onChange={v=>setFTR(f=>({...f,para:v}))}     options={data.bancos.map(b=>({v:b.id,l:`${b.nome} — ${fmt(calcSaldoBanco(b))}`}))} isMobile={isMobile}/>
                <Fld label="Valor ($) *"      value={fTR.valor}    onChange={v=>setFTR(f=>({...f,valor:v}))}    type="number" isMobile={isMobile}/>
                <Fld label="Data"             value={fTR.data}     onChange={v=>setFTR(f=>({...f,data:v}))}     type="date"   isMobile={isMobile}/>
                <Fld label="Descrição"        value={fTR.descricao}onChange={v=>setFTR(f=>({...f,descricao:v}))}span isMobile={isMobile}/>
              </Grid>
              <Btn onClick={doTR}>Transferir</Btn>
            </Card>
          )}
          {data.bancos.length===0&&<Card style={{textAlign:"center",padding:32}}><p style={{fontSize:32,marginBottom:8}}>🏦</p><p style={{color:C.muted,fontSize:14}}>Nenhuma conta cadastrada. Clique em "+ Nova Conta".</p></Card>}
          {data.bancos.map(b=>{
            const saldo=calcSaldoBanco(b);
            const txs=b.transacoes||[];
            const ent=txs.filter(t=>t.tipo==="entrada").reduce((s,t)=>s+t.valor,0);
            const sai=txs.filter(t=>t.tipo==="saida").reduce((s,t)=>s+t.valor,0);
            return(
              <Card key={b.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:22}}>🏦</span>
                      <div><p style={{color:C.text,fontWeight:700,fontSize:15}}>{b.nome}</p><p style={{color:C.muted,fontSize:12}}>{b.banco} · {b.tipo}</p></div>
                    </div>
                    {b.routing&&<p style={{color:C.muted,fontSize:12}}>Routing: {b.routing}</p>}
                    {b.account&&<p style={{color:C.muted,fontSize:12}}>Account: {b.account}</p>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <p style={{color:C.muted,fontSize:11}}>Saldo Atual</p>
                    <p style={{color:saldo>=0?C.green:C.red,fontWeight:700,fontFamily:"monospace",fontSize:22}}>{fmt(saldo)}</p>
                    <p style={{color:C.muted,fontSize:11,marginTop:2}}>Inicial: {fmt(b.saldoInicial)}</p>
                  </div>
                </div>
                {txs.length>0&&(
                  <>
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <div style={{flex:1,background:`${C.green}15`,borderRadius:10,padding:"8px 12px",border:`1px solid ${C.green}30`}}>
                        <p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Entradas</p>
                        <p style={{color:C.green,fontFamily:"monospace",fontWeight:700,fontSize:15}}>+{fmt(ent)}</p>
                      </div>
                      <div style={{flex:1,background:`${C.red}15`,borderRadius:10,padding:"8px 12px",border:`1px solid ${C.red}30`}}>
                        <p style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>Saídas</p>
                        <p style={{color:C.red,fontFamily:"monospace",fontWeight:700,fontSize:15}}>-{fmt(sai)}</p>
                      </div>
                    </div>
                    <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,marginBottom:10}}>
                      <p style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Últimas Transações</p>
                      <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:180,overflowY:"auto"}}>
                        {[...txs].reverse().slice(0,8).map(t=>(
                          <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:C.dim,borderRadius:8}}>
                            <div style={{display:"flex",gap:8,alignItems:"center",flex:1,minWidth:0}}>
                              <span style={{fontSize:14}}>{FORMA_ICON[t.forma]||"💳"}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <p style={{color:C.text,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.descricao}</p>
                                <p style={{color:C.muted,fontSize:11}}>{t.data}</p>
                              </div>
                            </div>
                            <p style={{color:t.tipo==="entrada"?C.green:C.red,fontFamily:"monospace",fontWeight:700,fontSize:13,flexShrink:0,marginLeft:8}}>{t.tipo==="entrada"?"+":"-"}{fmt(t.valor)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div style={{display:"flex",justifyContent:"flex-end"}}>
                  <Btn v="danger" size="sm" onClick={()=>delB(b.id)}>Remover conta</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* -- CLIENTES -- */}
      {tab==="clientes"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Btn onClick={()=>{setFC(emptyC);setEditC(null);setShowC(true);}} style={{alignSelf:"flex-start"}}>+ Novo Cliente</Btn>
          {showC&&<Card accent>
            <FormHeader title={editC?"✏️ Editar Cliente":"Novo Cliente"} onCancel={()=>{setShowC(false);setEditC(null);setFC(emptyC);}}/>
            <Grid cols={2} isMobile={isMobile} style={{marginBottom:10}}>
              <Fld label="Nome *"   value={fC.nome}   onChange={v=>setFC(f=>({...f,nome:v}))} isMobile={isMobile}/>
              <Fld label="Telefone" value={fC.phone}  onChange={v=>setFC(f=>({...f,phone:v}))} isMobile={isMobile}/>
              <Fld label="Email"    value={fC.email}  onChange={v=>setFC(f=>({...f,email:v}))} type="email" isMobile={isMobile}/>
              <Fld label="Cidade"   value={fC.cidade} onChange={v=>setFC(f=>({...f,cidade:v}))} isMobile={isMobile}/>
            </Grid>
            <Btn onClick={saveC}>{editC?"Salvar Alterações":"Salvar Cliente"}</Btn>
          </Card>}
          {data.clientes.map(c=>{
            const totalC=data.vendas.filter(v=>v.clienteId===c.id).reduce((s,v)=>s+v.valor,0);
            const recC  =data.vendas.filter(v=>v.clienteId===c.id&&v.status==="Recebido").reduce((s,v)=>s+v.valor,0);
            return(
              <Card key={c.id}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(59,130,246,0.2)",color:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,flexShrink:0}}>{c.nome[0]}</div>
                  <p style={{color:C.text,fontWeight:600,flex:1}}>{c.nome}</p>
                </div>
                {[[" 📞",c.phone],["📧",c.email],["📍",c.cidade]].filter(([,v])=>v).map(([ico,val])=>(
                  <p key={ico} style={{color:C.muted,fontSize:13,marginBottom:2}}>{ico} {val}</p>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                  <span style={{color:C.muted,fontSize:12}}>{data.vendas.filter(v=>v.clienteId===c.id).length} pedido(s) · {fmt(recC)} recebido</span>
                  <div style={{display:"flex",gap:6}}>
                    <Btn v="ghost" size="sm" onClick={()=>startEditC(c)}>✏️ Editar</Btn>
                    <Btn v="danger" size="sm" onClick={()=>delC(c.id)}>✕</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* -- VENDEDORES -- */}
      {tab==="vendedores"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Btn onClick={()=>{setFV(emptyV);setEditV(null);setShowV(true);}} style={{alignSelf:"flex-start"}}>+ Novo Vendedor</Btn>
          {showV&&<Card accent>
            <FormHeader title={editV?"✏️ Editar Vendedor":"Novo Vendedor"} onCancel={()=>{setShowV(false);setEditV(null);setFV(emptyV);}}/>
            <Grid cols={3} isMobile={isMobile} style={{marginBottom:10}}>
              <Fld label="Nome *"       value={fV.nome}     onChange={v=>setFV(f=>({...f,nome:v}))} isMobile={isMobile}/>
              <Fld label="Email"        value={fV.email}    onChange={v=>setFV(f=>({...f,email:v}))} type="email" isMobile={isMobile}/>
              <Fld label="Comissão (%)" value={fV.comissao} onChange={v=>setFV(f=>({...f,comissao:v}))} type="number" isMobile={isMobile}/>
            </Grid>
            <Btn onClick={saveV}>{editV?"Salvar Alterações":"Salvar Vendedor"}</Btn>
          </Card>}
          {data.vendedores.map(v=>{
            const base=data.vendas.filter(s=>s.vendedorId===v.id&&s.status==="Recebido").reduce((s,x)=>s+x.valor,0);
            const comissaoMes = base * v.comissao / 100;
            return(
              <Card key={v.id}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(249,115,22,0.2)",color:C.orange,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,flexShrink:0}}>{v.nome[0]}</div>
                  <div style={{flex:1}}>
                    <p style={{color:C.text,fontWeight:600}}>{v.nome}</p>
                    <p style={{color:C.muted,fontSize:12}}>{v.comissao}% comissão</p>
                  </div>
                </div>
                <p style={{color:C.muted,fontSize:13,marginBottom:8}}>📧 {v.email}</p>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                  <span style={{color:C.orange,fontFamily:"monospace",fontWeight:700}}>{fmt(comissaoMes)} / mês</span>
                  <div style={{display:"flex",gap:6}}>
                    <Btn v="ghost" size="sm" onClick={()=>startEditV(v)}>✏️ Editar</Btn>
                    <Btn v="danger" size="sm" onClick={()=>delV(v.id)}>✕</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* -- FORMAS DE PAGAMENTO -- */}
      {tab==="formas"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <p style={{color:C.muted,fontSize:13,lineHeight:1.5}}>Formas de pagamento aceitas pela Pro Signs. Ao marcar uma venda ou conta como recebida, você escolhe a forma e o banco onde o valor foi depositado.</p>
          {FORMAS.map(forma=>{
            const totalForma=data.caixa.filter(c=>c.tipo==="entrada"&&c.forma===forma).reduce((s,c)=>s+c.valor,0);
            const info={
              "Cheque":             {desc:"Cheque físico. Depositar no banco em até 2 dias.",         tag:"2 dias",      tagColor:C.orange},
              "ACH / Wire Transfer":{desc:"Transferência bancária direta. Ideal para contratos.",      tag:"1-3 dias",    tagColor:C.blue},
              "Cartão de Crédito":  {desc:"Visa, Mastercard, Amex. Taxa média de 2.9% + $0.30.",      tag:"Taxa 2.9%",   tagColor:C.red},
              "Zelle / Venmo":      {desc:"Pagamento instantâneo via app. Sem taxa para receber.",     tag:"Instantâneo", tagColor:C.green},
              "Cash":               {desc:"Dinheiro em espécie. Sempre emitir recibo.",                tag:"Imediato",    tagColor:C.green},
            }[forma];
            return(
              <Card key={forma}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}>
                  <span style={{fontSize:26,flexShrink:0}}>{FORMA_ICON[forma]||"💳"}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                      <p style={{color:C.text,fontWeight:700,fontSize:15}}>{forma}</p>
                      {totalForma>0&&<p style={{color:C.green,fontFamily:"monospace",fontWeight:700}}>{fmt(totalForma)} recebido</p>}
                    </div>
                    <p style={{color:C.muted,fontSize:13,marginTop:4,lineHeight:1.4}}>{info?.desc}</p>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{background:`${C.green}15`,color:C.green,border:`1px solid ${C.green}30`,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:600}}>✓ Ativa</span>
                  {info?.tag&&<span style={{background:`${info.tagColor}15`,color:info.tagColor,border:`1px solid ${info.tagColor}30`,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:600}}>{info.tag}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}

/* =
   ROOT APP
= */
const NAV=[
  {id:"dashboard", label:"Dashboard",  icon:"▣"},
  {id:"vendas",    label:"Vendas",     icon:"◈"},
  {id:"caixa",     label:"Caixa",      icon:"◉"},
  {id:"contas",    label:"Contas",     icon:"◑"},
  {id:"comissoes", label:"Comissões",  icon:"◐"},
  {id:"cadastros", label:"Cadastros",  icon:"◎"},
];

export default function App() {
  const [data,   setData]    = useState(INIT);
  const [page,   setPage]    = useState("dashboard");
  const [loading,setLoading] = useState(false);
  const [synced, setSynced]  = useState(false);
  const [syncErr,setSyncErr] = useState("");
  const isMobile = useIsMobile();

  // ── Load all data from Supabase on mount ──────────────────────
  useEffect(() => {
    if (!IS_CONNECTED) return;
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true); setSyncErr("");
    try {
      const [cls, vds, bks, txs, des, rec, vns, cxs, crs, cps, coms, cfgs] = await Promise.all([
        sb.select("clientes"),
        sb.select("vendedores"),
        sb.select("bancos"),
        sb.select("banco_transacoes"),
        sb.select("despesas"),
        sb.select("receitas"),
        sb.select("vendas"),
        sb.select("caixa"),
        sb.select("contas_receber"),
        sb.select("contas_pagar"),
        sb.select("comissoes_pagas"),
        sb.select("configuracoes"),
      ]);
      // Attach transactions to their banks
      const bancosHydrated = bks.map(toBanco).map(b => ({
        ...b,
        transacoes: txs.filter(t => t.banco_id === b.id).map(toBancoTx)
      }));
      setData(d => ({
        ...d,
        clientes:       cls.map(toCliente),
        vendedores:     vds.map(toVendedor),
        bancos:         bancosHydrated,
        despesas:       des.map(toDespesa),
        receitas:       rec.map(toReceita),
        vendas:         vns.map(toVenda),
        caixa:          cxs.map(toCaixa),
        contasReceber:  crs.map(toCR),
        contasPagar:    cps.map(toCP),
        comissoesPagas: coms.map(toComPaga),
        margemVariavel: cfgs[0]?.margem_variavel ?? 35,
        taxCounty:      cfgs[0]?.tax_county ?? "Broward",
      }));
      setSynced(true);
    } catch(e) {
      console.error("Supabase load error:", e);
      setSyncErr("Erro ao conectar. Usando dados locais.");
    }
    setLoading(false);
  };

  const pages={
    dashboard: <Dashboard  data={data}/>,
    vendas:    <Vendas     data={data} setData={setData}/>,
    caixa:     <FluxoCaixa data={data} setData={setData}/>,
    contas:    <Contas     data={data} setData={setData}/>,
    comissoes: <Comissoes  data={data} setData={setData}/>,
    cadastros: <Cadastros  data={data} setData={setData}/>,
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:#2a2a3e;border-radius:99px;}
        select option{background:#111120;}
      `}</style>

      {/* HEADER */}
      <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:isMobile?"10px 14px":"10px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:32,height:32,background:C.orange,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,color:"#000",fontFamily:"Syne,sans-serif"}}>PS</div>
          <div>
            <p style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:13,color:C.text,letterSpacing:"0.06em"}}>PRO SIGNS</p>
            <p style={{color:C.muted,fontSize:9,letterSpacing:"0.1em"}}>FLORIDA · FINANCIAL SYSTEM</p>
          </div>
        </div>
        {!isMobile&&(
          <nav style={{display:"flex",gap:4,marginLeft:"auto",flexWrap:"wrap"}}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setPage(n.id)}
                style={{background:page===n.id?"rgba(249,115,22,0.15)":"transparent",color:page===n.id?C.orange:C.muted,border:page===n.id?"1px solid rgba(249,115,22,0.3)":"1px solid transparent",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                {n.icon} {n.label}
              </button>
            ))}
          </nav>
        )}
        {isMobile&&<p style={{color:C.text,fontWeight:600,fontSize:15,marginLeft:"auto"}}>{NAV.find(n=>n.id===page)?.label}</p>}
      </header>

      {/* SYNC STATUS BADGE */}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {IS_CONNECTED ? (
            synced
              ? <span style={{display:"flex",alignItems:"center",gap:5,color:C.green,fontSize:11}}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:C.green,display:"inline-block",boxShadow:`0 0 6px ${C.green}`}}/>
                  {!isMobile && "Online"}
                  <button onClick={loadAll} title="Recarregar" style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,padding:"0 2px"}}>↺</button>
                </span>
              : syncErr
                ? <span style={{color:C.red,fontSize:11}}>⚠ Offline</span>
                : <span style={{color:C.muted,fontSize:11}}>Conectando...</span>
          ) : (
            <span style={{color:C.muted,fontSize:11,display:isMobile?"none":"flex",alignItems:"center",gap:4}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:C.muted,display:"inline-block"}}/>
              Local
            </span>
          )}
        </div>

      {/* CONTENT */}
      <main style={{padding:isMobile?"14px 12px":"20px",maxWidth:960,margin:"0 auto",paddingBottom:isMobile?90:24}}>
        {loading ? (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:300,gap:16}}>
            <div style={{width:40,height:40,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.orange}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
            <p style={{color:C.muted,fontSize:14}}>Carregando dados do Supabase...</p>
            <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
          </div>
        ) : !IS_CONNECTED ? (
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            <div style={{background:"rgba(249,115,22,0.08)",border:`1px solid ${C.orange}`,borderRadius:14,padding:16,marginBottom:14}}>
              <p style={{color:C.orange,fontWeight:700,fontSize:15,marginBottom:8}}>Configurar Supabase</p>
              <p style={{color:C.text,fontSize:13,lineHeight:1.6,marginBottom:12}}>
                Para salvar os dados online, edite o arquivo e substitua nas linhas 35-36:
              </p>
              <div style={{background:C.bg,borderRadius:10,padding:12,fontFamily:"monospace",fontSize:12,marginBottom:12}}>
                <p style={{color:C.muted,marginBottom:4}}>// Linha ~35:</p>
                <p style={{color:C.green}}>const SUPABASE_URL = <span style={{color:"#fbbf24"}}>"https://xxx.supabase.co"</span>;</p>
                <p style={{color:C.green}}>const SUPABASE_KEY = <span style={{color:"#fbbf24"}}>"eyJ..."</span>;</p>
              </div>
              <p style={{color:C.muted,fontSize:12}}>Sem isso, o sistema funciona em modo local — dados ficam apenas nesta sessao.</p>
            </div>
            {pages[page]}
          </div>
        ) : pages[page]}
      </main>

      {/* BOTTOM NAV — mobile */}
      {isMobile&&(
        <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.surface,borderTop:`1px solid ${C.border}`,paddingBottom:"env(safe-area-inset-bottom,8px)",zIndex:100}}>
          <div style={{display:"flex",justifyContent:"space-around",padding:"6px 0"}}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setPage(n.id)}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 6px",cursor:"pointer",border:"none",background:"none",color:page===n.id?C.orange:C.muted,minWidth:40,touchAction:"manipulation",fontFamily:"inherit"}}>
                <span style={{fontSize:18}}>{n.icon}</span>
                <span style={{fontSize:9,fontWeight:600,letterSpacing:"0.03em",whiteSpace:"nowrap"}}>{n.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
