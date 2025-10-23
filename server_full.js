// server_full.js
// Full realtime server: static files + WebSocket + upload parsing + optional OpenAI summary
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const fetch = require("node-fetch");
const cors = require("cors");
require('dotenv').config();

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// file upload temp dir
const UPLOAD_DIR = path.join(__dirname, "uploads");
const upload = multer({ dest: UPLOAD_DIR });

// in-memory dataset (will be replaced on upload)
let currentOpportunities = [
  { No:1, Status:'Awarded', Vessel:'MT TBN Small II', Account:'PT KPI', Cargo:'Paraxylene', Volume:'5,000 MT', FreightRate:'23.5 USD/MT', Margin:'9.3%' },
  { No:2, Status:'Awarded', Vessel:'MT Griya Bugis', Account:'PT PL', Cargo:'LBO', Volume:'1,900 MT', FreightRate:'IDR 1,701,000,000', Margin:'' },
  { No:3, Status:'Failed', Vessel:'PIS Mahakam', Account:'PT HTK', Cargo:'Methanol', Volume:'', FreightRate:'', Margin:'' }
];

let currentKPI = {
  TotalRevenue: 23347974.36,
  Collected: 11805925.86,
  Outstanding: 11542048.50,
  CollectionRate: 50.57,
  ConversionRate: 36,
  TotalOpportunities: currentOpportunities.length,
  Awarded: currentOpportunities.filter(x=>x.Status==='Awarded').length,
  Failed: currentOpportunities.filter(x=>x.Status==='Failed').length,
  OnProgress: 0
};

function broadcast(type, payload){
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

// static
app.use(express.static(path.join(__dirname)));

// API: get opportunities
app.get("/api/opportunities", (req,res)=> res.json(currentOpportunities));

// API: upload CSV/XLSX
app.post("/api/upload", upload.single("file"), async (req,res) => {
  try {
    if(!req.file) return res.status(400).json({ error: "No file uploaded" });
    const filePath = req.file.path;
    const original = (req.file.originalname || "").toLowerCase();

    let rows = [];
    if(original.endsWith('.csv') || original.endsWith('.txt')){
      const wb = XLSX.readFile(filePath, { type: "file" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    } else if(original.endsWith('.xlsx') || original.endsWith('.xls')){
      const wb = XLSX.readFile(filePath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    } else {
      return res.status(400).json({ error: "Unsupported file type. Use CSV or XLSX." });
    }

    currentOpportunities = rows.map((r,i)=>({
      No: r.No || r.no || r["No."] || (i+1),
      Status: r.Status || r.status || '',
      Vessel: r.Vessel || r.vessel || '',
      Account: r.Account || r.account || '',
      Cargo: r.Cargo || r.cargo || '',
      Volume: r.Volume || r.volume || '',
      FreightRate: r.FreightRate || r.Freight || r["Freight Rate"] || '',
      Margin: r.Margin || r.margin || ''
    }));

    // recalc KPI-ish counts
    currentKPI.TotalOpportunities = currentOpportunities.length;
    currentKPI.Awarded = currentOpportunities.filter(x=>String(x.Status).toLowerCase()==='awarded').length;
    currentKPI.Failed = currentOpportunities.filter(x=>String(x.Status).toLowerCase()==='failed').length;
    currentKPI.OnProgress = currentKPI.TotalOpportunities - currentKPI.Awarded - currentKPI.Failed;
    currentKPI.ConversionRate = currentKPI.TotalOpportunities ? Math.round(currentKPI.Awarded / currentKPI.TotalOpportunities * 100) : 0;

    // broadcast
    broadcast("opportunity_bulk", currentOpportunities);
    broadcast("kpi", currentKPI);

    return res.json({ ok:true, count: currentOpportunities.length });
  } catch(err){
    console.error("Upload parse error", err);
    return res.status(500).json({ error: err.message });
  }
});

// API: AI summary
app.post("/api/summary", express.json(), async (req,res) => {
  const { texts } = req.body || {};
  let prompt;
  if(Array.isArray(texts) && texts.length){
    prompt = "Summarize the following publications into 3 concise bullets:\n\n" + texts.map((t,i)=>`[${i+1}] ${t}`).join("\n\n");
  } else {
    const cargoes = [...new Set(currentOpportunities.map(x=>x.Cargo).filter(Boolean))];
    prompt = `Summarize market implications based on cargo mix: ${cargoes.join(', ') || 'N/A'} and provide 3 action bullets for commercial and 2 for operations.`;
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if(OPENAI_KEY){
    try {
      const body = {
        model: "gpt-4o-mini",
        messages: [{ role:"user", content: prompt }],
        max_tokens: 400
      };
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method:"POST",
        headers: { "Content-Type":"application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      const summary = j?.choices?.[0]?.message?.content || JSON.stringify(j);
      return res.json({ ok:true, source:'openai', summary });
    } catch(e){
      console.error("OpenAI error", e);
      // fallback
    }
  }

  // fallback simple summary
  const counts = {};
  currentOpportunities.forEach(r=>{ if(r.Cargo) counts[r.Cargo]=(counts[r.Cargo]||0)+1; });
  const topCargo = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  const summary = `Auto-summary (fallback): Top cargo: ${topCargo.join(", ") || "N/A"}. Actions: 1) Prioritize collections on big-volume cargo lines. 2) Improve vessel availability for routes with many failures. 3) Evaluate margins on top cargos.`;
  return res.json({ ok:true, source:'fallback', summary });
});
