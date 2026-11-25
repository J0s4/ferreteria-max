#!/bin/bash
# Doble clic para iniciar Ferreteria Max en Mac
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Esta computadora todavia no tiene Node.js. Instale la version LTS y vuelva a abrir este archivo."
  open "https://nodejs.org/es/download"
  read -p "Presione Enter para cerrar"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Instalando las piezas del proyecto (solo la primera vez)..."
  npm install || { echo "No se pudo instalar. Revise su conexion a internet."; read -p "Presione Enter"; exit 1; }
fi
ABRIR_NAVEGADOR=si npm start
