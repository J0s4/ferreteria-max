// =============================================================
//  auth.js — Sesiones y permisos por rol (validados en el SERVIDOR).
//
//  Cómo funciona la sesión persistente:
//  1. Al iniciar sesión se genera un token aleatorio largo.
//  2. El navegador lo guarda en una cookie "HttpOnly" (JavaScript
//     no la puede leer, lo que protege contra robo por XSS).
//  3. En la base de datos guardamos solo el HASH del token.
//  4. La cookie dura N días (DIAS_SESION), por eso el usuario
//     sigue logueado aunque cierre el navegador.
// =============================================================
const crypto = require('node:crypto');
const { uno, ejecutar } = require('../db');
const config = require('../config');

const NOMBRE_COOKIE = 'fm_sesion';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function leerCookie(req, nombre) {
  const cabecera = req.headers.cookie || '';
  for (const parte of cabecera.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return null;
}

async function crearSesion(req, res, usuario) {
  const token = crypto.randomBytes(32).toString('base64url');
  const dias = config.diasSesion;
  await ejecutar(
    "INSERT INTO sesiones (token_hash, usuario_id, expira_en) VALUES (?, ?, datetime('now', ?))",
    hashToken(token), usuario.id, `+${dias} days`
  );
  await ejecutar("UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?", usuario.id);
  res.cookie(NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure, // en localhost (http) va en false; en un servidor con https, true
    maxAge: dias * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

async function cerrarSesion(req, res) {
  const token = leerCookie(req, NOMBRE_COOKIE);
  if (token) await ejecutar('DELETE FROM sesiones WHERE token_hash = ?', hashToken(token));
  res.clearCookie(NOMBRE_COOKIE, { path: '/' });
}

/** Cierra todas las sesiones abiertas de un usuario (al suspender o cambiar contraseña) */
async function borrarSesionesDe(usuarioId) {
  await ejecutar('DELETE FROM sesiones WHERE usuario_id = ?', usuarioId);
}

/** Se ejecuta en cada petición: si hay una cookie válida, deja el usuario en req.usuario */
async function cargarUsuario(req, res, next) {
  req.usuario = null;
  const token = leerCookie(req, NOMBRE_COOKIE);
  if (token) {
    const u = await uno(
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.direccion, u.rol, u.estado
         FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token_hash = ? AND s.expira_en > datetime('now')`,
      hashToken(token)
    );
    if (u && u.estado === 'activo') req.usuario = { ...u };
  }
  next();
}

const esPersonal = (u) => u && (u.rol === 'admin' || u.rol === 'superadmin');

function requiereLogin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ error: 'Debe iniciar sesión para continuar.' });
  next();
}

/** Permite el paso solo a los roles indicados */
function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'Debe iniciar sesión para continuar.' });
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tiene permiso para realizar esta acción.' });
    }
    next();
  };
}

/** Para las rutas del súper admin: responde 404 (como si no existieran) */
function soloSuperadmin(req, res, next) {
  if (!req.usuario || req.usuario.rol !== 'superadmin') {
    return res.status(404).json({ error: 'No encontrado.' });
  }
  next();
}

async function limpiarSesionesVencidas() {
  await ejecutar("DELETE FROM sesiones WHERE expira_en <= datetime('now')");
}

module.exports = {
  crearSesion, cerrarSesion, borrarSesionesDe, cargarUsuario, requiereLogin, requiereRol,
  soloSuperadmin, esPersonal, limpiarSesionesVencidas,
};
