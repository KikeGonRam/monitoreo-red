import subprocess
import re
from datetime import datetime

PING_CMD = ['ping', '-c', '1', '-W', '1']

RTT_RE = re.compile(r'time=([0-9\.]+) ms')


def run_ping(host: str) -> dict:
    """Realiza un ping simple al host y devuelve un dict con resultados.
    Campos: host, ok (bool), rtt_ms (float|None), timestamp (ISO)
    """
    try:
        completed = subprocess.run(PING_CMD + [host], capture_output=True, text=True, check=False)
        out = completed.stdout or completed.stderr or ''
        ok = completed.returncode == 0
        rtt = None
        m = RTT_RE.search(out)
        if m:
            try:
                rtt = float(m.group(1))
            except Exception:
                rtt = None
        return {
            'host': host,
            'ok': ok,
            'rtt_ms': rtt,
            'raw': out.strip(),
            'timestamp': datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            'host': host,
            'ok': False,
            'rtt_ms': None,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }
