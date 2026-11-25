// =============================================================
//  rutas/cliente.js — Pedidos del cliente y comprobantes SINPE.
//  Prefijo: /api
// =============================================================
const express = require('express');
const { uno, todos, ejecutar, transaccion } = require('../db');
const v = require('../utilidades/validar');
const configuracion = require('../servicios/configuracion');
const archivos = require('../servicios/archivos');
const { requiereLogin, requiereRol, esPersonal } = require('../middleware/auth');
const { subirComprobante } = require('../middleware/subidas');

const router = express.Router();

const codigoPedido = (id) => 'FM-' + String(id).padStart(6, '0');

/** Devuelve el pedido si el usuario es el dueño o es personal de la ferretería */
async function pedidoVisible(req, id) {
  const pedido = await uno('SELECT * FROM pedidos WHERE id = ?', Number(id));
  if (!pedido || (pedido.usuario_id !== req.usuario.id && !esPersonal(req.usuario))) {
    throw new v.ErrorUsuario('No encontramos ese pedido.', 404);
  }
  return pedido;
}

async function formatearPedido(p, items) {
  const { sinpe_titular } = await configuracion.obtener();
  return {
    id: p.id, codigo: p.codigo, total: p.total, estado_pago: p.estado_pago,
    sinpe_numero: p.sinpe_numero, sinpe_titular,
    sucursal_retiro: p.sucursal_retiro_nombre, notas: p.notas,
    comprobante_numero: p.comprobante_numero,
    comprobante_imagen: p.comprobante_imagen ? `/api/comprobantes/${p.comprobante_imagen}` : '',
    comprobante_enviado_en: p.comprobante_enviado_en, nota_admin: p.nota_admin,
    creado_en: p.creado_en, confirmado_en: p.confirmado_en,
    cliente_nombre: p.cliente_nombre, cliente_correo: p.cliente_correo, cliente_telefono: p.cliente_telefono,
    items,
  };
}

// ---------- Crear pedido ----------
router.post('/pedidos', requiereRol('cliente'), async (req, res) => {
  const ajustes = await configuracion.obtener();
  if (!ajustes.ventas_activas) throw new v.ErrorUsuario(ajustes.mensaje_ventas, 403);

  const b = req.body || {};
  if (!Array.isArray(b.items) || b.items.length === 0) throw new v.ErrorUsuario('Su carrito está vacío.');
  if (b.items.length > 60) throw new v.ErrorUsuario('El pedido tiene demasiados productos distintos.');

  // Une productos repetidos y valida cantidades
  const cantidades = new Map();
  for (const it of b.items) {
    const id = v.entero(it.producto_id, 'Producto', { min: 1 });
    const cantidad = v.entero(it.cantidad, 'Cantidad', { min: 1, max: 999 });
    cantidades.set(id, (cantidades.get(id) || 0) + cantidad);
  }

  const sucursal = await uno('SELECT id, nombre FROM sucursales WHERE id = ? AND activa = 1', Number(b.sucursal_retiro_id));
  if (!sucursal) throw new v.ErrorUsuario('Elija la sucursal donde va a retirar el pedido.');
  const notas = v.texto(b.notas, 'Notas', { max: 500 });

  const resultado = await transaccion(async (t) => {
    const lineas = [];
    for (const [id, cantidad] of cantidades) {
      const p = await t.uno('SELECT id, nombre, precio, precio_oferta, stock, activo FROM productos WHERE id = ?', id);
      if (!p || !p.activo) throw new v.ErrorUsuario('Uno de los productos ya no está disponible. Revise su carrito.', 409);
      if (p.stock === 0) throw new v.ErrorUsuario(`"${p.nombre}" está agotado. Quítelo del carrito para continuar.`, 409);
      // No decimos cuántas hay: el cliente nunca ve la cantidad exacta
      if (cantidad > p.stock) {
        throw new v.ErrorUsuario(`No tenemos suficientes unidades de "${p.nombre}" para esa cantidad. Pruebe con menos o consúltenos.`, 409);
      }
      const precio = p.precio_oferta ?? p.precio;
      lineas.push({ id: p.id, nombre: p.nombre, precio, cantidad, subtotal: precio * cantidad });
    }
    const total = lineas.reduce((s, l) => s + l.subtotal, 0);

    const r = await t.ejecutar(
      `INSERT INTO pedidos (usuario_id, cliente_nombre, cliente_correo, cliente_telefono,
         sucursal_retiro_id, sucursal_retiro_nombre, notas, total, sinpe_numero)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.usuario.id, req.usuario.nombre, req.usuario.correo, req.usuario.telefono || '',
      sucursal.id, sucursal.nombre, notas, total, ajustes.sinpe_numero
    );
    const pedidoId = r.ultimoId;
    const codigo = codigoPedido(pedidoId);
    await t.ejecutar('UPDATE pedidos SET codigo = ? WHERE id = ?', codigo, pedidoId);
    for (const l of lineas) {
      await t.ejecutar(
        'INSERT INTO detalle_pedido (pedido_id, producto_id, producto_nombre, precio_unitario, cantidad, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        pedidoId, l.id, l.nombre, l.precio, l.cantidad, l.subtotal
      );
    }
    return { id: pedidoId, codigo, total };
  });

  res.status(201).json({
    mensaje: `Pedido ${resultado.codigo} creado. Ahora haga el SINPE Móvil para confirmarlo.`,
    pedido: { ...resultado, sinpe_numero: ajustes.sinpe_numero, sinpe_titular: ajustes.sinpe_titular },
  });
});

// ---------- Mis pedidos ----------
router.get('/pedidos', requiereLogin, async (req, res) => {
  res.json(await todos(
    `SELECT p.id, p.codigo, p.total, p.estado_pago, p.creado_en, p.confirmado_en, p.sucursal_retiro_nombre,
            p.comprobante_numero, (SELECT SUM(cantidad) FROM detalle_pedido d WHERE d.pedido_id = p.id) AS unidades
       FROM pedidos p WHERE p.usuario_id = ? ORDER BY p.id DESC`,
    req.usuario.id
  ));
});

router.get('/pedidos/:id', requiereLogin, async (req, res) => {
  const pedido = await pedidoVisible(req, req.params.id);
  const items = await todos(
    `SELECT d.producto_id, d.producto_nombre, d.precio_unitario, d.cantidad, d.subtotal, pr.imagen
       FROM detalle_pedido d LEFT JOIN productos pr ON pr.id = d.producto_id WHERE d.pedido_id = ?`,
    pedido.id
  );
  res.json(await formatearPedido(pedido, items));
});

// ---------- Enviar comprobante SINPE (número y foto opcional) ----------
router.post('/pedidos/:id/comprobante', requiereRol('cliente'), subirComprobante.single('foto'), async (req, res) => {
  const pedido = await pedidoVisible(req, req.params.id);
  if (pedido.usuario_id !== req.usuario.id) throw new v.ErrorUsuario('No encontramos ese pedido.', 404);
  if (pedido.estado_pago === 'hecho') throw new v.ErrorUsuario('Este pedido ya tiene el pago confirmado.', 409);

  const numero = v.texto(req.body?.numero, 'Número de comprobante', { requerido: true, max: 40, min: 4 });
  if (!/^[A-Za-z0-9-]+$/.test(numero)) throw new v.ErrorUsuario('El número de comprobante solo puede tener letras, números y guiones.');

  let imagen = pedido.comprobante_imagen;
  if (req.file) {
    // La foto se guarda como PRIVADA: solo la ven el dueño del pedido y el personal
    const nueva = await archivos.guardar(req.file, { privado: true });
    await archivos.borrar(imagen);
    imagen = nueva;
  }
  // Si estaba "No hecho", vuelve a "Por hacer" para que lo revisen otra vez
  await ejecutar(
    `UPDATE pedidos SET comprobante_numero = ?, comprobante_imagen = ?, comprobante_enviado_en = datetime('now'),
            estado_pago = 'por_hacer', actualizado_en = datetime('now') WHERE id = ?`,
    numero, imagen, pedido.id
  );
  res.json({ mensaje: 'Comprobante recibido. Le avisaremos aquí cuando verifiquemos el pago.' });
});

// ---------- Ver la foto del comprobante (solo dueño o personal) ----------
router.get('/comprobantes/:archivo', requiereLogin, async (req, res) => {
  const nombre = String(req.params.archivo);
  const pedido = await uno('SELECT id, usuario_id FROM pedidos WHERE comprobante_imagen = ?', nombre);
  if (!pedido || (pedido.usuario_id !== req.usuario.id && !esPersonal(req.usuario))) {
    throw new v.ErrorUsuario('No encontrado.', 404);
  }
  const archivo = await archivos.obtener(nombre);
  if (!archivo) throw new v.ErrorUsuario('No encontrado.', 404);
  archivos.enviar(res, archivo, { privado: true });
});

module.exports = { router, codigoPedido };
