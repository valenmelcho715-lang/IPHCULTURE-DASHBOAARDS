#!/bin/bash
# Script de inicio para iPhone Culture Dashboard
# Usa Node.js instalado localmente en el proyecto

DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$DIR/node-v20.15.1-darwin-arm64/bin/node"
NPM="$DIR/node-v20.15.1-darwin-arm64/bin/npm"
NPX="$DIR/node-v20.15.1-darwin-arm64/bin/npx"

echo "🚀 iPhone Culture Dashboard"
echo "==========================="

# Verificar que Node existe
if [ ! -f "$NODE" ]; then
    echo "❌ Node.js no encontrado. Ejecutá primero: ./install-node.sh"
    exit 1
fi

echo "✅ Node.js encontrado: $($NODE --version)"

# Iniciar backend
echo ""
echo "📡 Iniciando backend en http://localhost:3001 ..."
$NPX --yes tsx server/index.ts &
BACKEND_PID=$!
sleep 3

# Iniciar frontend
echo ""
echo "🌐 Iniciando frontend en http://localhost:7100 ..."
$NPX vite --port 7100 &
FRONTEND_PID=$!
sleep 3

echo ""
echo "==========================="
echo "✅ Todo listo!"
echo ""
echo "📱 Abrir app: http://localhost:7100"
echo ""
echo "🔑 Credenciales:"
echo "   Admin:    admin@iphoneculture.com / admin123"
echo "   Vendedor: juan@iphoneculture.com / closer123"
echo ""
echo "Presioná Ctrl+C para detener todo"
echo "==========================="

# Esperar y matar procesos al salir
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
