// =============================================================
//  rutas/auth.js — Registro, inicio y cierre de sesión, perfil.
//  Prefijo: /api/auth
// =============================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const { uno, ejecutar } = require('../db');
const config = require('../config');
const v = require('../utilidades/validar');
const { crearSesion, cerrarSesion, borrarSesionesDe, requiereLogin } = require('../middleware/auth');
const { crearLimitador } = require('../middleware/seguridad');
const bitacora = require('../servicios/bitacora');

const router = express.Router();
const limitador = crearLimitador({ maxIntentos: 8, ventanaMinutos: 15 });
// Hash de relleno para que tarde lo mismo aunque el correo no exista
const HASH_FALSO = bcrypt.hashSync('contrasena-de-relleno', 10);

const datosPublicos = (u) => ({
  id: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono, direccion: u.direccion, rol: u.rol,
});

/**
 * Verifica correo y contraseña. Se usa en el login normal y en el
 * del súper admin (cada uno acepta roles distintos).
 */
async function intentarLogin(req, res, rolesPermitidos) {
  const correo = String(req.body?.correo || '').trim().toLowerCase();
  const contrasena = String(req.body?.contrasena || '');
  const clave = `${req.ip}|${correo}`;

  if (limitador.bloqueado(clave)) {
    throw new v.ErrorUsuario(`Demasiados intentos. Espere ${limitador.minutos} minutos e intente de nuevo.`, 429);
  }
  const usuario = await uno('SELECT * FROM usuarios WHERE correo = ?', correo);
  const coincide = bcrypt.compareSync(contrasena, usuario?.hash_contrasena || HASH_FALSO);

  if (!usuario || !coincide || !rolesPermitidos.includes(usuario.rol)) {
    limitador.fallo(clave);
    if (rolesPermitidos.includes('superadmin')) await bitacora.registrar(req, 'Intento fallido de acceso maestro', correo);
    throw new v.ErrorUsuario('Correo o contraseña incorrectos.', 401);
  }
  if (usuario.estado !== 'activo') {
    throw new v.ErrorUsuario('Su cuenta está suspendida. Comuníquese con la ferretería.', 403);
  }
  limitador.exito(clave);
  await crearSesion(req, res, usuario);
  if (usuario.rol !== 'cliente') await bitacora.registrar(req, 'Inicio de sesión', `Rol: ${usuario.rol}`, usuario);
  return usuario;
}

// ---------- Registro de clientes ----------
router.post('/registro', async (req, res) => {
  const b = req.body || {};
  const nombre = v.texto(b.nombre, 'Nombre', { requerido: true, max: 80, min: 3 });
  const correo = v.correo(b.correo);
  const telefono = v.telefono(b.telefono, { requerido: true });
  const contrasena = v.contrasena(b.contrasena);

  if (await uno('SELECT id FROM usuarios WHERE correo = ?', correo)) {
    throw new v.ErrorUsuario('Ya existe una cuenta con ese correo. Inicie sesión o use otro correo.', 409);
  }
  const r = await ejecutar(
    "INSERT INTO usuarios (nombre, correo, telefono, hash_contrasena, rol) VALUES (?, ?, ?, ?, 'cliente')",
    nombre, correo, telefono, bcrypt.hashSync(contrasena, 10)
  );
  const usuario = await uno('SELECT * FROM usuarios WHERE id = ?', r.ultimoId);
  await crearSesion(req, res, usuario);
  res.status(201).json({ mensaje: '¡Cuenta creada! Ya puede hacer pedidos.', usuario: datosPublicos(usuario) });
});

// ---------- Inicio de sesión (clientes y administradores) ----------
router.post('/login', async (req, res) => {
  const usuario = await intentarLogin(req, res, ['cliente', 'admin']);
  res.json({ mensaje: `¡Hola, ${usuario.nombre.split(' ')[0]}!`, usuario: datosPublicos(usuario) });
});

router.post('/logout', async (req, res) => {
  await cerrarSesion(req, res);
  res.json({ mensaje: 'Sesión cerrada.' });
});

// ---------- ¿Quién soy? (lo usa el navegador al cargar cada página) ----------
router.get('/yo', (req, res) => {
  if (!req.usuario) return res.json({ usuario: null });
  const respuesta = { usuario: datosPublicos(req.usuario) };
  // Solo el súper admin recibe la dirección de su panel extra
  if (req.usuario.rol === 'superadmin' && config.superadmin.habilitado) respuesta.panelExtra = `${config.rutaSecreta}/panel.js`;
  res.json(respuesta);
});

// ---------- Perfil ----------
router.put('/perfil', requiereLogin, async (req, res) => {
  const b = req.body || {};
  const nombre = v.texto(b.nombre, 'Nombre', { requerido: true, max: 80, min: 3 });
  const telefono = v.telefono(b.telefono);
  const direccion = v.texto(b.direccion, 'Dirección', { max: 250 });
  const correo = v.correo(b.correo);
  const otro = await uno('SELECT id FROM usuarios WHERE correo = ? AND id <> ?', correo, req.usuario.id);
  if (otro) throw new v.ErrorUsuario('Ese correo ya lo usa otra cuenta.', 409);
  await ejecutar('UPDATE usuarios SET nombre = ?, telefono = ?, direccion = ?, correo = ? WHERE id = ?',
    nombre, telefono, direccion, correo, req.usuario.id);
  const usuario = await uno('SELECT * FROM usuarios WHERE id = ?', req.usuario.id);
  res.json({ mensaje: 'Perfil actualizado.', usuario: datosPublicos(usuario) });
});

router.put('/contrasena', requiereLogin, async (req, res) => {
  const actual = String(req.body?.actual || '');
  const nueva = v.contrasena(req.body?.nueva);
  const u = await uno('SELECT * FROM usuarios WHERE id = ?', req.usuario.id);
  if (!bcrypt.compareSync(actual, u.hash_contrasena)) {
    throw new v.ErrorUsuario('La contraseña actual no es correcta.', 400);
  }
  await ejecutar('UPDATE usuarios SET hash_contrasena = ? WHERE id = ?', bcrypt.hashSync(nueva, 10), u.id);
  // Cierra las demás sesiones y deja abierta solo esta
  await borrarSesionesDe(u.id);
  await crearSesion(req, res, u);
  res.json({ mensaje: 'Contraseña actualizada.' });
});

module.exports = { router, intentarLogin };
