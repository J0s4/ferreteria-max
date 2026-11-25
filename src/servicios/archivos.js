// =============================================================
//  archivos.js — Imágenes subidas (productos, logo, banners,
//  personal y comprobantes) guardadas DENTRO de la base de datos.
//  Así funcionan igual en su computadora y en Vercel, donde no se
//  pueden guardar archivos en disco.
// =============================================================
const crypto = require('node:crypto');
const { uno, ejecutar } = require('../db');

const EXTENSION = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const NOMBRE_VALIDO = /^[a-f0-9]{24}\.(jpg|png|webp|gif)$/;

/**
 * Guarda una imagen recibida por multer.
 * Devuelve la dirección pública (/archivos/...) o, si es privada, solo su nombre.
 */
async function guardar(archivo, { privado = false } = {}) {
  const nombre = `${crypto.randomBytes(12).toString('hex')}.${EXTENSION[archivo.mimetype]}`;
  await ejecutar('INSERT INTO archivos (id, tipo, datos, privado, tamano) VALUES (?, ?, ?, ?, ?)',
    nombre, archivo.mimetype, archivo.buffer, privado ? 1 : 0, archivo.size);
  return privado ? nombre : `/archivos/${nombre}`;
}

/** Borra una imagen a partir de su dirección (/archivos/...) o su nombre */
async function borrar(ruta) {
  if (!ruta) return;
  const nombre = String(ruta).replace(/^\/archivos\//, '');
  if (NOMBRE_VALIDO.test(nombre)) await ejecutar('DELETE FROM archivos WHERE id = ?', nombre);
}

async function obtener(nombre) {
  if (!NOMBRE_VALIDO.test(String(nombre))) return null;
  return (await uno('SELECT id, tipo, datos, privado FROM archivos WHERE id = ?', nombre)) || null;
}

/** Envía la imagen al navegador */
function enviar(res, archivo, { privado = false } = {}) {
  res.setHeader('Content-Type', archivo.tipo);
  res.setHeader('Cache-Control', privado ? 'private, no-store' : 'public, max-age=31536000, immutable');
  res.send(archivo.datos);
}

module.exports = { guardar, borrar, obtener, enviar, EXTENSION };
