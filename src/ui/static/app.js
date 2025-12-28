// Consolidated, single-copy app.js
// Datos reales - vacíos inicialmente
let monitorsData = [];
let devicesData = [];
let currentNetwork = '2.4G';
let currentPage = 1;
const devicesPerPage = 5;

// Elementos DOM
const elements = {
    systemStatus: document.getElementById('system-status'),
    lastCheck: document.getElementById('last-check'),
    avgLatency: document.getElementById('avg-latency'),
    totalMonitors: document.getElementById('total-monitors'),
    activeMonitors: document.getElementById('active-monitors'),
    failedMonitors: document.getElementById('failed-monitors'),
    avgResponse: document.getElementById('avg-response'),
    monitorsList: document.getElementById('monitors-list'),
    networksContainer: document.getElementById('networks-container'),
    scanProgress: document.getElementById('scan-progress'),
    scanText: document.getElementById('scan-text'),
    pageInfo: document.getElementById('page-info'),
    uiRefresh: document.getElementById('ui-refresh'),
    uptime: document.getElementById('uptime'),
    serverIp: document.getElementById('server-ip'),
    terminalOutput: document.getElementById('terminal-output'),
    refreshBtn: document.getElementById('refresh-btn'),
    autoRefresh: document.getElementById('auto-refresh'),
    scanBtn: document.getElementById('scan-btn'),
    count24G: document.getElementById('count-2.4G'),
    count5G: document.getElementById('count-5G')
};

// Tiempo de inicio
let startTime = Date.now();

// ------------------ Helpers ------------------
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateUptime() {
    const elapsed = Date.now() - startTime;
    if (elements.uptime) elements.uptime.textContent = formatTime(elapsed);
}

function updateUITime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    if (elements.uiRefresh) elements.uiRefresh.textContent = timeString;
}

function logTerminal(message) {
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    if (elements.terminalOutput) elements.terminalOutput.textContent = `[${timestamp}] ${message}`;
}

// ------------------ Fetchers ------------------
async function fetchMonitors() {
    try {
        const response = await fetch('/api/monitors');
        const data = await response.json();
        monitorsData = data.results || [];
        renderMonitors();
        updateMetrics();

        if (monitorsData.length > 0 && elements.lastCheck) {
            const lastTimestamp = monitorsData[0].timestamp;
            elements.lastCheck.textContent = lastTimestamp ? new Date(lastTimestamp).toLocaleTimeString('es-ES', { hour12: false }) : new Date().toLocaleTimeString('es-ES', { hour12: false });
        }

        logTerminal('Monitores actualizados correctamente');
        return true;
    } catch (error) {
        console.error('Error fetching monitors:', error);
        logTerminal('Error al obtener datos de monitores');
        return false;
    }
}

async function fetchDevices() {
    try {
        if (elements.scanText) elements.scanText.textContent = 'ESCANEANDO REDES...';
        if (elements.scanProgress) elements.scanProgress.style.width = '30%';

        const response = await fetch('/api/devices');
        const data = await response.json();
        devicesData = data.networks || [];

        if (elements.scanProgress) elements.scanProgress.style.width = '70%';

        if (data.scanning) {
            if (elements.scanText) elements.scanText.textContent = 'ESCANEO EN CURSO...';
            setTimeout(() => {
                if (elements.scanProgress) elements.scanProgress.style.width = '100%';
                if (elements.scanText) elements.scanText.textContent = 'ESCANEO COMPLETADO';
                renderNetworks();
                updateNetworkCounts();
            }, 1000);
        } else {
            if (elements.scanProgress) elements.scanProgress.style.width = '100%';
            if (elements.scanText) elements.scanText.textContent = 'ESCANEO COMPLETADO';
            renderNetworks();
            updateNetworkCounts();
        }

        logTerminal('Dispositivos de red actualizados');
        return true;
    } catch (error) {
        console.error('Error fetching devices:', error);
        if (elements.scanText) elements.scanText.textContent = 'ERROR DE ESCANEO';
        logTerminal('Error al escanear dispositivos de red');
        return false;
    }
}

// ------------------ Metrics & small helpers ------------------
function updateMetrics() {
    if (!elements.totalMonitors) return;
    if (monitorsData.length === 0) {
        elements.totalMonitors.textContent = '--';
        elements.activeMonitors.textContent = '--';
        elements.failedMonitors.textContent = '--';
        elements.avgResponse.textContent = '-- ms';
        elements.avgLatency.textContent = '-- ms';
        return;
    }

    const active = monitorsData.filter(m => m.ok).length;
    const failed = monitorsData.filter(m => !m.ok).length;

    elements.totalMonitors.textContent = monitorsData.length;
    elements.activeMonitors.textContent = active;
    elements.failedMonitors.textContent = failed;

    const validLatencies = monitorsData.filter(m => m.ok && m.rtt_ms).map(m => m.rtt_ms);
    if (validLatencies.length > 0) {
        const avg = validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length;
        elements.avgResponse.textContent = `${avg.toFixed(1)} ms`;
        elements.avgLatency.textContent = `${avg.toFixed(1)} ms`;
    } else {
        elements.avgResponse.textContent = '-- ms';
        elements.avgLatency.textContent = '-- ms';
    }
}

function getMonitorIcon(name) {
    const lowerName = (name || '').toLowerCase();
    if (lowerName.includes('gateway') || lowerName.includes('router')) return 'fas fa-network-wired';
    if (lowerName.includes('google') || lowerName.includes('dns')) return 'fas fa-globe';
    if (lowerName.includes('servidor') || lowerName.includes('server')) return 'fas fa-server';
    return 'fas fa-desktop';
}

// ------------------ Renderers ------------------
function renderMonitors() {
    if (!elements.monitorsList) return;
    if (monitorsData.length === 0) {
        elements.monitorsList.innerHTML = `
            <div class="loading-state">
                <div class="scan-line"></div>
                <p>NO HAY MONITORES CONFIGURADOS</p>
            </div>`;
        return;
    }

    let html = '';
    monitorsData.forEach(monitor => {
        const statusClass = monitor.ok ? 'status-online' : 'status-error';
        const statusText = monitor.ok ? 'ONLINE' : 'FALLA';
        const icon = getMonitorIcon(monitor.name);
        html += `
            <div class="monitor-item">
                <div class="monitor-icon"><i class="${icon}"></i></div>
                <div class="monitor-info">
                    <div class="monitor-name">${monitor.name || monitor.host}</div>
                    <div class="monitor-details">
                        <span>${monitor.host || '--'}</span>
                        <span>${monitor.mac ? monitor.mac.substring(0, 8) + '...' : '--'}</span>
                    </div>
                </div>
                <div class="monitor-status ${statusClass}">
                    <i class="fas fa-circle"></i>
                    ${statusText}
                    ${monitor.rtt_ms ? `<span>${monitor.rtt_ms}ms</span>` : ''}
                </div>
            </div>`;
    });
    elements.monitorsList.innerHTML = html;
}

function updateNetworkCounts() {
    const network24G = devicesData.find(n => n.nombre === '2.4G' || n.cidr === '192.168.1.0/24');
    const network5G = devicesData.find(n => n.nombre === '5G' || n.cidr === '192.168.2.0/24');

    if (network24G) {
        const online = network24G.devices.filter(d => d.ok).length;
        const total = network24G.devices.length;
        elements.count24G.textContent = `${online}/${total}`;
    } else elements.count24G.textContent = '--/--';

    if (network5G) {
        const online = network5G.devices.filter(d => d.ok).length;
        const total = network5G.devices.length;
        elements.count5G.textContent = `${online}/${total}`;
    } else elements.count5G.textContent = '--/--';
}

function renderNetworks() {
    if (!elements.networksContainer) return;
    if (devicesData.length === 0) {
        elements.networksContainer.innerHTML = `
            <div class="loading-state">
                <div class="scan-line"></div>
                <p>NO SE ENCONTRARON REDES</p>
            </div>`;
        return;
    }

    const currentNetworkData = devicesData.find(n => n.nombre === currentNetwork || (currentNetwork === '2.4G' && n.cidr === '192.168.1.0/24') || (currentNetwork === '5G' && n.cidr === '192.168.2.0/24'));
    if (!currentNetworkData) {
        elements.networksContainer.innerHTML = `
            <div class="loading-state">
                <div class="scan-line"></div>
                <p>RED NO DISPONIBLE</p>
            </div>`;
        return;
    }

    const devices = currentNetworkData.devices || [];
    const totalPages = Math.max(1, Math.ceil(devices.length / devicesPerPage));
    const startIndex = (currentPage - 1) * devicesPerPage;
    const endIndex = startIndex + devicesPerPage;
    const pageDevices = devices.slice(startIndex, endIndex);

    elements.pageInfo.textContent = `PÁGINA ${currentPage}/${totalPages}`;

    let html = `
        <table class="devices-table">
            <thead>
                <tr><th>IP</th><th>MAC</th><th>HOSTNAME</th><th>ESTADO</th></tr>
            </thead>
            <tbody>`;

    if (pageDevices.length === 0) {
        html += `
            <tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-tertiary);">NO HAY DISPOSITIVOS EN ESTA PÁGINA</td></tr>`;
    } else {
        pageDevices.forEach(device => {
            const statusClass = device.ok ? 'status-online' : 'status-offline';
            const statusText = device.ok ? 'ONLINE' : 'OFFLINE';
            html += `
                <tr>
                    <td class="ip-cell">${device.ip}</td>
                    <td class="mac-cell">${device.mac || '--'}</td>
                    <td class="hostname-cell">${device.hostname || '--'}</td>
                    <td>
                        <div class="status-cell ${statusClass}">
                            <span class="status-indicator"></span>
                            <span>${statusText}</span>
                        </div>
                    </td>
                </tr>`;
        });
    }

    html += `</tbody></table>`;

    if (totalPages > 1) {
        html += `
            <div class="pagination">
                <div class="pagination-info">MOSTRANDO ${startIndex + 1}-${Math.min(endIndex, devices.length)} DE ${devices.length}</div>
                <div class="pagination-controls">
                    <button class="page-btn prev-btn" ${currentPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
                    <button class="page-btn next-btn" ${currentPage >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>`;
    }

    elements.networksContainer.innerHTML = html;

    document.querySelectorAll('.prev-btn').forEach(btn => btn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderNetworks(); } }));
    document.querySelectorAll('.next-btn').forEach(btn => btn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderNetworks(); } }));
}

// ------------------ Actions / Setup ------------------
async function refreshAll() {
    logTerminal('INICIANDO ACTUALIZACIÓN...');
    if (elements.refreshBtn) {
        elements.refreshBtn.disabled = true;
        const content = elements.refreshBtn.querySelector('.btn-content');
        if (content) content.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>ACTUALIZANDO...</span>`;
    }

    const monitorSuccess = await fetchMonitors();
    const deviceSuccess = await fetchDevices();
    updateUITime();

    setTimeout(() => {
        if (elements.refreshBtn) {
            elements.refreshBtn.disabled = false;
            const content = elements.refreshBtn.querySelector('.btn-content');
            if (content) content.innerHTML = `<i class="fas fa-sync-alt"></i><span>ACTUALIZAR AHORA</span>`;
        }

        if (monitorSuccess && deviceSuccess) {
            if (elements.systemStatus) elements.systemStatus.innerHTML = `<span class="pulse-dot"></span>OPERATIVO`;
            logTerminal('ACTUALIZACIÓN COMPLETADA');
        } else {
            if (elements.systemStatus) elements.systemStatus.innerHTML = `<span class="pulse-dot"></span>CON ERRORES`;
            if (elements.systemStatus) elements.systemStatus.classList.add('status-error');
            logTerminal('ACTUALIZACIÓN CON ERRORES');
        }
    }, 500);
}

function setupAutoRefresh() {
    let autoRefreshInterval = null;
    function setAutoRefresh(enabled) {
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        if (enabled) autoRefreshInterval = setInterval(() => { logTerminal('AUTO-REFRESH EJECUTADO'); updateUITime(); fetchMonitors(); }, 30000);
    }
    setAutoRefresh(elements.autoRefresh ? elements.autoRefresh.checked : false);
    if (elements.autoRefresh) elements.autoRefresh.addEventListener('change', (e) => { setAutoRefresh(e.target.checked); logTerminal(`AUTO-REFRESH ${e.target.checked ? 'ACTIVADO' : 'DESACTIVADO'}`); });
}

function setupNetworkTabs() {
    document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        currentNetwork = this.dataset.network;
        currentPage = 1;
        renderNetworks();
        logTerminal(`CAMBIO A RED: ${currentNetwork}`);
    }));
}

// ------------------ Init ------------------
document.addEventListener('DOMContentLoaded', () => {
    if (elements.refreshBtn) elements.refreshBtn.addEventListener('click', refreshAll);
    if (elements.scanBtn) elements.scanBtn.addEventListener('click', () => { logTerminal('INICIANDO ESCANEO COMPLETO...'); fetchDevices(); });

    setupAutoRefresh();
    setupNetworkTabs();

    updateUITime(); setInterval(updateUITime, 1000);
    updateUptime(); setInterval(updateUptime, 1000);

    if (elements.serverIp) elements.serverIp.textContent = window.location.hostname || '192.168.1.89';

    logTerminal('SISTEMA INICIADO - ESPERANDO DATOS...');
    refreshAll();
});

// Función para registrar en el terminal
function logTerminal(message) {
    const timestamp = new Date().toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
    });
    
    elements.terminalOutput.textContent = `[${timestamp}] ${message}`;
}

// Función para actualizar todo
async function refreshAll() {
    logTerminal('INICIANDO ACTUALIZACIÓN...');
    
    // Deshabilitar botón temporalmente
    elements.refreshBtn.disabled = true;
    elements.refreshBtn.querySelector('.btn-content').innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        <span>ACTUALIZANDO...</span>
    `;
    
    // Actualizar datos
    const monitorSuccess = await fetchMonitors();
    const deviceSuccess = await fetchDevices();
    
    // Actualizar hora UI
    updateUITime();
    
    // Restaurar botón
    setTimeout(() => {
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.querySelector('.btn-content').innerHTML = `
            <i class="fas fa-sync-alt"></i>
            <span>ACTUALIZAR AHORA</span>
        `;
        
        if (monitorSuccess && deviceSuccess) {
            elements.systemStatus.innerHTML = `
                <span class="pulse-dot"></span>
                OPERATIVO
            `;
            logTerminal('ACTUALIZACIÓN COMPLETADA');
        } else {
            elements.systemStatus.innerHTML = `
                <span class="pulse-dot"></span>
                CON ERRORES
            `;
            elements.systemStatus.classList.add('status-error');
            logTerminal('ACTUALIZACIÓN CON ERRORES');
        }
    }, 500);
}

// Configurar auto-refresh
function setupAutoRefresh() {
    let autoRefreshInterval = null;
    
    function setAutoRefresh(enabled) {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        
        if (enabled) {
            autoRefreshInterval = setInterval(() => {
                logTerminal('AUTO-REFRESH EJECUTADO');
                updateUITime();
                // Actualizar solo datos básicos en auto-refresh
                fetchMonitors();
            }, 30000);
        }
    }
    
    setAutoRefresh(elements.autoRefresh.checked);
    
    elements.autoRefresh.addEventListener('change', (e) => {
        setAutoRefresh(e.target.checked);
        logTerminal(`AUTO-REFRESH ${e.target.checked ? 'ACTIVADO' : 'DESACTIVADO'}`);
    });
}

// Configurar tabs de red
function setupNetworkTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Remover clase active de todos los tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            // Agregar clase active al tab clickeado
            this.classList.add('active');
            
            // Cambiar red actual
            currentNetwork = this.dataset.network;
            currentPage = 1;
            
            // Renderizar dispositivos de la nueva red
            renderNetworks();
            
            logTerminal(`CAMBIO A RED: ${currentNetwork}`);
        });
    });
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Configurar listeners
    elements.refreshBtn.addEventListener('click', refreshAll);
    elements.scanBtn.addEventListener('click', () => {
        logTerminal('INICIANDO ESCANEO COMPLETO...');
        fetchDevices();
    });
    
    // Configurar auto-refresh
    setupAutoRefresh();
    
    // Configurar tabs de red
    setupNetworkTabs();
    
    // Iniciar actualización de tiempo
    updateUITime();
    setInterval(updateUITime, 1000);
    setInterval(updateUptime, 1000);
    
    // Obtener IP del servidor (simulado para ejemplo)
    // En un entorno real, esto vendría del backend
    elements.serverIp.textContent = window.location.hostname || '192.168.1.89';
    
    // Inicializar datos
    logTerminal('SISTEMA INICIADO - ESPERANDO DATOS...');
    refreshAll();
});

// Renderizar monitores
function renderMonitors() {
    if (monitorsData.length === 0) {
        elements.monitorsList.innerHTML = `
            <div class="loading-state">
                <div class="scan-line"></div>
                <p>NO HAY MONITORES CONFIGURADOS</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    monitorsData.forEach(monitor => {
        const statusClass = monitor.ok ? 'status-online' : 'status-error';
        const statusText = monitor.ok ? 'ONLINE' : 'FALLA';
        const icon = getMonitorIcon(monitor.name);
        
        html += `
            <div class="monitor-item">
                <div class="monitor-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="monitor-info">
                    <div class="monitor-name">${monitor.name || monitor.host}</div>
                    <div class="monitor-details">
                        <span>${monitor.host || '--'}</span>
                        <span>${monitor.mac ? monitor.mac.substring(0, 8) + '...' : '--'}</span>
                    </div>
                </div>
                <div class="monitor-status ${statusClass}">
                    <i class="fas fa-circle"></i>
                    ${statusText}
                    ${monitor.rtt_ms ? `<span>${monitor.rtt_ms}ms</span>` : ''}
                </div>
            </div>
        `;
    });
    
    elements.monitorsList.innerHTML = html;
}

// Actualizar contadores de red
function updateNetworkCounts() {
    const network24G = devicesData.find(n => n.nombre === '2.4G' || n.cidr === '192.168.1.0/24');
    const network5G = devicesData.find(n => n.nombre === '5G' || n.cidr === '192.168.2.0/24');
    
    if (network24G) {
        const online = network24G.devices.filter(d => d.ok).length;
        const total = network24G.devices.length;
        elements.count24G.textContent = `${online}/${total}`;
    } else {
        elements.count24G.textContent = '--/--';
    }
    
    if (network5G) {
        const online = network5G.devices.filter(d => d.ok).length;
        const total = network5G.devices.length;
        elements.count5G.textContent = `${online}/${total}`;
    } else {
        elements.count5G.textContent = '--/--';
    }
}

// Renderizar redes y dispositivos
function renderNetworks() {
    if (devicesData.length === 0) {
        elements.networksContainer.innerHTML = `
            <div class="loading-state">
                <div class="scan-line"></div>
                <p>NO SE ENCONTRARON REDES</p>
            </div>
        `;
        return;
    }
    
    // Encontrar red actual
    const currentNetworkData = devicesData.find(n => 
        n.nombre === currentNetwork || 
        (currentNetwork === '2.4G' && n.cidr === '192.168.1.0/24') ||
        (currentNetwork === '5G' && n.cidr === '192.168.2.0/24')
    );
    
    if (!currentNetworkData) {
        elements.networksContainer.innerHTML = `
            <div class="loading-state">
                <div class="scan-line"></div>
                <p>RED NO DISPONIBLE</p>
            </div>
        `;
        return;
    }
    
    const devices = currentNetworkData.devices || [];
    const totalPages = Math.ceil(devices.length / devicesPerPage);
    const startIndex = (currentPage - 1) * devicesPerPage;
    const endIndex = startIndex + devicesPerPage;
    const pageDevices = devices.slice(startIndex, endIndex);
    
    // Actualizar info de paginación
    elements.pageInfo.textContent = `PÁGINA ${currentPage}/${totalPages}`;
    
    // Renderizar tabla
    let html = `
        <table class="devices-table">
            <thead>
                <tr>
                    <th>IP</th>
                    <th>MAC</th>
                    <th>HOSTNAME</th>
                    <th>ESTADO</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (pageDevices.length === 0) {
        html += `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-tertiary);">
                    NO HAY DISPOSITIVOS EN ESTA PÁGINA
                </td>
            </tr>
        `;
    } else {
        pageDevices.forEach(device => {
            const statusClass = device.ok ? 'status-online' : 'status-offline';
            const statusText = device.ok ? 'ONLINE' : 'OFFLINE';
            
            html += `
                <tr>
                    <td class="ip-cell">${device.ip}</td>
                    <td class="mac-cell">${device.mac || '--'}</td>
                    <td class="hostname-cell">${device.hostname || '--'}</td>
                    <td>
                        <div class="status-cell ${statusClass}">
                            <span class="status-indicator"></span>
                            <span>${statusText}</span>
                        </div>
                    </td>
                </tr>
            `;
        });
    }
    
    html += `
            </tbody>
        </table>
    `;
    
    // Agregar controles de paginación si hay más de una página
    if (totalPages > 1) {
        html += `
            <div class="pagination">
                <div class="pagination-info">
                    MOSTRANDO ${startIndex + 1}-${Math.min(endIndex, devices.length)} DE ${devices.length}
                </div>
                <div class="pagination-controls">
                    <button class="page-btn prev-btn" ${currentPage <= 1 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="page-btn next-btn" ${currentPage >= totalPages ? 'disabled' : ''}>
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    elements.networksContainer.innerHTML = html;
    
    // Agregar event listeners a los botones de paginación
    document.querySelectorAll('.prev-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderNetworks();
            }
        });
    });
    
    document.querySelectorAll('.next-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const totalPages = Math.ceil(devices.length / devicesPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderNetworks();
            }
        });
    });
}

// Función para registrar en el terminal
function logTerminal(message) {
    const timestamp = new Date().toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
    });
    
    elements.terminalOutput.textContent = `[${timestamp}] ${message}`;
}

// Función para actualizar todo
async function refreshAll() {
    logTerminal('INICIANDO ACTUALIZACIÓN...');
    
    // Deshabilitar botón temporalmente
    elements.refreshBtn.disabled = true;
    elements.refreshBtn.querySelector('.btn-content').innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        <span>ACTUALIZANDO...</span>
    `;
    
    // Actualizar datos
    const monitorSuccess = await fetchMonitors();
    const deviceSuccess = await fetchDevices();
    
    // Actualizar hora UI
    updateUITime();
    
    // Restaurar botón
    setTimeout(() => {
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.querySelector('.btn-content').innerHTML = `
            <i class="fas fa-sync-alt"></i>
            <span>ACTUALIZAR AHORA</span>
        `;
        
        if (monitorSuccess && deviceSuccess) {
            elements.systemStatus.innerHTML = `
                <span class="pulse-dot"></span>
                OPERATIVO
            `;
            logTerminal('ACTUALIZACIÓN COMPLETADA');
        } else {
            elements.systemStatus.innerHTML = `
                <span class="pulse-dot"></span>
                CON ERRORES
            `;
            elements.systemStatus.classList.add('status-error');
            logTerminal('ACTUALIZACIÓN CON ERRORES');
        }
    }, 500);
}

// Configurar auto-refresh
function setupAutoRefresh() {
    let autoRefreshInterval = null;
    
    function setAutoRefresh(enabled) {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        
        if (enabled) {
            autoRefreshInterval = setInterval(() => {
                logTerminal('AUTO-REFRESH EJECUTADO');
                updateUITime();
                // Actualizar solo datos básicos en auto-refresh
                fetchMonitors();
            }, 30000);
        }
    }
    
    setAutoRefresh(elements.autoRefresh.checked);
    
    elements.autoRefresh.addEventListener('change', (e) => {
        setAutoRefresh(e.target.checked);
        logTerminal(`AUTO-REFRESH ${e.target.checked ? 'ACTIVADO' : 'DESACTIVADO'}`);
    });
}

// Configurar tabs de red
function setupNetworkTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Remover clase active de todos los tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            // Agregar clase active al tab clickeado
            this.classList.add('active');
            
            // Cambiar red actual
            currentNetwork = this.dataset.network;
            currentPage = 1;
            
            // Renderizar dispositivos de la nueva red
            renderNetworks();
            
            logTerminal(`CAMBIO A RED: ${currentNetwork}`);
        });
    });
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Configurar listeners
    elements.refreshBtn.addEventListener('click', refreshAll);
    elements.scanBtn.addEventListener('click', () => {
        logTerminal('INICIANDO ESCANEO COMPLETO...');
        fetchDevices();
    });
    
    // Configurar auto-refresh
    setupAutoRefresh();
    
    // Configurar tabs de red
    setupNetworkTabs();
    
    // Iniciar actualización de tiempo
    updateUITime();
    setInterval(updateUITime, 1000);
    setInterval(updateUptime, 1000);
    
    // Obtener IP del servidor (simulado para ejemplo)
    // En un entorno real, esto vendría del backend
    elements.serverIp.textContent = window.location.hostname || '192.168.1.89';
    
    // Inicializar datos
    logTerminal('SISTEMA INICIADO - ESPERANDO DATOS...');
    refreshAll();
});