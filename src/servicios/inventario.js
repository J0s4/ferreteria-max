// =============================================================
//  inventario.js — Toda modificación de stock pasa por aquí,
//  así siempre queda un movimiento en el historial.
// =============================================================
const { transaccion } = require('../db');
const config = require('../config');
const { ErrorUsuario } = require('../utilidades/validar');
const { ahoraUTC } = require('../utilidades/fechas');

/** Lo único que ve el cliente: nunca la cantidad exacta */
function disponibilidad(stock) {
  if (stock >= config.UMBRAL_DISPONIBLE) return 'disponible';
  if (stock > 0) return 'pocas';
  return 'agotado';
}

/** Fragmento SQL que calcula la disponibilidad sin exponer el stock */
const SQL_DISPONIBILIDAD = `CASE WHEN p.stock >= ${config.UMBRAL_DISPONIBLE} THEN 'disponible'
  WHEN p.stock > 0 THEN 'pocas' ELSE 'agotado' END`;

/**
 * Suma o resta unidades a un producto y guarda el movimiento.
 * Se llama DENTRO de una transacción: "t" es esa transacción.
 * @param {number} delta positivo = entrada, negativo = salida
 */
async function moverStock(t, { productoId, delta, tipo, motivo = '', usuario = null, pedidoId = null }) {
  const producto = await t.uno('SELECT id, nombre, stock FROM productos WHERE id = ?', productoId);
  if (!producto) throw new ErrorUsuario('El producto no existe.', 404);
  const nuevo = producto.stock + delta;
  if (nuevo < 0) {
    throw new ErrorUsuario(
      `Inventario insuficiente de "${producto.nombre}": hay ${producto.stock} y se necesitan ${-delta}.`,
      409
    );
  }
  await t.ejecutar('UPDATE productos SET stock = ?, actualizado_en = ? WHERE id = ?', nuevo, ahoraUTC(), producto.id);
  await t.ejecutar(
    `INSERT INTO movimientos_inventario
       (producto_id, producto_nombre, tipo, cantidad, stock_anterior, stock_nuevo, motivo, pedido_id, usuario_id, usuario_nombre)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    producto.id, producto.nombre, tipo, delta, producto.stock, nuevo, motivo, pedidoId,
    usuario?.id ?? null, usuario?.nombre ?? 'Sistema'
  );
  return { anterior: producto.stock, nuevo };
}

/**
 * Cambia el estado de pago de un pedido.
 * - Al pasar a "hecho" se descuenta el inventario (una sola vez).
 * - Si un pedido "hecho" se cambia a otro estado, las unidades se devuelven.
 */
function cambiarEstadoPago(pedidoId, nuevoEstado, notaAdmin, usuario) {
  if (!['por_hacer', 'hecho', 'no_hecho'].includes(nuevoEstado)) {
    throw new ErrorUsuario('Estado de pago no válido.');
  }
  return transaccion(async (t) => {
    const pedido = await t.uno('SELECT * FROM pedidos WHERE id = ?', pedidoId);
    if (!pedido) throw new ErrorUsuario('El pedido no existe.', 404);
    const items = await t.todos('SELECT * FROM detalle_pedido WHERE pedido_id = ?', pedido.id);
    const ahora = ahoraUTC();

    if (nuevoEstado === 'hecho' && !pedido.inventario_descontado) {
      for (const it of items) {
        if (!it.producto_id) continue; // el producto fue eliminado del catálogo
        await moverStock(t, {
          productoId: it.producto_id, delta: -it.cantidad, tipo: 'venta_web',
          motivo: `Pago confirmado del pedido ${pedido.codigo}`, usuario, pedidoId: pedido.id,
        });
      }
      await t.ejecutar('UPDATE pedidos SET inventario_descontado = 1, confirmado_en = ? WHERE id = ?', ahora, pedido.id);
    }

    if (nuevoEstado !== 'hecho' && pedido.inventario_descontado) {
      for (const it of items) {
        if (!it.producto_id) continue;
        const existe = await t.uno('SELECT id FROM productos WHERE id = ?', it.producto_id);
        if (!existe) continue;
        await moverStock(t, {
          productoId: it.producto_id, delta: it.cantidad, tipo: 'devolucion',
          motivo: `Pago del pedido ${pedido.codigo} revertido`, usuario, pedidoId: pedido.id,
        });
      }
      await t.ejecutar('UPDATE pedidos SET inventario_descontado = 0, confirmado_en = NULL WHERE id = ?', pedido.id);
    }

    await t.ejecutar(
      'UPDATE pedidos SET estado_pago = ?, nota_admin = ?, actualizado_en = ? WHERE id = ?',
      nuevoEstado, notaAdmin ?? pedido.nota_admin, ahora, pedido.id
    );
    return { anterior: pedido.estado_pago, nuevo: nuevoEstado, codigo: pedido.codigo };
  });
}

module.exports = { disponibilidad, SQL_DISPONIBILIDAD, moverStock, cambiarEstadoPago };
