import ipaddress
import subprocess
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

PING_CMD = ['ping', '-c', '1', '-W', '1']


def _ping(ip: str) -> dict:
    try:
        completed = subprocess.run(PING_CMD + [ip], capture_output=True, text=True, check=False)
        return {'ip': ip, 'ok': completed.returncode == 0}
    except Exception:
        return {'ip': ip, 'ok': False}


def _read_neigh():
    """Lee la tabla ARP/neighbor y devuelve map ip->(mac,dev,state)"""
    try:
        out = subprocess.check_output(['ip', '-4', 'neigh'], text=True)
    except Exception:
        try:
            out = subprocess.check_output(['arp', '-n'], text=True)
        except Exception:
            return {}
    mapping = {}
    for line in out.splitlines():
        parts = line.split()
        if not parts:
            continue
        # ip neigh format: 192.168.1.5 dev wlp2s0 lladdr aa:bb:cc REACHABLE
        if 'lladdr' in parts:
            try:
                ip = parts[0]
                dev = parts[2] if len(parts) > 2 else ''
                llidx = parts.index('lladdr')
                mac = parts[llidx+1] if len(parts) > llidx+1 else None
                state = parts[-1]
                mapping[ip] = {'mac': mac, 'dev': dev, 'state': state}
            except Exception:
                continue
        else:
            # arp -n fallback: IP HWtype HWaddress Flags Mask Iface
            # e.g. 192.168.1.1 ether aa:bb:cc:dd:ee:ff C eth0
            if len(parts) >= 4:
                ip = parts[0]
                mac = parts[2]
                dev = parts[-1]
                mapping[ip] = {'mac': mac, 'dev': dev, 'state': ''}
    return mapping


def scan_cidr(cidr: str, max_workers: int = 100) -> list:
    """Escanea el CIDR haciendo ping a cada host y leyendo la tabla ARP.
    Devuelve lista de dispositivos con ip, mac, hostname, ok, timestamp, dev, state
    """
    net = ipaddress.ip_network(cidr, strict=False)
    hosts = [str(ip) for ip in net.hosts()]
    results = []

    # Ping en paralelo (rápido, ajustable)
    with ThreadPoolExecutor(max_workers=min(max_workers, len(hosts))) as ex:
        futures = {ex.submit(_ping, ip): ip for ip in hosts}
        for fut in as_completed(futures):
            res = fut.result()
            results.append(res)

    neigh = _read_neigh()

    devices = []
    for r in results:
        ip = r['ip']
        ok = r.get('ok', False)
        mac = None
        dev = None
        state = None
        info = neigh.get(ip)
        if info:
            mac = info.get('mac')
            dev = info.get('dev')
            state = info.get('state')
        # Try multiple strategies to obtain a hostname for the IP.
        hostname = None
        try:
            hostname = socket.gethostbyaddr(ip)[0]
        except Exception:
            # fallback: try `dig -x` (if available)
            try:
                out = subprocess.check_output(['dig', '-x', ip, '+short'], text=True).strip()
                if out:
                    # dig may return a trailing dot
                    hostname = out.splitlines()[0].strip().rstrip('.')
            except Exception:
                try:
                    # fallback: avahi-resolve-address (mDNS) if available
                    out = subprocess.check_output(['avahi-resolve-address', ip], text=True).strip()
                    if out:
                        parts = out.split()  # e.g. "192.168.1.10 hostname.local"
                        if len(parts) >= 2:
                            hostname = parts[1]
                except Exception:
                    hostname = None
        devices.append({
            'ip': ip,
            'mac': mac,
            'hostname': hostname,
            'ok': ok,
            'dev': dev,
            'state': state,
            'timestamp': datetime.utcnow().isoformat()
        })
    # return only online devices first
    devices_sorted = sorted(devices, key=lambda d: (not d['ok'], d['ip']))
    return devices_sorted
