# Mi Monitor RED

Pequeña estructura inicial para un monitor de red.

Estructura:

- src/: código fuente
  - src/main.py: Punto de entrada
  - src/base_de_datos/: gestión de MongoDB
  - src/monitores/: lógica de escaneo y checks
  - src/utilidades/: utilidades compartidas
- configuracion/: archivos de configuración
- registros/: logs del sistema
- datos/: datos locales / backups
- requirements.txt: dependencias

Instalación (virtualenv recomendado):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Ejecución rápida:

```bash
python3 src/main.py
```

Logs:

- Archivo: `registros/app.log`

Siguientes pasos sugeridos:

- Implementar conexión a MongoDB en `src/base_de_datos`
- Añadir detectores y comprobaciones en `src/monitores`
- Añadir configuración en `configuracion/` (p. ej. YAML / .env)

Si quieres, puedo añadir ejemplos de configuración, un `docker-compose.yml` o pruebas unitarias.   

Interfaz web (UI estática)
-------------------------

Se incluye una UI estática mínima en `src/ui/static/` y un servidor muy simple en `src/ui/run_ui.py`.

Para servir la UI localmente:

```bash
python3 src/ui/run_ui.py
```

Abre en tu navegador: http://localhost:8000

Notas:
- El servidor usa la librería estándar `http.server` y es solo para desarrollo.
- Para integrar con el backend, crea endpoints JSON en `src/` y actualiza la UI para consumirlos.

Si quieres, actualizo el `README.md` con un ejemplo de `docker-compose.yml` para servir la UI y el backend.
