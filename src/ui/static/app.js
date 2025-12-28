// Simple UI glue for devices pagination and refresh
let currentPage = 1;
const perPage = 5;

const elements = {
  networksContainer: document.getElementById('networks-container'),
  pageInfo: document.getElementById('page-info'),
  refreshBtn: document.getElementById('refresh-btn'),
  terminalOutput: document.getElementById('terminal-output'),
};

function log(msg){
  const t = new Date().toLocaleTimeString();
  if(elements.terminalOutput) elements.terminalOutput.textContent = `[${t}] ${msg}`;
}

async function fetchDevices(page=1){
  try{
    const res = await fetch(`/api/devices?page=${page}&per=${perPage}`);
    if(!res.ok) throw new Error('fetch devices failed');
    const data = await res.json();
    renderDevices(data);
  }catch(e){
    console.error(e);
    log('Error al obtener dispositivos');
  }
}

function renderDevices(payload){
  const devices = payload.devices || [];
  const total = payload.total || 0;
  const page = payload.page || 1;
  const per = payload.per || perPage;
  const totalPages = Math.max(1, Math.ceil(total / per));

  if(elements.pageInfo) elements.pageInfo.textContent = `Página ${page}/${totalPages} — Mostrando ${Math.min((page-1)*per+1, total)}-${Math.min(page*per, total)} de ${total}`;

  if(!elements.networksContainer) return;
  if(devices.length===0){
    elements.networksContainer.innerHTML = `<div class="loading-state"><p>No hay dispositivos</p></div>`;
    return;
  }

  let html = `
    <table class="devices-table">
      <thead>
        <tr><th>IP</th><th>MAC</th><th>HOSTNAME</th><th>RED</th><th>ULTIMA</th></tr>
      </thead>
      <tbody>`;
  devices.forEach(d=>{
    html += `<tr>
      <td class="ip-cell">${d.ip}</td>
      <td class="mac-cell">${d.mac||'--'}</td>
      <td class="hostname-cell">${d.hostname||'--'}</td>
      <td>${d.network||'--'}</td>
      <td>${d.last_seen?new Date(d.last_seen*1000).toLocaleString():'--'}</td>
    </tr>`;
  });
  html += `</tbody></table>`;

  // pagination controls
  html += `<div class="pagination" style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
    <div class="pagination-info"></div>
    <div class="pagination-controls">
      <button id="prev-page" class="page-btn prev-btn" ${page<=1?'disabled':''}>Prev</button>
      <button id="next-page" class="page-btn next-btn" ${page>=totalPages?'disabled':''}>Next</button>
    </div>
  </div>`;

  elements.networksContainer.innerHTML = html;

  document.getElementById('prev-page').addEventListener('click', ()=>{ if(currentPage>1){ currentPage--; fetchDevices(currentPage);} })
  document.getElementById('next-page').addEventListener('click', ()=>{ if(currentPage<totalPages){ currentPage++; fetchDevices(currentPage);} })
}

// refresh trigger
if(elements.refreshBtn){
  elements.refreshBtn.addEventListener('click', async ()=>{
    try{
      log('Iniciando escaneo...');
      await fetch('/api/devices/refresh', {method:'POST'});
      setTimeout(()=>{ fetchDevices(currentPage); }, 2000);
    }catch(e){ log('Error al iniciar escaneo'); }
  });
}

// websocket for realtime metrics
(function connectWS(){
  try{
    const ws = new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws/updates');
    ws.onopen = ()=>{ log('WS conectado'); }
    ws.onmessage = (ev)=>{ try{ const data = JSON.parse(ev.data); if(Array.isArray(data)) data.forEach(d=> log(`${d.metric}: ${d.value}`)); }catch(e){} }
    ws.onclose = ()=>{ log('WS cerrado, reconectando en 3s'); setTimeout(connectWS,3000); }
  }catch(e){ console.error('ws',e); setTimeout(connectWS,3000); }
})();

// init
document.addEventListener('DOMContentLoaded', ()=>{
  fetchDevices(currentPage);
});
