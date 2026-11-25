// =============================================================
//  rutas/publico.js — Lo que puede ver cualquier visitante.
//  Prefijo: /api
//  IMPORTANTE: aquí nunca se envía la columna "stock"; solo
//  la disponibilidad (disponible / pocas / agotado).
// =============================================================
const express = require('express');
const { uno, todos, ejecutar, sinTildes } = require('../db');
const v = require('../utilidades/validar');
const configuracion = require('../servicios/configuracion');
const { SQL_DISPONIBILIDAD } = require('../servicios/inventario');
const { crearLimitador } = require('../middleware/seguridad');
const { esPersonal } = require('../middleware/auth');

const router = express.Router();
const limiteContacto = crearLimitador({ maxIntentos: 5, ventanaMinutos: 30 });

// Columnas públicas de un producto (sin stock)
const CAMPOS_PRODUCTO = `p.id, p.nombre, p.categoria_id, c.nombre AS categoria, c.icono AS categoria_icono,
  p.descripcion, p.precio, p.precio_oferta, COALESCE(p.precio_oferta, p.precio) AS precio_final,
  p.imagen, p.destacado, ${SQL_DISPONIBILIDAD} AS disponibilidad`;

// ---------- Configuración pública del sitio ----------
router.get('/configuracion', async (req, res) => {
  const c = await configuracion.obtener();
  res.json({
    nombre_tienda: c.nombre_tienda, eslogan: c.eslogan, logo: c.logo,
    color_primario: c.color_primario, color_secundario: c.color_secundario,
    sinpe_numero: c.sinpe_numero, sinpe_titular: c.sinpe_titular,
    telefono: c.telefono, correo: c.correo, whatsapp: c.whatsapp,
    horario_general: c.horario_general, banners: c.banners,
    ventas_activas: c.ventas_activas, mensaje_ventas: c.mensaje_ventas,
    // El navegador muestra el aviso de mantenimiento (solo a quien no es personal)
    mantenimiento: c.mantenimiento && !esPersonal(req.usuario),
    mensaje_mantenimiento: c.mantenimiento ? c.mensaje_mantenimiento : '',
  });
});

// ---------- Categorías ----------
router.get('/categorias', async (req, res) => {
  res.json(await todos(`
    SELECT c.id, c.nombre, c.descripcion, c.icono,
           (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id AND p.activo = 1) AS total
      FROM categorias c ORDER BY c.orden, c.nombre`));
});

// ---------- Productos (catálogo con filtros) ----------
router.get('/productos', async (req, res) => {
  const q = req.query;
  const condiciones = ['p.activo = 1'];
  const params = [];

  if (q.ids) {
    const ids = String(q.ids).split(',').map(Number).filter(Number.isInteger).slice(0, 100);
    if (!ids.length) return res.json({ productos: [], total: 0 });
    condiciones.push(`p.id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }
  if (q.categoria) { condiciones.push('p.categoria_id = ?'); params.push(Number(q.categoria)); }
  if (q.min) { condiciones.push('COALESCE(p.precio_oferta, p.precio) >= ?'); params.push(Number(q.min) || 0); }
  if (q.max) { condiciones.push('COALESCE(p.precio_oferta, p.precio) <= ?'); params.push(Number(q.max) || 0); }
  if (q.destacados === '1') condiciones.push('p.destacado = 1');
  if (q.ofertas === '1') condiciones.push('p.precio_oferta IS NOT NULL');
  if (q.disponibles === '1') condiciones.push('p.stock > 0');

  const ORDENES = {
    nombre: 'p.nombre COLLATE NOCASE',
    precio_asc: 'precio_final ASC',
    precio_desc: 'precio_final DESC',
    recientes: 'p.id DESC',
  };
  const orden = ORDENES[q.orden] || 'c.orden, p.nombre COLLATE NOCASE';
  const limite = Math.min(Number(q.limite) || 200, 200);

  let productos = await todos(
    `SELECT ${CAMPOS_PRODUCTO} FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE ${condiciones.join(' AND ')} ORDER BY ${orden}`,
    ...params
  );
  // Búsqueda por texto sin importar tildes ni mayúsculas: "electrica" encuentra "Eléctrica".
  // Se hace aquí (en JavaScript) para que funcione igual en la base local y en Turso.
  if (q.q) {
    const palabras = sinTildes(String(q.q).slice(0, 80)).split(/\s+/).filter(Boolean);
    productos = productos.filter((p) => {
      const texto = sinTildes(`${p.nombre} ${p.descripcion} ${p.categoria}`);
      return palabras.every((w) => texto.includes(w));
    });
  }
  productos = productos.slice(0, limite);
  res.json({ productos, total: productos.length });
});

router.get('/productos/:id', async (req, res) => {
  const producto = await uno(
    `SELECT ${CAMPOS_PRODUCTO} FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id = ? AND p.activo = 1`,
    Number(req.params.id)
  );
  if (!producto) throw new v.ErrorUsuario('Este producto no existe o ya no está a la venta.', 404);
  const relacionados = await todos(
    `SELECT ${CAMPOS_PRODUCTO} FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.activo = 1 AND p.categoria_id = ? AND p.id <> ? ORDER BY RANDOM() LIMIT 4`,
    producto.categoria_id, producto.id
  );
  res.json({ producto, relacionados });
});

// ---------- Sucursales y personal ----------
router.get('/sucursales', async (req, res) => {
  res.json(await todos('SELECT id, nombre, direccion, telefono, correo, horario, latitud, longitud FROM sucursales WHERE activa = 1 ORDER BY orden, nombre'));
});

router.get('/personal', async (req, res) => {
  res.json(await todos(`
    SELECT pe.id, pe.nombre, pe.puesto, pe.descripcion, pe.foto, pe.sucursal_id, s.nombre AS sucursal
      FROM personal pe LEFT JOIN sucursales s ON s.id = pe.sucursal_id
     ORDER BY s.orden, pe.orden, pe.nombre`));
});

// ---------- Formulario de contacto ----------
router.post('/contacto', async (req, res) => {
  const b = req.body || {};
  if (limiteContacto.bloqueado(req.ip)) {
    throw new v.ErrorUsuario('Ya recibimos varios mensajes desde su conexión. Intente más tarde o llámenos.', 429);
  }
  const nombre = v.texto(b.nombre, 'Nombre', { requerido: true, max: 80 });
  const correo = v.correo(b.correo);
  const telefono = v.telefono(b.telefono);
  const asunto = v.texto(b.asunto, 'Asunto', { max: 120 });
  const mensaje = v.texto(b.mensaje, 'Mensaje', { requerido: true, max: 2000, min: 10 });
  await ejecutar('INSERT INTO mensajes_contacto (nombre, correo, telefono, asunto, mensaje) VALUES (?, ?, ?, ?, ?)',
    nombre, correo, telefono, asunto, mensaje);
  limiteContacto.fallo(req.ip); // cuenta el envío
  res.status(201).json({ mensaje: 'Recibimos su mensaje. Le responderemos en horario de oficina.' });
});

module.exports = router;
