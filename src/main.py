#!/usr/bin/env python3
import logging
from pathlib import Path

# Configurar directorio de logs (usa carpeta `registros/` en la raíz del proyecto)
LOG_DIR = Path(__file__).resolve().parents[1] / "registros"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    filename=str(LOG_DIR / "app.log"),
    level=logging.INFO,
    format='%(asctime)s %(levelname)s:%(message)s'
)


def main():
    logging.info('Mi Monitor RED iniciado')
    print('Mi Monitor RED iniciado')


if __name__ == '__main__':
    main()
