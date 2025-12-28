from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import asyncio
from pymongo import MongoClient
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import threading
import time
import psutil
import json
import yaml
from pathlib import Path
import sys
# ensure project root is on sys.path so local packages (monitores) can be imported
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = Path(__file__).resolve().parent
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
from monitores.devices import scan_cidr
from monitores.checks import run_ping

# MongoDB client (use MONGO_URI env var if provided)
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017')
client = MongoClient(MONGO_URI)
db = client.get_database('monitor')
metrics_col = db.get_collection('metrics')
devices_col = db.get_collection('devices')

# ensure simple indexes
metrics_col.create_index('ts')
devices_col.create_index('ip', unique=True)

# mount static UI under /static so API routes remain at root
STATIC_DIR = PROJECT_ROOT / 'src' / 'ui' / 'static'
app = FastAPI(title='Mi Monitor RED API')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])
if STATIC_DIR.exists():
    app.mount('/static', StaticFiles(directory=str(STATIC_DIR), html=True), name='static')

class Device(BaseModel):
    ip: str
    mac: str | None = None
    hostname: str | None = None
@app.get('/')
def read_root():
    return {'message': 'Mi Monitor RED API'}

@app.get('/api/metrics')
def get_metrics(limit: int = 100):
    rows = list(metrics_col.find({}, {'_id': 0}).sort('ts', -1).limit(limit))
    return JSONResponse(content=rows)


# NOTE: devices listing compatible endpoint implemented later as `api_devices_list`


@app.post('/api/devices')
def add_device(d: Device):
    ts = int(time.time())
    devices_col.update_one({'ip': d.ip}, {'$set': {'mac': d.mac, 'hostname': d.hostname, 'last_seen': ts}}, upsert=True)
    return {'ok': True}


@app.post('/api/metrics')
def add_metric(payload: dict):
    ts = int(time.time())
    metric = payload.get('metric')
    value = float(payload.get('value', 0))
    metrics_col.insert_one({'ts': ts, 'metric': metric, 'value': value})
    return {'ok': True}


# Simple psutil collector that stores cpu and mem every N seconds
def collector_loop(interval=5):
    while True:
        try:
            ts = int(time.time())
            cpu = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory().percent
            metrics_col.insert_one({'ts': ts, 'metric': 'cpu_percent', 'value': cpu})
            metrics_col.insert_one({'ts': ts, 'metric': 'mem_percent', 'value': mem})
        except Exception as e:
            print('collector error', e)
        time.sleep(interval)


threading.Thread(target=collector_loop, daemon=True).start()

# Devices scanner (background cache + DB update)
_SCANNING = False
_SCAN_LOCK = threading.Lock()

def load_networks():
    cfg_path = Path(__file__).resolve().parents[1] / 'configuracion' / 'redes.yaml'
    if not cfg_path.exists():
        return []
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            cfg = yaml.safe_load(f) or {}
        return cfg.get('redes', [])
    except Exception:
        return []


def load_monitors():
    cfg_path = Path(__file__).resolve().parents[1] / 'configuracion' / 'monitores.yaml'
    if not cfg_path.exists():
        return []
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            cfg = yaml.safe_load(f) or {}
        return cfg.get('monitores', [])
    except Exception:
        return []


def do_devices_scan():
    global _SCANNING
    with _SCAN_LOCK:
        if _SCANNING:
            return
        _SCANNING = True
    try:
        nets = load_networks()
        for net in nets:
            name = net.get('nombre') or net.get('name') or str(net.get('cidr'))
            cidr = net.get('cidr')
            if not cidr:
                continue
            devices = scan_cidr(str(cidr))
            ts = int(time.time())
            for d in devices:
                ip = d.get('ip')
                # preserve rich device info
                doc = {
                    'ip': ip,
                    'mac': d.get('mac'),
                    'hostname': d.get('hostname'),
                    'ok': d.get('ok', False),
                    'dev': d.get('dev'),
                    'state': d.get('state'),
                    'timestamp': d.get('timestamp'),
                    'last_seen': ts,
                    'network': name
                }
                devices_col.update_one({'ip': ip}, {'$set': doc}, upsert=True)
    finally:
        with _SCAN_LOCK:
            _SCANNING = False


def trigger_devices_scan(async_=True):
    if async_:
        t = threading.Thread(target=do_devices_scan, daemon=True)
        t.start()
    else:
        do_devices_scan()


# start a scan on startup
trigger_devices_scan(async_=True)


@app.post('/api/devices/refresh')
def api_devices_refresh():
    trigger_devices_scan(async_=True)
    return {'started': True}


@app.get('/api/devices')
def api_devices_list():
    """Compatibility endpoint: retorna redes con sus dispositivos (igual que la UI espera)."""
    nets = load_networks()
    out = []
    for net in nets:
        name = net.get('nombre') or net.get('name') or str(net.get('cidr'))
        cidr = net.get('cidr')
        # fetch devices for this network
        docs = list(devices_col.find({'network': name}, {'_id': 0}).sort('last_seen', -1))
        out.append({'nombre': name, 'cidr': cidr, 'devices': docs})
    return {'count': sum(len(n['devices']) for n in out), 'networks': out}


@app.get('/api/monitors')
def api_monitors():
    mons = load_monitors()
    results = []
    for m in mons:
        host = m.get('host') or m.get('ip') or m.get('hostname')
        name = m.get('nombre') or m.get('name') or host
        try:
            res = run_ping(host)
            res['name'] = name
            results.append(res)
        except Exception:
            results.append({'host': host, 'ok': False, 'rtt_ms': None, 'name': name})
    return {'count': len(results), 'results': results}


@app.get('/mi-red')
def mi_red_view():
    """Serve the alternate API views page."""
    f = STATIC_DIR / 'mi-red.html'
    if f.exists():
        return FileResponse(str(f), media_type='text/html')
    raise HTTPException(status_code=404, detail='not found')


@app.get('/api/alerts')
def get_alerts():
    # placeholder
    return {'alerts': []}


@app.websocket('/ws/updates')
async def websocket_updates(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            # simple push of latest cpu/mem
            rows = list(metrics_col.find({'metric': {'$in': ['cpu_percent', 'mem_percent']}}, {'_id': 0}).sort('ts', -1).limit(2))
            await ws.send_text(json.dumps(rows))
            await asyncio.sleep(3)
    except Exception:
        await ws.close()
