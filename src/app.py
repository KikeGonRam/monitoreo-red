from flask import Flask, jsonify, send_from_directory, request
from pathlib import Path
try:
    import yaml
    _HAS_YAML = True
except Exception:
    yaml = None
    _HAS_YAML = False
import os
import sys

from base_de_datos.db import get_db
from monitores.checks import run_ping
from monitores.devices import scan_cidr
import yaml as _yaml
import threading
import time
from datetime import datetime

ROOT = Path(__file__).resolve().parent
UI_DIR = ROOT / 'ui' / 'static'
CONFIG = Path(__file__).resolve().parents[1] / 'configuracion' / 'monitores.yaml'

# Ensure project root is on sys.path so `from src...` imports work
PROJECT_ROOT = ROOT.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

app = Flask(__name__, static_folder=str(UI_DIR), static_url_path='/static')

DB = get_db()


def load_monitors():
    if not CONFIG.exists():
        return []
    if _HAS_YAML:
        with open(CONFIG, 'r', encoding='utf-8') as f:
            cfg = yaml.safe_load(f) or {}
        return cfg.get('monitores', [])
    # Fallback simple parser: busca líneas con '- nombre:' y 'host:'
    monitors = []
    cur = {}
    with open(CONFIG, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('-'):
                if cur:
                    monitors.append(cur)
                cur = {}
                line = line.lstrip('-').strip()
            if ':' in line:
                k, v = line.split(':', 1)
                k = k.strip()
                v = v.strip()
                if v:
                    cur[k] = v
    if cur:
        monitors.append(cur)
    # Normalize keys to 'host' and 'nombre'
    normalized = []
    for m in monitors:
        nm = m.get('nombre') or m.get('name') or m.get('nombre:')
        host = m.get('host') or m.get('ip') or m.get('host:')
        if host:
            normalized.append({'nombre': nm or host, 'host': host})
    return normalized


@app.route('/')
def index():
    return send_from_directory(str(UI_DIR), 'index.html')


@app.route('/api/status')
def status():
    return jsonify({'status': 'ok', 'service': 'Mi Monitor RED'})


@app.route('/api/monitors')
def get_monitors():
    data = DB.get_recent(limit=100)
    return jsonify({'count': len(data), 'results': data})


def load_networks():
    cfg_path = Path(__file__).resolve().parents[1] / 'configuracion' / 'redes.yaml'
    if not cfg_path.exists():
        return []
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            cfg = _yaml.safe_load(f) or {}
        return cfg.get('redes', [])
    except Exception:
        # minimal parser fallback
        networks = []
        with open(cfg_path, 'r', encoding='utf-8') as f:
            cur = {}
            for line in f:
                line = line.strip()
                if line.startswith('-'):
                    if cur:
                        networks.append(cur)
                    cur = {}
                    line = line.lstrip('-').strip()
                if ':' in line:
                    k, v = line.split(':', 1)
                    cur[k.strip()] = v.strip()
            if cur:
                networks.append(cur)
        return networks


@app.route('/api/devices')
def api_devices():
    # Return cached devices quickly and trigger background refresh if stale
    global _DEVICES_CACHE, _DEVICES_CACHE_TS, _DEVICES_LOCK, _SCANNING
    with _DEVICES_LOCK:
        cache = _DEVICES_CACHE.copy() if isinstance(_DEVICES_CACHE, list) else []
        ts = _DEVICES_CACHE_TS
        scanning = _SCANNING

    return jsonify({
        'count': len(cache),
        'networks': cache,
        'scanning': scanning,
        'cached_at': ts
    })


@app.route('/api/devices/refresh', methods=['POST'])
def api_devices_refresh():
    # trigger background refresh and return status
    trigger_devices_scan(async_=True)
    return jsonify({'started': True})


# --- background cache for devices ---
_DEVICES_CACHE = []
_DEVICES_CACHE_TS = None
_DEVICES_LOCK = threading.Lock()
_SCANNING = False


def do_devices_scan():
    global _DEVICES_CACHE, _DEVICES_CACHE_TS, _SCANNING
    with _DEVICES_LOCK:
        if _SCANNING:
            return
        _SCANNING = True
    try:
        nets = load_networks()
        out = []
        for net in nets:
            name = net.get('nombre') or net.get('name') or str(net.get('cidr'))
            cidr = net.get('cidr')
            if not cidr:
                continue
            devices = scan_cidr(str(cidr))
            out.append({'nombre': name, 'cidr': cidr, 'devices': devices})
        with _DEVICES_LOCK:
            _DEVICES_CACHE = out
            _DEVICES_CACHE_TS = datetime.utcnow().isoformat()
    finally:
        with _DEVICES_LOCK:
            _SCANNING = False


def trigger_devices_scan(async_=True):
    # start a background thread to update the cache
    if async_:
        t = threading.Thread(target=do_devices_scan, daemon=True)
        t.start()
    else:
        do_devices_scan()


# Start an initial async scan on startup
trigger_devices_scan(async_=True)


@app.route('/api/refresh', methods=['POST'])
def refresh():
    monitors = load_monitors()
    results = []
    for m in monitors:
        host = m.get('host')
        name = m.get('nombre') or host
        res = run_ping(host)
        res['name'] = name
        DB.insert_result(res)
        results.append(res)
    return jsonify({'count': len(results), 'results': results})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f"Arrancando servidor en http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port)
