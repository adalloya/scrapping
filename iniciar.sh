#!/bin/bash
# Script de inicio automático para macOS / Linux

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Cargar Node.js si está en NVM
if [ -d "$HOME/.nvm" ]; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

echo "=================================================="
echo "🚀 Iniciando Servidor del Scraper Ayjale..."
echo "📂 Directorio: $DIR"
echo "=================================================="

# Abrir el navegador automáticamente después de 2 segundos
(sleep 2 && open "http://localhost:3000" || xdg-open "http://localhost:3000") &

# Ejecutar el servidor Node
node server.js
