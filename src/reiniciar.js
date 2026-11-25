// =============================================================
//  reiniciar.js — Borra TODOS los datos para empezar de cero.
//  Ejecute:  npm run reiniciar   (con el servidor DETENIDO)
//  • Base local: borra el archivo datos/ferreteria.db
//  • Turso (si TURSO_DATABASE_URL está en .env): borra todas las tablas
//  La próxima vez que arranque el sitio se cargan los datos de ejemplo.
// =============================================================
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const config = require('./config');

const TABLAS = ['sesiones', 'detalle_pedido', 'movimientos_inventario', 'pedidos', 'personal', 'productos', 'categorias',
  'sucursales', 'mensajes_contacto', 'bitacora', 'archivos', 'configuracion', 'usuarios'];

async function reiniciarTurso() {
  const { db } = require('./db');
  for (const t of TABLAS) await db.ejecutar(`DROP TABLE IF EXISTS ${t}`);
  db.cerrar();
  console.log('✔ Se borraron todas las tablas de la base en Turso.');
  console.log('  Al abrir el sitio (en Vercel o con npm start) se vuelven a cargar los datos de ejemplo.');
}

function reiniciarLocal() {
  for (const archivo of ['ferreteria.db', 'ferreteria.db-wal', 'ferreteria.db-shm']) {
    fs.rmSync(path.join(config.rutas.datos, archivo), { force: true });
  }
  // Carpetas de versiones anteriores del proyecto
  fs.rmSync(path.join(config.rutas.datos, 'comprobantes'), { recursive: true, force: true });
  fs.rmSync(path.join(config.rutas.publico, 'uploads'), { recursive: true, force: true });
  console.log('✔ Base de datos local borrada. Ejecute "npm start" para volver a cargar los datos de ejemplo.');
}

if (config.turso.url) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`Esto borra TODOS los datos de la base en la nube (${config.turso.url}). Escriba BORRAR para confirmar: `, (r) => {
    rl.close();
    if (r.trim() !== 'BORRAR') { console.log('Cancelado. No se borró nada.'); return; }
    reiniciarTurso().catch((e) => { console.error('✖', e.message); process.exit(1); });
  });
} else {
  reiniciarLocal();
}
