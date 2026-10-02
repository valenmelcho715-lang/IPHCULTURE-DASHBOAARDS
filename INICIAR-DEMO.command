#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=16)?0:1)' >/dev/null 2>&1; then
  echo 'Para abrir la demostración hace falta Node.js 22.16 o posterior.'
  echo 'La guía README explica la instalación. No se modificó tu sistema actual.'
  read -r -p 'Presioná Enter para cerrar.'
  exit 1
fi
if [ ! -d node_modules ]; then npm ci; fi
npm run build
export DEMO_PORT="${DEMO_PORT:-8181}"
node scripts/demo.cjs &
demo_pid=$!
trap 'kill "$demo_pid" 2>/dev/null || true' EXIT INT TERM
for attempt in $(seq 1 40); do
  if ! kill -0 "$demo_pid" 2>/dev/null; then wait "$demo_pid"; exit 1; fi
  if curl -fsS "http://127.0.0.1:${DEMO_PORT}/api/health" >/dev/null 2>&1; then
    if command -v open >/dev/null 2>&1; then
      open .demo/acceso.txt
      open "http://127.0.0.1:${DEMO_PORT}/atencion"
    fi
    echo 'Demostración abierta. El usuario y la contraseña están en .demo/acceso.txt.'
    echo 'Dejá esta ventana abierta mientras la usás. Para detenerla, presioná Ctrl+C.'
    wait "$demo_pid"
    exit $?
  fi
  sleep 1
done
echo 'No se pudo iniciar la demostración. Consultá el error de esta ventana.'
exit 1
