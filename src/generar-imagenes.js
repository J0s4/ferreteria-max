// =============================================================
//  generar-imagenes.js — Dibuja las imágenes de ejemplo de los
//  productos en public/img/productos (ya vienen hechas; solo hay
//  que correrlo si cambia la lista de productos de ejemplo).
//  Uso:  npm run imagenes
// =============================================================
const fs = require('node:fs');
const path = require('node:path');
const { CATEGORIAS, PRODUCTOS, svgProducto, slug } = require('./datos-ejemplo');

const carpeta = path.join(__dirname, '..', 'public', 'img', 'productos');
fs.mkdirSync(carpeta, { recursive: true });

const porCategoria = Object.fromEntries(CATEGORIAS.map(([nombre, icono, , color]) => [nombre, { icono, color }]));
for (const [categoria, nombre] of PRODUCTOS) {
  const { icono, color } = porCategoria[categoria];
  fs.writeFileSync(path.join(carpeta, `${slug(nombre)}.svg`), svgProducto(nombre, icono, color));
}
console.log(`✔ ${PRODUCTOS.length} imágenes generadas en public/img/productos`);
