// =============================================================
//  bitacora.js — Registra quién hizo qué cambio y cuándo.
// =============================================================
const { ejecutar } = require('../db');

/**
 * @param {object} req     Petición de Express (de aquí sale el usuario y la IP)
 * @param {string} accion  Ej.: "Producto editado"
 * @param {string} detalle Texto libre con más información
 */
async function registrar(req, accion, detalle = '', usuarioForzado = null) {
  const u = usuarioForzado || req?.usuario || null;
  try {
    await ejecutar(
      'INSERT INTO bitacora (usuario_id, usuario_nombre, rol, accion, detalle, ip) VALUES (?, ?, ?, ?, ?, ?)',
      u?.id ?? null,
      u?.nombre ?? 'Visitante',
      u?.rol ?? '',
      accion,
      String(detalle).slice(0, 1000),
      req?.ip ?? ''
    );
  } catch (e) {
    console.error('No se pudo escribir en la bitácora:', e.message);
  }
}

module.exports = { registrar };
