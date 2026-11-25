// =============================================================
//  rutas/superadmin.js — Funciones exclusivas del súper admin.
//  Se monta en la RUTA_SECRETA definida en .env. Para cualquier
//  otra persona estas rutas responden 404, como si no existieran.
// =============================================================
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, modo, uno, todos, ejecutar, transaccion } = require('../db');
const config = require('../config');
const v = require('../utilidades/validar');
const { rangoPeriodo, hoyCR, sumarDias, esFechaValida, SQL_HORA_CR } = require('../utilidades/fechas');
const { aCSV, aXLSX } = require('../utilidades/exportar');
const { soloSuperadmin, borrarSesionesDe } = require('../middleware/auth');
const { subirSitio, subirPersonal } = require('../middleware/subidas');
const archivos = require('../servicios/archivos');
const { intentarLogin } = require('./auth');
const configuracion = require('../servicios/configuracion');
const bitacora = require('../servicios/bitacora');

const router = express.Router();
const FECHA_LOCAL = (campo) => `date(${campo}, ${SQL_HORA_CR})`;
const HORA_LOCAL = (campo) => `datetime(${campo}, ${SQL_HORA_CR})`;

// ---------- Página de acceso (lo único visible sin sesión) ----------
router.get('/', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const html = fs.readFileSync(path.join(config.rutas.privado, 'super-login.html'), 'utf8');
  res.type('html').send(html.replaceAll('__RUTA__', config.rutaSecreta));
});
router.get('/login.js', (req, res) => res.sendFile(path.join(config.rutas.privado, 'super-login.js')));
router.post('/api/login', async (req, res) => {
  const u = await intentarLogin(req, res, ['superadmin']);
  res.json({ mensaje: `Bienvenido, ${u.nombre}.` });
});

// ---------- Todo lo demás exige ser súper admin ----------
router.use(soloSuperadmin);

router.get('/panel.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(config.rutas.privado, 'super-panel.js'));
});

// =================== USUARIOS ===================
const usuarioObjetivo = async (id) => {
  const u = await uno('SELECT * FROM usuarios WHERE id = ?', Number(id));
  // El súper admin no se gestiona desde aquí (solo desde .env)
  if (!u || u.rol === 'superadmin') throw new v.ErrorUsuario('El usuario no existe.', 404);
  return u;
};
const rolValido = (r) => {
  if (!['cliente', 'admin'].includes(r)) throw new v.ErrorUsuario('El rol debe ser cliente o administrador.');
  return r;
};

router.get('/api/usuarios', async (req, res) => {
  const condiciones = ["u.rol <> 'superadmin'"];
  const params = [];
  if (['cliente', 'admin'].includes(req.query.rol)) { condiciones.push('u.rol = ?'); params.push(req.query.rol); }
  if (req.query.q) {
    condiciones.push('(u.nombre LIKE ? OR u.correo LIKE ? OR u.telefono LIKE ?)');
    const patron = `%${String(req.query.q).slice(0, 60)}%`;
    params.push(patron, patron, patron);
  }
  res.json(await todos(
    `SELECT u.id, u.nombre, u.correo, u.telefono, u.direccion, u.rol, u.estado, u.creado_en, u.ultimo_acceso,
            (SELECT COUNT(*) FROM pedidos p WHERE p.usuario_id = u.id) AS pedidos
       FROM usuarios u WHERE ${condiciones.join(' AND ')} ORDER BY u.rol, u.nombre`, ...params));
});

router.post('/api/usuarios', async (req, res) => {
  const b = req.body || {};
  const nombre = v.texto(b.nombre, 'Nombre', { requerido: true, max: 80, min: 3 });
  const correo = v.correo(b.correo);
  const telefono = v.telefono(b.telefono);
  const rol = rolValido(b.rol);
  const contrasena = v.contrasena(b.contrasena);
  if (await uno('SELECT id FROM usuarios WHERE correo = ?', correo)) throw new v.ErrorUsuario('Ya existe una cuenta con ese correo.', 409);
  await ejecutar('INSERT INTO usuarios (nombre, correo, telefono, hash_contrasena, rol) VALUES (?, ?, ?, ?, ?)',
    nombre, correo, telefono, bcrypt.hashSync(contrasena, 10), rol);
  await bitacora.registrar(req, 'Usuario creado', `${nombre} <${correo}> como ${rol}`);
  res.status(201).json({ mensaje: `Cuenta de ${rol === 'admin' ? 'administrador' : 'cliente'} creada.` });
});

router.put('/api/usuarios/:id', async (req, res) => {
  const u = await usuarioObjetivo(req.params.id);
  const b = req.body || {};
  const nombre = v.texto(b.nombre, 'Nombre', { requerido: true, max: 80, min: 3 });
  const correo = v.correo(b.correo);
  const telefono = v.telefono(b.telefono);
  const direccion = v.texto(b.direccion, 'Dirección', { max: 250 });
  const rol = rolValido(b.rol);
  if (await uno('SELECT id FROM usuarios WHERE correo = ? AND id <> ?', correo, u.id)) throw new v.ErrorUsuario('Ese correo ya lo usa otra cuenta.', 409);
  await ejecutar('UPDATE usuarios SET nombre = ?, correo = ?, telefono = ?, direccion = ?, rol = ? WHERE id = ?',
    nombre, correo, telefono, direccion, rol, u.id);
  if (rol !== u.rol) await borrarSesionesDe(u.id); // si cambia el rol, debe volver a entrar
  await bitacora.registrar(req, 'Usuario editado', `${nombre} <${correo}>${rol !== u.rol ? ` · rol ${u.rol} → ${rol}` : ''}`);
  res.json({ mensaje: 'Usuario actualizado.' });
});

router.put('/api/usuarios/:id/estado', async (req, res) => {
  const u = await usuarioObjetivo(req.params.id);
  const estado = req.body?.estado === 'suspendido' ? 'suspendido' : 'activo';
  await ejecutar('UPDATE usuarios SET estado = ? WHERE id = ?', estado, u.id);
  if (estado === 'suspendido') await borrarSesionesDe(u.id); // lo saca de inmediato
  await bitacora.registrar(req, estado === 'suspendido' ? 'Usuario suspendido' : 'Usuario reactivado', `${u.nombre} <${u.correo}>`);
  res.json({ mensaje: estado === 'suspendido' ? `${u.nombre} quedó suspendido.` : `${u.nombre} está activo de nuevo.` });
});

router.put('/api/usuarios/:id/contrasena', async (req, res) => {
  const u = await usuarioObjetivo(req.params.id);
  const nueva = v.contrasena(req.body?.nueva);
  await ejecutar('UPDATE usuarios SET hash_contrasena = ? WHERE id = ?', bcrypt.hashSync(nueva, 10), u.id);
  await borrarSesionesDe(u.id);
  await bitacora.registrar(req, 'Contraseña restablecida', `${u.nombre} <${u.correo}>`);
  res.json({ mensaje: `Contraseña de ${u.nombre} restablecida. Compártala por un medio seguro.` });
});

router.delete('/api/usuarios/:id', async (req, res) => {
  const u = await usuarioObjetivo(req.params.id);
  await transaccion(async (t) => {
    // Sus pedidos e historial se conservan con nombre y correo, pero dejan de apuntar a la cuenta
    await t.ejecutar('DELETE FROM sesiones WHERE usuario_id = ?', u.id);
    await t.ejecutar('UPDATE pedidos SET usuario_id = NULL WHERE usuario_id = ?', u.id);
    await t.ejecutar('UPDATE movimientos_inventario SET usuario_id = NULL WHERE usuario_id = ?', u.id);
    await t.ejecutar('DELETE FROM usuarios WHERE id = ?', u.id);
  });
  await bitacora.registrar(req, 'Usuario eliminado', `${u.nombre} <${u.correo}> (${u.rol})`);
  res.json({ mensaje: `La cuenta de ${u.nombre} se eliminó. Sus pedidos se conservan.` });
});

// =================== CONFIGURACIÓN DEL SITIO ===================
router.get('/api/configuracion', async (req, res) => res.json(await configuracion.obtener()));

router.put('/api/configuracion', async (req, res) => {
  const b = req.body || {};
  const cambios = {};
  const textos = {
    nombre_tienda: ['Nombre de la tienda', 60, true], eslogan: ['Eslogan', 120], sinpe_titular: ['Titular SINPE', 80, true],
    correo: ['Correo', 120], horario_general: ['Horario general', 400], mensaje_ventas: ['Mensaje de ventas', 300],
    mensaje_mantenimiento: ['Mensaje de mantenimiento', 300],
  };
  for (const [clave, [nombre, max, requerido]] of Object.entries(textos)) {
    if (clave in b) cambios[clave] = v.texto(b[clave], nombre, { max, requerido: !!requerido });
  }
  if ('correo' in b && cambios.correo) cambios.correo = v.correo(b.correo);
  if ('sinpe_numero' in b) cambios.sinpe_numero = v.telefono(b.sinpe_numero, { requerido: true });
  if ('telefono' in b) cambios.telefono = v.telefono(b.telefono);
  if ('whatsapp' in b) cambios.whatsapp = v.telefono(b.whatsapp);
  if ('color_primario' in b) cambios.color_primario = v.colorHex(b.color_primario, 'Color principal');
  if ('color_secundario' in b) cambios.color_secundario = v.colorHex(b.color_secundario, 'Color secundario');
  if ('ventas_activas' in b) cambios.ventas_activas = v.booleano(b.ventas_activas);
  if ('mantenimiento' in b) cambios.mantenimiento = v.booleano(b.mantenimiento);

  const antes = await configuracion.obtener();
  await configuracion.guardar(cambios);

  if ('ventas_activas' in cambios && cambios.ventas_activas !== antes.ventas_activas) {
    await bitacora.registrar(req, cambios.ventas_activas ? 'Ventas activadas' : 'Ventas desactivadas', cambios.mensaje_ventas || antes.mensaje_ventas);
  }
  if ('mantenimiento' in cambios && cambios.mantenimiento !== antes.mantenimiento) {
    await bitacora.registrar(req, cambios.mantenimiento ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado', '');
  }
  const otros = Object.keys(cambios).filter((k) => !['ventas_activas', 'mantenimiento'].includes(k) && String(cambios[k]) !== String(antes[k]));
  if (otros.length) await bitacora.registrar(req, 'Información del sitio editada', otros.join(', '));
  res.json({ mensaje: 'Configuración guardada.', configuracion: await configuracion.obtener() });
});

router.post('/api/configuracion/logo', subirSitio.single('logo'), async (req, res) => {
  if (!req.file) throw new v.ErrorUsuario('Elija una imagen para el logo.');
  const anterior = (await configuracion.obtener()).logo;
  const logo = await archivos.guardar(req.file);
  await configuracion.guardar({ logo });
  await archivos.borrar(anterior);
  await bitacora.registrar(req, 'Logo actualizado', '');
  res.json({ mensaje: 'Logo actualizado.', logo });
});
router.delete('/api/configuracion/logo', async (req, res) => {
  await archivos.borrar((await configuracion.obtener()).logo);
  await configuracion.guardar({ logo: '' });
  await bitacora.registrar(req, 'Logo restablecido', 'Se usa el logo original');
  res.json({ mensaje: 'Se restableció el logo original.' });
});

// ---------- Banners de la página de inicio ----------
function leerBanner(b) {
  const enlace = v.texto(b.enlace, 'Enlace', { max: 200 });
  if (enlace && !enlace.startsWith('/')) throw new v.ErrorUsuario('El enlace debe ser una página del sitio, por ejemplo /catalogo');
  return {
    titulo: v.texto(b.titulo, 'Título', { requerido: true, max: 90 }),
    texto: v.texto(b.texto, 'Texto', { max: 220 }),
    enlace,
    texto_boton: v.texto(b.texto_boton, 'Texto del botón', { max: 40 }),
  };
}
router.post('/api/configuracion/banners', subirSitio.single('imagen'), async (req, res) => {
  const banners = (await configuracion.obtener()).banners;
  if (banners.length >= 6) throw new v.ErrorUsuario('Máximo 6 banners. Elimine uno para agregar otro.');
  const datos = leerBanner(req.body || {});
  banners.push({ ...datos, imagen: req.file ? await archivos.guardar(req.file) : '' });
  await configuracion.guardar({ banners });
  await bitacora.registrar(req, 'Banner agregado', banners.at(-1).titulo);
  res.status(201).json({ mensaje: 'Banner agregado.' });
});
router.put('/api/configuracion/banners/:i', subirSitio.single('imagen'), async (req, res) => {
  const banners = (await configuracion.obtener()).banners;
  const i = Number(req.params.i);
  if (!banners[i]) throw new v.ErrorUsuario('El banner no existe.', 404);
  const datos = leerBanner(req.body || {});
  let imagen = banners[i].imagen;
  if (req.file) { await archivos.borrar(imagen); imagen = await archivos.guardar(req.file); }
  if (v.booleano(req.body?.quitar_imagen)) { await archivos.borrar(imagen); imagen = ''; }
  banners[i] = { ...datos, imagen };
  await configuracion.guardar({ banners });
  await bitacora.registrar(req, 'Banner editado', banners[i].titulo);
  res.json({ mensaje: 'Banner actualizado.' });
});
router.delete('/api/configuracion/banners/:i', async (req, res) => {
  const banners = (await configuracion.obtener()).banners;
  const i = Number(req.params.i);
  if (!banners[i]) throw new v.ErrorUsuario('El banner no existe.', 404);
  const [quitado] = banners.splice(i, 1);
  await archivos.borrar(quitado.imagen);
  await configuracion.guardar({ banners });
  await bitacora.registrar(req, 'Banner eliminado', quitado.titulo);
  res.json({ mensaje: 'Banner eliminado.' });
});

// =================== SUCURSALES ===================
function leerSucursal(b) {
  const coord = (valor, nombre, min, max) => {
    if (valor === '' || valor === undefined || valor === null) return null;
    const n = Number(valor);
    if (!Number.isFinite(n) || n < min || n > max) throw new v.ErrorUsuario(`"${nombre}" no es válida.`);
    return n;
  };
  return {
    nombre: v.texto(b.nombre, 'Nombre', { requerido: true, max: 80 }),
    direccion: v.texto(b.direccion, 'Dirección', { requerido: true, max: 300 }),
    telefono: v.telefono(b.telefono),
    correo: b.correo ? v.correo(b.correo) : '',
    horario: v.texto(b.horario, 'Horario', { max: 400 }),
    latitud: coord(b.latitud, 'Latitud', -90, 90),
    longitud: coord(b.longitud, 'Longitud', -180, 180),
    activa: b.activa === undefined ? 1 : v.booleano(b.activa) ? 1 : 0,
    orden: v.entero(b.orden || 0, 'Orden', { min: 0, max: 999 }),
  };
}
router.get('/api/sucursales', async (req, res) => {
  res.json(await todos(`SELECT s.*, (SELECT COUNT(*) FROM personal p WHERE p.sucursal_id = s.id) AS personas FROM sucursales s ORDER BY orden, nombre`));
});
router.post('/api/sucursales', async (req, res) => {
  const s = leerSucursal(req.body || {});
  await ejecutar('INSERT INTO sucursales (nombre, direccion, telefono, correo, horario, latitud, longitud, activa, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    s.nombre, s.direccion, s.telefono, s.correo, s.horario, s.latitud, s.longitud, s.activa, s.orden);
  await bitacora.registrar(req, 'Sucursal creada', s.nombre);
  res.status(201).json({ mensaje: 'Sucursal agregada.' });
});
router.put('/api/sucursales/:id', async (req, res) => {
  const actual = await uno('SELECT * FROM sucursales WHERE id = ?', Number(req.params.id));
  if (!actual) throw new v.ErrorUsuario('La sucursal no existe.', 404);
  const s = leerSucursal(req.body || {});
  await ejecutar('UPDATE sucursales SET nombre = ?, direccion = ?, telefono = ?, correo = ?, horario = ?, latitud = ?, longitud = ?, activa = ?, orden = ? WHERE id = ?',
    s.nombre, s.direccion, s.telefono, s.correo, s.horario, s.latitud, s.longitud, s.activa, s.orden, actual.id);
  await bitacora.registrar(req, 'Sucursal editada', s.nombre);
  res.json({ mensaje: 'Sucursal actualizada.' });
});
router.delete('/api/sucursales/:id', async (req, res) => {
  const s = await uno('SELECT * FROM sucursales WHERE id = ?', Number(req.params.id));
  if (!s) throw new v.ErrorUsuario('La sucursal no existe.', 404);
  await transaccion(async (t) => {
    // El personal queda "sin sucursal"; los pedidos conservan el nombre de la sucursal
    await t.ejecutar('UPDATE personal SET sucursal_id = NULL WHERE sucursal_id = ?', s.id);
    await t.ejecutar('UPDATE pedidos SET sucursal_retiro_id = NULL WHERE sucursal_retiro_id = ?', s.id);
    await t.ejecutar('DELETE FROM sucursales WHERE id = ?', s.id);
  });
  await bitacora.registrar(req, 'Sucursal eliminada', s.nombre);
  res.json({ mensaje: `Sucursal "${s.nombre}" eliminada. Revise el personal que trabajaba ahí.` });
});

// =================== PERSONAL ===================
async function leerPersona(b) {
  const sucursalId = b.sucursal_id ? v.entero(b.sucursal_id, 'Sucursal', { min: 1 }) : null;
  if (sucursalId && !(await uno('SELECT id FROM sucursales WHERE id = ?', sucursalId))) throw new v.ErrorUsuario('La sucursal no existe.');
  return {
    nombre: v.texto(b.nombre, 'Nombre', { requerido: true, max: 80 }),
    puesto: v.texto(b.puesto, 'Puesto', { requerido: true, max: 80 }),
    descripcion: v.texto(b.descripcion, 'Descripción', { max: 300 }),
    sucursalId,
    orden: v.entero(b.orden || 0, 'Orden', { min: 0, max: 999 }),
  };
}
router.get('/api/personal', async (req, res) => {
  res.json(await todos('SELECT p.*, s.nombre AS sucursal FROM personal p LEFT JOIN sucursales s ON s.id = p.sucursal_id ORDER BY s.orden, p.orden, p.nombre'));
});
router.post('/api/personal', subirPersonal.single('foto'), async (req, res) => {
  const p = await leerPersona(req.body || {});
  const foto = req.file ? await archivos.guardar(req.file) : '';
  await ejecutar('INSERT INTO personal (nombre, puesto, sucursal_id, descripcion, foto, orden) VALUES (?, ?, ?, ?, ?, ?)',
    p.nombre, p.puesto, p.sucursalId, p.descripcion, foto, p.orden);
  await bitacora.registrar(req, 'Personal agregado', `${p.nombre} (${p.puesto})`);
  res.status(201).json({ mensaje: 'Persona agregada.' });
});
router.put('/api/personal/:id', subirPersonal.single('foto'), async (req, res) => {
  const actual = await uno('SELECT * FROM personal WHERE id = ?', Number(req.params.id));
  if (!actual) throw new v.ErrorUsuario('La persona no existe.', 404);
  const p = await leerPersona(req.body || {});
  let foto = actual.foto;
  if (req.file) { await archivos.borrar(foto); foto = await archivos.guardar(req.file); }
  if (v.booleano(req.body?.quitar_foto)) { await archivos.borrar(foto); foto = ''; }
  await ejecutar('UPDATE personal SET nombre = ?, puesto = ?, sucursal_id = ?, descripcion = ?, foto = ?, orden = ? WHERE id = ?',
    p.nombre, p.puesto, p.sucursalId, p.descripcion, foto, p.orden, actual.id);
  await bitacora.registrar(req, 'Personal editado', `${p.nombre} (${p.puesto})`);
  res.json({ mensaje: 'Datos actualizados.' });
});
router.delete('/api/personal/:id', async (req, res) => {
  const p = await uno('SELECT * FROM personal WHERE id = ?', Number(req.params.id));
  if (!p) throw new v.ErrorUsuario('La persona no existe.', 404);
  await ejecutar('DELETE FROM personal WHERE id = ?', p.id);
  await archivos.borrar(p.foto);
  await bitacora.registrar(req, 'Personal eliminado', p.nombre);
  res.json({ mensaje: `${p.nombre} se quitó de la lista de personal.` });
});

// =================== REPORTES ===================
router.get('/api/reportes', async (req, res) => {
  const mes = rangoPeriodo('mes', hoyCR());
  const desde = esFechaValida(req.query.desde) ? req.query.desde : mes.desde;
  const hastaIncl = esFechaValida(req.query.hasta) ? req.query.hasta : sumarDias(mes.hasta, -1);
  const hasta = sumarDias(hastaIncl, 1);
  const enRango = `p.estado_pago = 'hecho' AND ${FECHA_LOCAL('p.confirmado_en')} >= ? AND ${FECHA_LOCAL('p.confirmado_en')} < ?`;

  const resumen = await uno(`SELECT COALESCE(SUM(p.total), 0) AS ventas, COUNT(*) AS pedidos FROM pedidos p WHERE ${enRango}`, desde, hasta);
  resumen.ticket_promedio = resumen.pedidos ? Math.round(resumen.ventas / resumen.pedidos) : 0;
  resumen.pedidos_creados = (await uno(`SELECT COUNT(*) AS n FROM pedidos p WHERE ${FECHA_LOCAL('p.creado_en')} >= ? AND ${FECHA_LOCAL('p.creado_en')} < ?`, desde, hasta)).n;
  resumen.clientes_nuevos = (await uno(`SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'cliente' AND ${FECHA_LOCAL('creado_en')} >= ? AND ${FECHA_LOCAL('creado_en')} < ?`, desde, hasta)).n;
  resumen.clientes_total = (await uno("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'cliente'")).n;

  res.json({
    desde, hasta: hastaIncl, resumen,
    top_productos: await todos(
      `SELECT d.producto_nombre AS nombre, SUM(d.cantidad) AS unidades, SUM(d.subtotal) AS monto
         FROM detalle_pedido d JOIN pedidos p ON p.id = d.pedido_id WHERE ${enRango}
        GROUP BY COALESCE(d.producto_id, d.producto_nombre) ORDER BY unidades DESC, monto DESC LIMIT 10`, desde, hasta),
    por_categoria: await todos(
      `SELECT COALESCE(c.nombre, 'Sin categoría') AS nombre, SUM(d.subtotal) AS monto, SUM(d.cantidad) AS unidades
         FROM detalle_pedido d JOIN pedidos p ON p.id = d.pedido_id
         LEFT JOIN productos pr ON pr.id = d.producto_id LEFT JOIN categorias c ON c.id = pr.categoria_id
        WHERE ${enRango} GROUP BY c.id ORDER BY monto DESC`, desde, hasta),
    por_dia: await todos(
      `SELECT ${FECHA_LOCAL('p.confirmado_en')} AS dia, SUM(p.total) AS total, COUNT(*) AS pedidos
         FROM pedidos p WHERE ${enRango} GROUP BY dia ORDER BY dia`, desde, hasta),
    por_mes: await todos(
      `SELECT strftime('%Y-%m', p.confirmado_en, ${SQL_HORA_CR}) AS mes, SUM(p.total) AS total, COUNT(*) AS pedidos
         FROM pedidos p WHERE p.estado_pago = 'hecho' AND ${FECHA_LOCAL('p.confirmado_en')} >= ?
        GROUP BY mes ORDER BY mes`, sumarDias(hoyCR(), -365)),
    clientes: await todos(
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.creado_en,
              COUNT(p.id) AS pedidos,
              COALESCE(SUM(CASE WHEN p.estado_pago = 'hecho' THEN p.total END), 0) AS total_comprado,
              MAX(p.creado_en) AS ultimo_pedido
         FROM usuarios u LEFT JOIN pedidos p ON p.usuario_id = u.id
        WHERE u.rol = 'cliente' GROUP BY u.id ORDER BY total_comprado DESC, pedidos DESC LIMIT 50`),
  });
});

// =================== BITÁCORA ===================
router.get('/api/bitacora', async (req, res) => {
  const condiciones = [];
  const params = [];
  if (req.query.q) {
    condiciones.push('(accion LIKE ? OR detalle LIKE ? OR usuario_nombre LIKE ?)');
    const patron = `%${String(req.query.q).slice(0, 60)}%`;
    params.push(patron, patron, patron);
  }
  const limite = 100;
  const pagina = Math.max(Number(req.query.pagina) || 1, 1);
  const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
  const total = (await uno(`SELECT COUNT(*) AS n FROM bitacora ${where}`, ...params)).n;
  const filas = await todos(`SELECT * FROM bitacora ${where} ORDER BY id DESC LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`, ...params);
  res.json({ filas, total, pagina, paginas: Math.max(Math.ceil(total / limite), 1) });
});

// =================== EXPORTAR (CSV / Excel) ===================
const ESTADOS = `CASE estado_pago WHEN 'hecho' THEN 'Hecho' WHEN 'no_hecho' THEN 'No hecho' ELSE 'Por hacer' END`;
const EXPORTACIONES = {
  productos: {
    titulo: 'Productos',
    columnas: [['ID', 'id'], ['Nombre', 'nombre'], ['Categoría', 'categoria'], ['Precio (₡)', 'precio'], ['Precio oferta (₡)', 'precio_oferta'],
      ['Inventario', 'stock'], ['Destacado', 'destacado'], ['Activo', 'activo'], ['Descripción', 'descripcion']],
    sql: `SELECT p.id, p.nombre, c.nombre AS categoria, p.precio, p.precio_oferta, p.stock,
                 CASE p.destacado WHEN 1 THEN 'Sí' ELSE 'No' END AS destacado, CASE p.activo WHEN 1 THEN 'Sí' ELSE 'No' END AS activo, p.descripcion
            FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id ORDER BY c.orden, p.nombre`,
  },
  pedidos: {
    titulo: 'Pedidos',
    columnas: [['Pedido', 'codigo'], ['Fecha', 'fecha'], ['Cliente', 'cliente_nombre'], ['Correo', 'cliente_correo'], ['Teléfono', 'cliente_telefono'],
      ['Retiro en', 'sucursal_retiro_nombre'], ['Total (₡)', 'total'], ['Estado del pago', 'estado'], ['Comprobante', 'comprobante_numero'], ['Confirmado', 'confirmado']],
    sql: `SELECT codigo, ${HORA_LOCAL('creado_en')} AS fecha, cliente_nombre, cliente_correo, cliente_telefono, sucursal_retiro_nombre,
                 total, ${ESTADOS} AS estado, comprobante_numero, ${HORA_LOCAL('confirmado_en')} AS confirmado FROM pedidos ORDER BY id DESC`,
  },
  detalle: {
    titulo: 'Detalle de pedidos',
    columnas: [['Pedido', 'codigo'], ['Fecha', 'fecha'], ['Estado del pago', 'estado'], ['Producto', 'producto_nombre'],
      ['Cantidad', 'cantidad'], ['Precio unitario (₡)', 'precio_unitario'], ['Subtotal (₡)', 'subtotal']],
    sql: `SELECT p.codigo, ${HORA_LOCAL('p.creado_en')} AS fecha, ${ESTADOS} AS estado, d.producto_nombre, d.cantidad, d.precio_unitario, d.subtotal
            FROM detalle_pedido d JOIN pedidos p ON p.id = d.pedido_id ORDER BY p.id DESC`,
  },
  clientes: {
    titulo: 'Clientes',
    columnas: [['ID', 'id'], ['Nombre', 'nombre'], ['Correo', 'correo'], ['Teléfono', 'telefono'], ['Dirección', 'direccion'], ['Estado', 'estado'],
      ['Registrado', 'registrado'], ['Pedidos', 'pedidos'], ['Total comprado (₡)', 'total_comprado']],
    sql: `SELECT u.id, u.nombre, u.correo, u.telefono, u.direccion, u.estado, ${HORA_LOCAL('u.creado_en')} AS registrado,
                 COUNT(p.id) AS pedidos, COALESCE(SUM(CASE WHEN p.estado_pago = 'hecho' THEN p.total END), 0) AS total_comprado
            FROM usuarios u LEFT JOIN pedidos p ON p.usuario_id = u.id WHERE u.rol = 'cliente' GROUP BY u.id ORDER BY u.nombre`,
  },
  usuarios: {
    titulo: 'Usuarios',
    columnas: [['ID', 'id'], ['Nombre', 'nombre'], ['Correo', 'correo'], ['Rol', 'rol'], ['Estado', 'estado'], ['Creado', 'creado'], ['Último acceso', 'ultimo']],
    sql: `SELECT id, nombre, correo, rol, estado, ${HORA_LOCAL('creado_en')} AS creado, ${HORA_LOCAL('ultimo_acceso')} AS ultimo
            FROM usuarios WHERE rol <> 'superadmin' ORDER BY rol, nombre`,
  },
  inventario: {
    titulo: 'Movimientos de inventario',
    columnas: [['Fecha', 'fecha'], ['Producto', 'producto_nombre'], ['Tipo', 'tipo'], ['Cantidad', 'cantidad'], ['Antes', 'stock_anterior'],
      ['Después', 'stock_nuevo'], ['Motivo', 'motivo'], ['Usuario', 'usuario_nombre']],
    sql: `SELECT ${HORA_LOCAL('fecha')} AS fecha, producto_nombre, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_nombre
            FROM movimientos_inventario ORDER BY id DESC`,
  },
  bitacora: {
    titulo: 'Bitácora',
    columnas: [['Fecha', 'fecha'], ['Usuario', 'usuario_nombre'], ['Rol', 'rol'], ['Acción', 'accion'], ['Detalle', 'detalle'], ['IP', 'ip']],
    sql: `SELECT ${HORA_LOCAL('fecha')} AS fecha, usuario_nombre, rol, accion, detalle, ip FROM bitacora ORDER BY id DESC`,
  },
};

router.get('/api/exportar/:tipo', async (req, res) => {
  const def = EXPORTACIONES[req.params.tipo];
  if (!def) throw new v.ErrorUsuario('Tipo de exportación no válido.', 404);
  const columnas = def.columnas.map(([titulo, campo]) => ({ titulo, campo }));
  const filas = await todos(def.sql);
  const nombreBase = `ferreteria-max-${req.params.tipo}-${hoyCR()}`;
  await bitacora.registrar(req, 'Datos exportados', `${def.titulo} (${req.query.formato === 'xlsx' ? 'Excel' : 'CSV'}, ${filas.length} filas)`);
  if (req.query.formato === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreBase}.xlsx"`);
    return res.send(aXLSX(columnas, filas, def.titulo));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreBase}.csv"`);
  res.send(aCSV(columnas, filas));
});

// =================== RESPALDOS DE LA BASE DE DATOS ===================
// Los respaldos se generan al momento y se descargan (en Vercel no se
// pueden guardar archivos en el servidor).
const TABLAS_RESPALDO = ['configuracion', 'usuarios', 'categorias', 'productos', 'movimientos_inventario', 'sucursales',
  'personal', 'pedidos', 'detalle_pedido', 'mensajes_contacto', 'bitacora', 'archivos'];

router.get('/api/respaldo/info', (req, res) => res.json({ modo, permiteDB: modo === 'local' }));

router.get('/api/respaldo', async (req, res) => {
  const d = new Date(Date.now() - 6 * 3600 * 1000).toISOString(); // hora de Costa Rica
  const sello = `${d.slice(0, 10).replace(/-/g, '')}-${d.slice(11, 19).replace(/:/g, '')}`;

  if (req.query.formato === 'db') {
    if (modo !== 'local') throw new v.ErrorUsuario('La copia .db solo existe con la base local. Use el respaldo JSON.');
    // VACUUM INTO crea una copia limpia y consistente aunque el sitio esté en uso
    const temporal = path.join(os.tmpdir(), `ferreteria-${crypto.randomBytes(6).toString('hex')}.db`);
    await db.copiarA(temporal);
    await bitacora.registrar(req, 'Respaldo descargado', 'Archivo .db');
    return res.download(temporal, `ferreteria-${sello}.db`, () => fs.rm(temporal, { force: true }, () => {}));
  }

  // Respaldo JSON: todas las tablas (menos las sesiones), imágenes en base64
  const respaldo = { sistema: 'Ferretería Max', generado: new Date().toISOString(), modo, tablas: {} };
  for (const tabla of TABLAS_RESPALDO) {
    const filas = await todos(`SELECT * FROM ${tabla}`);
    respaldo.tablas[tabla] = filas.map((f) => (Buffer.isBuffer(f.datos) ? { ...f, datos: f.datos.toString('base64') } : f));
  }
  await bitacora.registrar(req, 'Respaldo descargado', 'Archivo JSON');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ferreteria-${sello}.json"`);
  res.send(JSON.stringify(respaldo, null, 1));
});

// Cualquier otra ruta bajo la ruta secreta: 404
router.use((req, res) => res.status(404).json({ error: 'No encontrado.' }));

module.exports = router;
