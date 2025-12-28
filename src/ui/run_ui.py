#!/usr/bin/env python3
"""Script muy simple para servir la UI estática en http://localhost:8000
Usa solo la librería estándar (no requiere Flask).
"""
import http.server
import socketserver
from pathlib import Path

PORT = 8000
ROOT = Path(__file__).resolve().parent / "static"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)


if __name__ == '__main__':
    print(f"Sirviendo UI estática en http://localhost:{PORT} (raíz: {ROOT})")
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Servidor detenido")
            httpd.server_close()
