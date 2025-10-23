// script.js - client logic
// helpers
const $ = id => document.getElementById(id);
const fmtUSD = n => {
  if(n === null || n === undefined) return '-';
  const x = Number(n);
  if(isNaN(x)) return n;
  if(Math.abs(x) >= 1000000) return '$' + (x/1000000).toFixed(2) + 'M';
  return '$' + x.toLocaleString();
};

let SalesOpportunityData = []; // will be set from server or upload
let currentKPI = {};

// === UI: navigation
function showSection(id, el){
  document.querySelectorAll('.nav a').forEach(a=>a.classList.remove('active'));
  if(el) el.classList.add('active');
  document.querySelectorAll('.section').forEach(s=>s.style.display='none');
  $(id).style.display='block';
  $('sectionTitle').textContent = id.charAt(0).toUpperCase() + id.slice(1) + ' Overview';
}
window.showSection = (id, el) => showSection(id, el);

// === Chart init
const plChart = new Chart($('plChart'), {
  type:'line',
  data:{ labels:['Jan','Feb','Mar','Apr','May','Jun','Jul'], datasets:[{ label:'P/L %', data:[85,90,95,92,88,91,93], borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,0.06)', tension:0.3, fill:true }] },
  options:{ responsive:true, maintainAspectRatio:true }
});

const revChart = new Chart($('revChart'), {
  type:'bar',
  data:{ labels:['Jan','Feb','Mar','Apr','May'], datasets:[{ label:'Revenue (USD M)', data:[1.2,1.4,1.8,1.6,2.0], backgroundColor:'#93c5fd' }] },
  options:{ responsive:true }
});

const funnelChart = new Chart($('funnelChart'), {
  type:'doughnut',
  data:{ labels:['Awarded','On Progress','Failed'], datasets:[{ data:[18,5,27], backgroundColor:['#4ade80','#facc15','#ef4444'] }] },
  options:{ responsive:true }
});

const fleetChart = new Chart($('fleetChart'), {
  type:'bar',
  data:{ labels:['Owned/TC','Spot/COA','FSO/STS'], datasets:[{ data:[4,2,4], backgroundColor:['#60a5fa','#f59e0b','#34d399'] }] },
  options:{ responsive:true }
});

const marketChart = new Chart($('marketChart'), {
  type:'line',
  data:{ labels:['W1','W2','W3','W4'], datasets:[{ label:'Market Index', data:[100,105,102,110], borderColor:'#2563eb', tension:0.3 }] },
  options:{ responsive:true }
});

const commodityChart = new Chart($('commodityChart'), {
  type:'line',
  data:{ labels:['Jan','Feb','Mar','Apr','May','Jun','Jul'],
    datasets:[
      { label:'PX (USD)', data:[60,58,59,61,60,62,61], borderColor:'#60a5fa', tension:0.3 },
      { label:'Methanol (USD)', data:[150,149,148,151,153,152,151], borderColor:'#34d399', tension:0.3 }
    ]
  },
  options:{ responsive:true }
});

const voyageChart = new Chart($('voyageChart'), {
  type:'radar',
  data:{ labels:['Fuel','Speed','Margin','Efficiency'], datasets:[{ label:'Voyage Index', data:[80,90,85,88], backgroundColor:'rgba(37,99,235,0.12)', borderColor:'#2563eb' }] },
  options:{ responsive:true }
});

// === Render opportunities table
function renderOppTable(){
  const tb = $('oppTable');
  tb.innerHTML = '';
  SalesOpportunityData.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.No ?? ''}</td><td>${r.Status ?? ''}</td><td>${r.Vessel ?? ''}</td><td>${r.Account ?? ''}</td><td>${r.Cargo ?? ''}</td><td>${r.Volume ?? ''}</td><td>${r.FreightRate ?? ''}</td><td>${r.Margin ?? ''}</td>`;
    tb.appendChild(tr);
  });

  // small monitoring table top 5
  const small = $('smallOppTable');
  small.innerHTML = '';
  SalesOpportunityData.slice(0,6).forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.No ?? ''}</td><td>${r.Vessel ?? ''}</td><td>${r.Account ?? ''}</td><td>${r.Cargo ?? ''}</td><td>${r.Status ?? ''}</td>`;
    small.appendChild(tr);
  });

  // update funnel counts
  const awarded = SalesOpportunityData.filter(x=>String(x.Status).toLowerCase()==='awarded').length;
  const failed = SalesOpportunityData.filter(x=>String(x.Status).toLowerCase()==='failed').length;
  const onprog = SalesOpportunityData.length - awarded - failed;
  funnelChart.data.datasets[0].data = [awarded, onprog, failed];
  funnelChart.update();
}

// === Update KPI visuals
function applyKPI(kpi){
  currentKPI = kpi;
  $('collectedVal').innerText = fmtUSD(kpi.Collected);
  $('outstandingVal').innerText = fmtUSD(kpi.Outstanding);
  $('lastUpdate').innerText = new Date().toLocaleString();

  // update plChart (append latest synthetic)
  const sample = parseFloat((Math.random()*6 + 88).toFixed(2));
  plChart.data.datasets[0].data.push(sample);
  plChart.data.datasets[0].data.shift();
  plChart.update();
}

// === Upload file to server
$('uploadBtn').addEventListener('click', async ()=>{
  const f = $('fileUpload').files[0];
  if(!f) return alert('Pilih file CSV atau XLSX terlebih dahulu');
  const fd = new FormData(); fd.append('file', f);
  const res = await fetch('/api/upload', { method:'POST', body: fd });
  const j = await res.json();
  if(j.ok) alert('Upload sukses: ' + j.count + ' rows - dashboard updated');
  else alert('Upload gagal: ' + (j.error || 'unknown'));
});

// === Request AI Summary
$('getSummaryBtn').addEventListener('click', async ()=>{
  $('getSummaryBtn').innerText = 'Requesting...';
  try {
    const res = await fetch('/api/summary', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
    const j = await res.json();
    if(j.ok){
      $('summaryText').innerText = j.summary || JSON.stringify(j);
      $('getSummaryBtn').innerText = 'Request Summary';
    } else {
      $('summaryText').innerText = 'Summary failed';
      $('getSummaryBtn').innerText = 'Request Summary';
    }
  } catch(e){
    $('summaryText').innerText = 'Summary error';
    $('getSummaryBtn').innerText = 'Request Summary';
  }
});

// === Export PDF (opportunities)
$('exportPdfBtn').addEventListener('click', async ()=>{
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  doc.setFontSize(14);
  doc.text('Sales Opportunities - PNB', 40, 40);
  const cols = ['No','Status','Vessel','Account','Cargo','Volume','Freight','Margin'];
  const rows = SalesOpportunityData.map(r => [r.No, r.Status, r.Vessel, r.Account, r.Cargo, r.Volume, r.FreightRate || '', r.Margin || '']);
  doc.autoTable({ head:[cols], body: rows, startY:60, styles:{ fontSize:9 } });
  doc.save('opportunities.pdf');
});

// === Voyage calc
$('calcVoyage')?.addEventListener('click', ()=>{
  const d = parseFloat($('distance').value);
  const s = parseFloat($('speed').value);
  if(!d || !s) return alert('Isi distance & speed dulu');
  const hours = d / s;
  $('voyageResult').innerText = `Estimated voyage time: ${hours.toFixed(1)} hours (${(hours/24).toFixed(1)} days)`;
});

// init small defaults
(function init(){
  // populate initial dataset from server fetch
  fetch('/api/opportunities').then(r=>r.json()).then(j=>{
    if(Array.isArray(j) && j.length){ SalesOpportunityData = j; renderOppTable(); }
  }).catch(()=>{ /* ignore */ });

  // initialize KPI UI from current page copy (server will push soon)
  applyKPI(currentKPI || { Collected: 11805925.86, Outstanding: 11542048.5 });
})();
