// =============================================================
//  rutas/admin.js — Panel del administrador.
//  Prefijo: /api/admin   (lo pueden usar "admin" y "superadmin")
// =============================================================
const express = require('express');
const { uno, todos, ejecutar, transaccion } = require('../db');
const v = require('../utilidades/validar');
const { hoyCR, rangoPeriodo, SQL_HORA_CR, ahoraUTC } = require('../utilidades/fechas');
const { requiereRol } = require('../middleware/auth');
const { subirProducto } = require('../middleware/subidas');
const inventario = require('../servicios/inventario');
const archivos = require('../servicios/archivos');
const bitacora = require('../servicios/bitacora');
const configuracion = require('../servicios/configuracion');
const config = require('../config');

const router = express.Router();
router.use(requiereRol('admin', 'superadmin'));

const FECHA_LOCAL = (campo) => `date(${campo}, ${SQL_HORA_CR})`;
const colones = (n) => '₡' + Number(n || 0).toLocaleString('es-CR');

// =================== ESTADO GENERAL (para avisos y contadores del menú) ===================
router.get('/estado', async (req, res) => {
  const c = await configuracion.obtener();
  res.json({
    ventas_activas: c.ventas_activas,
    mantenimiento: c.mantenimiento,
    pendientes: (await uno("SELECT COUNT(*) AS n FROM pedidos WHERE estado_pago = 'por_hacer'")).n,
    mensajes_sin_leer: (await uno('SELECT COUNT(*) AS n FROM mensajes_contacto WHERE leido = 0')).n,
    nombre_tienda: c.nombre_tienda,
    logo: c.logo,
  });
});

// =================== PANEL DE CONTROL ===================
router.get('/resumen', async (req, res) => {
  const hoy = hoyCR();
  const mes = rangoPeriodo('mes', hoy);
  const ventas = (desde, hasta) => uno(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidad FROM pedidos
      WHERE estado_pago = 'hecho' AND ${FECHA_LOCAL('confirmado_en')} >= ? AND ${FECHA_LOCAL('confirmado_en')} < ?`,
    desde, hasta
  );
  res.json({
    hoy,
    ventas_dia: await ventas(hoy, rangoPeriodo('dia', hoy).hasta),
    ventas_mes: await ventas(mes.desde, mes.hasta),
    pendientes_total: (await uno("SELECT COUNT(*) AS n FROM pedidos WHERE estado_pago = 'por_hacer'")).n,
    pendientes: await todos(
      `SELECT id, codigo, cliente_nombre, total, creado_en, comprobante_numero FROM pedidos
        WHERE estado_pago = 'por_hacer' ORDER BY (comprobante_numero <> '') DESC, id ASC LIMIT 8`),
    pocas_unidades: await todos(
      'SELECT id, nombre, stock FROM productos WHERE activo = 1 AND stock > 0 AND stock < ? ORDER BY stock ASC',
      config.UMBRAL_DISPONIBLE),
    agotados: await todos('SELECT id, nombre FROM productos WHERE activo = 1 AND stock = 0 ORDER BY nombre'),
    pedidos_hoy: (await uno(`SELECT COUNT(*) AS n FROM pedidos WHERE ${FECHA_LOCAL('creado_en')} = ?`, hoy)).n,
    mensajes_sin_leer: (await uno('SELECT COUNT(*) AS n FROM mensajes_contacto WHERE leido = 0')).n,
  });
});

// =================== PRODUCTOS ===================
router.get('/productos', async (req, res) => {
  res.json(await todos(`
    SELECT p.*, c.nombre AS categoria, ${inventario.SQL_DISPONIBILIDAD} AS disponibilidad
      FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
     ORDER BY c.orden, p.nombre COLLATE NOCASE`));
});

async function leerProducto(b) {
  const nombre = v.texto(b.nombre, 'Nombre', { requerido: true, max: 120 });
  const categoriaId = v.entero(b.categoria_id, 'Categoría', { min: 1 });
  if (!(await uno('SELECT id FROM categorias WHERE id = ?', categoriaId))) throw new v.ErrorUsuario('La categoría no existe.');
  const descripcion = v.texto(b.descripcion, 'Descripción', { max: 2000 });
  const precio = v.entero(b.precio, 'Precio', { min: 0, max: 50_000_000 });
  const oferta = v.entero(b.precio_oferta, 'Precio de oferta', { min: 0, max: 50_000_000, requerido: false });
  if (oferta !== null && oferta >= precio) throw new v.ErrorUsuario('El precio de oferta debe ser menor que el precio normal.');
  return {
    nombre, categoriaId, descripcion, precio, oferta,
    destacado: v.booleano(b.destacado) ? 1 : 0,
    activo: b.activo === undefined ? 1 : v.booleano(b.activo) ? 1 : 0,
  };
}

router.post('/productos', subirProducto.single('imagen'), async (req, res) => {
  const p = await leerProducto(req.body || {});
  const stockInicial = v.entero(req.body?.stock_inicial || 0, 'Cantidad inicial', { min: 0, max: 1_000_000 });
  const imagen = req.file ? await archivos.guardar(req.file) : '';
  const id = await transaccion(async (t) => {
    const r = await t.ejecutar(
      `INSERT INTO productos (nombre, categoria_id, descripcion, precio, precio_oferta, imagen, stock, destacado, activo)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      p.nombre, p.categoriaId, p.descripcion, p.precio, p.oferta, imagen, p.destacado, p.activo
    );
    if (stockInicial > 0) {
      await inventario.moverStock(t, { productoId: r.ultimoId, delta: stockInicial, tipo: 'entrada', motivo: 'Inventario inicial', usuario: req.usuario });
    }
    return r.ultimoId;
  });
  await bitacora.registrar(req, 'Producto creado', `${p.nombre} (${colones(p.precio)})`);
  res.status(201).json({ mensaje: 'Producto agregado al catálogo.', id });
});

router.put('/productos/:id', subirProducto.single('imagen'), async (req, res) => {
  const actual = await uno('SELECT * FROM productos WHERE id = ?', Number(req.params.id));
  if (!actual) throw new v.ErrorUsuario('El producto no existe.', 404);
  const p = await leerProducto(req.body || {});
  let imagen = actual.imagen;
  if (req.file) {
    imagen = await archivos.guardar(req.file);
    await archivos.borrar(actual.imagen);
  }
  await ejecutar(
    `UPDATE productos SET nombre = ?, categoria_id = ?, descripcion = ?, precio = ?, precio_oferta = ?, imagen = ?,
            destacado = ?, activo = ?, actualizado_en = ? WHERE id = ?`,
    p.nombre, p.categoriaId, p.descripcion, p.precio, p.oferta, imagen, p.destacado, p.activo, ahoraUTC(), actual.id
  );
  const cambios = [];
  if (actual.precio !== p.precio) cambios.push(`precio ${colones(actual.precio)} → ${colones(p.precio)}`);
  if (actual.precio_oferta !== p.oferta) cambios.push(`oferta ${p.oferta === null ? 'quitada' : colones(p.oferta)}`);
  if (actual.nombre !== p.nombre) cambios.push(`nombre "${actual.nombre}" → "${p.nombre}"`);
  if (actual.activo !== p.activo) cambios.push(p.activo ? 'activado' : 'desactivado');
  if (req.file) cambios.push('imagen nueva');
  await bitacora.registrar(req, 'Producto editado', `${p.nombre}${cambios.length ? ': ' + cambios.join(', ') : ''}`);
  res.json({ mensaje: 'Cambios guardados.' });
});

router.delete('/productos/:id', async (req, res) => {
  const p = await uno('SELECT * FROM productos WHERE id = ?', Number(req.params.id));
  if (!p) throw new v.ErrorUsuario('El producto no existe.', 404);
  const pendientes = (await uno(
    `SELECT COUNT(*) AS n FROM detalle_pedido d JOIN pedidos pe ON pe.id = d.pedido_id
      WHERE d.producto_id = ? AND pe.estado_pago = 'por_hacer'`, p.id)).n;
  if (pendientes > 0) {
    throw new v.ErrorUsuario(`Este producto está en ${pendientes} pedido(s) por verificar. Desactívelo en lugar de eliminarlo.`, 409);
  }
  await transaccion(async (t) => {
    // Los pedidos y el historial conservan el nombre, pero dejan de apuntar al producto
    await t.ejecutar('UPDATE detalle_pedido SET producto_id = NULL WHERE producto_id = ?', p.id);
    await t.ejecutar('UPDATE movimientos_inventario SET producto_id = NULL WHERE producto_id = ?', p.id);
    await t.ejecutar('DELETE FROM productos WHERE id = ?', p.id);
  });
  await archivos.borrar(p.imagen);
  await bitacora.registrar(req, 'Producto eliminado', p.nombre);
  res.json({ mensaje: `"${p.nombre}" se eliminó del catálogo.` });
});

// =================== CATEGORÍAS ===================
router.get('/categorias', async (req, res) => {
  res.json(await todos(`SELECT c.*, (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id) AS total
                    FROM categorias c ORDER BY c.orden, c.nombre`));
});

function leerCategoria(b) {
  return {
    nombre: v.texto(b.nombre, 'Nombre', { requerido: true, max: 60 }),
    descripcion: v.texto(b.descripcion, 'Descripción', { max: 300 }),
    icono: v.texto(b.icono, 'Ícono', { max: 8 }) || '🔧',
    orden: v.entero(b.orden || 0, 'Orden', { min: 0, max: 999 }),
  };
}

router.post('/categorias', async (req, res) => {
  const c = leerCategoria(req.body || {});
  if (await uno('SELECT id FROM categorias WHERE nombre = ?', c.nombre)) throw new v.ErrorUsuario('Ya existe una categoría con ese nombre.', 409);
  await ejecutar('INSERT INTO categorias (nombre, descripcion, icono, orden) VALUES (?, ?, ?, ?)', c.nombre, c.descripcion, c.icono, c.orden);
  await bitacora.registrar(req, 'Categoría creada', c.nombre);
  res.status(201).json({ mensaje: 'Categoría creada.' });
});

router.put('/categorias/:id', async (req, res) => {
  const actual = await uno('SELECT * FROM categorias WHERE id = ?', Number(req.params.id));
  if (!actual) throw new v.ErrorUsuario('La categoría no existe.', 404);
  const c = leerCategoria(req.body || {});
  if (await uno('SELECT id FROM categorias WHERE nombre = ? AND id <> ?', c.nombre, actual.id)) {
    throw new v.ErrorUsuario('Ya existe otra categoría con ese nombre.', 409);
  }
  await ejecutar('UPDATE categorias SET nombre = ?, descripcion = ?, icono = ?, orden = ? WHERE id = ?', c.nombre, c.descripcion, c.icono, c.orden, actual.id);
  await bitacora.registrar(req, 'Categoría editada', actual.nombre === c.nombre ? c.nombre : `${actual.nombre} → ${c.nombre}`);
  res.json({ mensaje: 'Categoría actualizada.' });
});

router.delete('/categorias/:id', async (req, res) => {
  const c = await uno('SELECT * FROM categorias WHERE id = ?', Number(req.params.id));
  if (!c) throw new v.ErrorUsuario('La categoría no existe.', 404);
  const n = (await uno('SELECT COUNT(*) AS n FROM productos WHERE categoria_id = ?', c.id)).n;
  if (n > 0) throw new v.ErrorUsuario(`No se puede eliminar: tiene ${n} producto(s). Muévalos a otra categoría primero.`, 409);
  await ejecutar('DELETE FROM categorias WHERE id = ?', c.id);
  await bitacora.registrar(req, 'Categoría eliminada', c.nombre);
  res.json({ mensaje: 'Categoría eliminada.' });
});

// =================== INVENTARIO ===================
router.get('/inventario/movimientos', async (req, res) => {
  const condiciones = [];
  const params = [];
  if (req.query.producto_id) { condiciones.push('producto_id = ?'); params.push(Number(req.query.producto_id)); }
  if (req.query.tipo) { condiciones.push('tipo = ?'); params.push(String(req.query.tipo)); }
  const limite = Math.min(Number(req.query.limite) || 100, 500);
  res.json(await todos(
    `SELECT * FROM movimientos_inventario ${condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : ''}
      ORDER BY id DESC LIMIT ${limite}`, ...params));
});

router.post('/inventario/movimiento', async (req, res) => {
  const b = req.body || {};
  const productoId = v.entero(b.producto_id, 'Producto', { min: 1 });
  const tipo = String(b.tipo || '');
  const motivo = v.texto(b.motivo, 'Motivo', { max: 200 });
  let delta;
  const resultado = await transaccion(async (t) => {
    if (tipo === 'entrada' || tipo === 'salida') {
      const cantidad = v.entero(b.cantidad, 'Cantidad', { min: 1, max: 1_000_000 });
      delta = tipo === 'entrada' ? cantidad : -cantidad;
    } else if (tipo === 'ajuste') {
      // Ajuste: el admin escribe la cantidad real que contó en bodega
      const real = v.entero(b.cantidad, 'Cantidad real', { min: 0, max: 1_000_000 });
      const actual = await t.uno('SELECT stock FROM productos WHERE id = ?', productoId);
      if (!actual) throw new v.ErrorUsuario('El producto no existe.', 404);
      delta = real - actual.stock;
      if (delta === 0) throw new v.ErrorUsuario('La cantidad es igual a la que ya está registrada.');
    } else {
      throw new v.ErrorUsuario('Tipo de movimiento no válido.');
    }
    return inventario.moverStock(t, { productoId, delta, tipo, motivo, usuario: req.usuario });
  });
  const p = await uno('SELECT nombre FROM productos WHERE id = ?', productoId);
  await bitacora.registrar(req, 'Inventario actualizado', `${p.nombre}: ${tipo} ${delta > 0 ? '+' : ''}${delta} (${resultado.anterior} → ${resultado.nuevo})${motivo ? ' · ' + motivo : ''}`);
  res.json({ mensaje: `Inventario de "${p.nombre}" actualizado: ahora hay ${resultado.nuevo}.`, ...resultado });
});

// =================== PEDIDOS ===================
router.get('/pedidos', async (req, res) => {
  const condiciones = [];
  const params = [];
  if (['por_hacer', 'hecho', 'no_hecho'].includes(req.query.estado)) { condiciones.push('estado_pago = ?'); params.push(req.query.estado); }
  if (req.query.q) {
    condiciones.push('(codigo LIKE ? OR cliente_nombre LIKE ? OR cliente_correo LIKE ? OR comprobante_numero LIKE ?)');
    const patron = `%${String(req.query.q).slice(0, 60)}%`;
    params.push(patron, patron, patron, patron);
  }
  res.json(await todos(
    `SELECT id, codigo, cliente_nombre, cliente_correo, cliente_telefono, total, estado_pago, comprobante_numero,
            comprobante_imagen <> '' AS tiene_foto, sucursal_retiro_nombre, creado_en, confirmado_en
       FROM pedidos ${condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`,
    ...params));
});

router.put('/pedidos/:id/estado', async (req, res) => {
  const estado = String(req.body?.estado || '');
  const nota = v.texto(req.body?.nota, 'Nota', { max: 300 });
  const r = await inventario.cambiarEstadoPago(Number(req.params.id), estado, nota, req.usuario);
  const nombres = { por_hacer: 'Por hacer', hecho: 'Hecho', no_hecho: 'No hecho' };
  await bitacora.registrar(req, 'Pago SINPE actualizado', `${r.codigo}: ${nombres[r.anterior]} → ${nombres[r.nuevo]}${nota ? ' · ' + nota : ''}`);
  const extra = r.nuevo === 'hecho' && r.anterior !== 'hecho' ? ' El inventario se descontó.'
    : r.anterior === 'hecho' && r.nuevo !== 'hecho' ? ' Las unidades se devolvieron al inventario.' : '';
  res.json({ mensaje: `Pedido ${r.codigo} marcado como "${nombres[r.nuevo]}".${extra}` });
});

// =================== TOTAL SINPE ===================
router.get('/sinpe', async (req, res) => {
  const periodo = ['dia', 'semana', 'mes'].includes(req.query.periodo) ? req.query.periodo : 'dia';
  const { desde, hasta } = rangoPeriodo(periodo, req.query.fecha);
  const pagos = await todos(
    `SELECT id, codigo, cliente_nombre, total, comprobante_numero, confirmado_en FROM pedidos
      WHERE estado_pago = 'hecho' AND ${FECHA_LOCAL('confirmado_en')} >= ? AND ${FECHA_LOCAL('confirmado_en')} < ?
      ORDER BY confirmado_en DESC`, desde, hasta);
  res.json({
    periodo, desde, hasta,
    total: pagos.reduce((s, p) => s + p.total, 0),
    cantidad: pagos.length,
    pagos,
  });
});

// =================== MENSAJES DE CONTACTO ===================
router.get('/mensajes', async (req, res) => {
  res.json(await todos('SELECT * FROM mensajes_contacto ORDER BY leido ASC, id DESC LIMIT 300'));
});
router.put('/mensajes/:id/leido', async (req, res) => {
  await ejecutar('UPDATE mensajes_contacto SET leido = ? WHERE id = ?', v.booleano(req.body?.leido) ? 1 : 0, Number(req.params.id));
  res.json({ mensaje: 'Mensaje actualizado.' });
});
router.delete('/mensajes/:id', async (req, res) => {
  await ejecutar('DELETE FROM mensajes_contacto WHERE id = ?', Number(req.params.id));
  await bitacora.registrar(req, 'Mensaje de contacto eliminado', `#${req.params.id}`);
  res.json({ mensaje: 'Mensaje eliminado.' });
});

module.exports = router;
