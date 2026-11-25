// =============================================================
//  semilla.js — Prepara la base de datos al arrancar:
//   1. Crea las tablas si no existen.
//   2. Si está vacía, carga los datos de ejemplo (en un solo envío,
//      para que en la nube sea rápido).
//   3. Crea o restablece la cuenta del súper admin desde .env.
// =============================================================
const bcrypt = require('bcryptjs');
const { uno, ejecutar, lote, crearTablas } = require('./db');
const config = require('./config');
const configuracion = require('./servicios/configuracion');
const { limpiarSesionesVencidas } = require('./middleware/auth');
const D = require('./datos-ejemplo');

/** Fecha UTC de hace N días, con la hora indicada */
const hace = (dias, hora = '15:00:00') => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10) + ' ' + hora;
const codigo = (id) => 'FM-' + String(id).padStart(6, '0');

/** Arma todas las sentencias INSERT de los datos de ejemplo */
function sentenciasDeEjemplo() {
  const S = [];
  // Marca: si dos copias del servidor arrancan a la vez, la segunda falla aquí y no duplica datos
  S.push(["INSERT INTO configuracion (clave, valor) VALUES ('datos_ejemplo_cargados', ?)", [new Date().toISOString()]]);
  S.push(...configuracion.sentenciasIniciales());

  // Categorías
  const idCategoria = {};
  D.CATEGORIAS.forEach(([nombre, icono, descripcion], i) => {
    idCategoria[nombre] = i + 1;
    S.push(['INSERT INTO categorias (id, nombre, descripcion, icono, orden) VALUES (?, ?, ?, ?, ?)', [i + 1, nombre, descripcion, icono, i + 1]]);
  });

  // Productos: se calcula el inventario final después de los pedidos "hecho"
  const producto = {};
  D.PRODUCTOS.forEach(([cat, nombre, descripcion, precio, oferta, stock, destacado], i) => {
    producto[nombre] = { id: i + 1, nombre, cat, descripcion, precio, oferta, stock, destacado, inicial: stock };
  });
  const movimientos = [];
  for (const p of Object.values(producto)) {
    if (p.inicial > 0) movimientos.push([p.id, p.nombre, 'entrada', p.inicial, 0, p.inicial, 'Inventario inicial', null, null, 'Sistema', hace(30, '13:00:00')]);
  }

  // Sucursales y personal
  D.SUCURSALES.forEach((s, i) => {
    S.push(['INSERT INTO sucursales (id, nombre, direccion, telefono, correo, horario, latitud, longitud, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [i + 1, ...s, i + 1]]);
  });
  D.PERSONAL.forEach(([nombre, puesto, suc, descripcion], i) => {
    S.push(['INSERT INTO personal (nombre, puesto, sucursal_id, descripcion, orden) VALUES (?, ?, ?, ?, ?)', [nombre, puesto, suc + 1, descripcion, i + 1]]);
  });

  // Usuarios de prueba (id 1 = admin, 2 y 3 = clientes)
  D.USUARIOS.forEach(([nombre, correo, telefono, contrasena, rol], i) => {
    S.push(['INSERT INTO usuarios (id, nombre, correo, telefono, hash_contrasena, rol, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [i + 1, nombre, correo, telefono, bcrypt.hashSync(contrasena, 10), rol, hace(25)]]);
  });
  const admin = { id: 1, nombre: D.USUARIOS[0][0] };

  // Pedidos de ejemplo (se agregan después de los productos)
  const P = [];
  D.PEDIDOS.forEach((pe, i) => {
    const id = i + 1;
    const [nombreU, correoU, telefonoU] = D.USUARIOS[pe.usuario];
    const lineas = pe.items.map(([nombre, cantidad]) => {
      const p = producto[nombre];
      const precio = p.oferta ?? p.precio;
      return { p, precio, cantidad, subtotal: precio * cantidad };
    });
    const total = lineas.reduce((s, l) => s + l.subtotal, 0);
    const creado = hace(pe.dias, `${String(14 + i).padStart(2, '0')}:10:00`);
    const confirmado = pe.estado === 'hecho' ? hace(pe.dias, `${String(15 + i).padStart(2, '0')}:30:00`) : null;
    const suc = i % D.SUCURSALES.length;
    P.push([`INSERT INTO pedidos (id, codigo, usuario_id, cliente_nombre, cliente_correo, cliente_telefono, sucursal_retiro_id,
              sucursal_retiro_nombre, total, sinpe_numero, estado_pago, comprobante_numero, comprobante_enviado_en, nota_admin,
              inventario_descontado, creado_en, confirmado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, codigo(id), pe.usuario + 1, nombreU, correoU, telefonoU, suc + 1, D.SUCURSALES[suc][0], total,
        configuracion.PREDETERMINADA.sinpe_numero, pe.estado, pe.comp, pe.comp ? creado : null, pe.nota || '',
        pe.estado === 'hecho' ? 1 : 0, creado, confirmado, confirmado || creado]]);
    for (const l of lineas) {
      P.push(['INSERT INTO detalle_pedido (pedido_id, producto_id, producto_nombre, precio_unitario, cantidad, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [id, l.p.id, l.p.nombre, l.precio, l.cantidad, l.subtotal]]);
      if (pe.estado === 'hecho') {
        const antes = l.p.stock;
        l.p.stock -= l.cantidad;
        movimientos.push([l.p.id, l.p.nombre, 'venta_web', -l.cantidad, antes, l.p.stock, `Pago confirmado del pedido ${codigo(id)}`, id, admin.id, admin.nombre, confirmado]);
      }
    }
  });

  // Ahora sí, los productos con su inventario final
  for (const p of Object.values(producto)) {
    S.push([`INSERT INTO productos (id, nombre, categoria_id, descripcion, precio, precio_oferta, imagen, stock, destacado, creado_en)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.nombre, idCategoria[p.cat], p.descripcion, p.precio, p.oferta, D.imagenProducto(p.nombre), p.stock, p.destacado, hace(30, '13:00:00')]]);
  }
  S.push(...P);
  for (const m of movimientos) {
    S.push([`INSERT INTO movimientos_inventario (producto_id, producto_nombre, tipo, cantidad, stock_anterior, stock_nuevo, motivo,
             pedido_id, usuario_id, usuario_nombre, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, m]);
  }

  S.push([`INSERT INTO mensajes_contacto (nombre, correo, telefono, asunto, mensaje) VALUES (?, ?, ?, ?, ?)`,
    ['Gabriela Rojas', 'gabriela@correo.cr', '8899-0011', 'Cotización de techo',
      'Buenas, quisiera cotizar 20 láminas de zinc de 3,66 m y los clavos de techo. ¿Hacen entregas a Curridabat?']]);
  S.push(["INSERT INTO bitacora (usuario_nombre, rol, accion, detalle) VALUES ('Sistema', '', 'Datos de ejemplo cargados', ?)",
    [`${D.CATEGORIAS.length} categorías, ${D.PRODUCTOS.length} productos, ${D.SUCURSALES.length} sucursales, ${D.PERSONAL.length} personas, ${D.PEDIDOS.length} pedidos`]]);
  return S;
}

async function sembrar() {
  try {
    await lote(sentenciasDeEjemplo());
    console.log(`✔  Datos de ejemplo cargados: ${D.PRODUCTOS.length} productos, ${D.SUCURSALES.length} sucursales y ${D.PERSONAL.length} personas.`);
  } catch (e) {
    // Otra copia del servidor los cargó al mismo tiempo: no pasa nada
    if (!/UNIQUE|constraint/i.test(e.message)) throw e;
  }
}

/** Crea el súper admin desde .env (o las variables de Vercel) si no existe */
async function asegurarSuperadmin() {
  const s = config.superadmin;
  if (!s.habilitado) return;
  const existente = await uno("SELECT * FROM usuarios WHERE rol = 'superadmin'");
  if (!existente) {
    if (await uno('SELECT id FROM usuarios WHERE correo = ?', s.correo)) {
      console.error(`⚠  El correo ${s.correo} ya lo usa otra cuenta. Cambie SUPERADMIN_CORREO.`);
      return;
    }
    try {
      await ejecutar("INSERT INTO usuarios (nombre, correo, hash_contrasena, rol) VALUES (?, ?, ?, 'superadmin')",
        s.nombre, s.correo, bcrypt.hashSync(s.contrasena, 10));
      console.log('✔  Cuenta de súper administrador creada');
    } catch (e) {
      if (!/UNIQUE|constraint/i.test(e.message)) throw e; // otra copia la creó al mismo tiempo
    }
  } else if (s.restablecer) {
    await ejecutar("UPDATE usuarios SET nombre = ?, correo = ?, hash_contrasena = ?, estado = 'activo' WHERE id = ?",
      s.nombre, s.correo, bcrypt.hashSync(s.contrasena, 10), existente.id);
    await ejecutar('DELETE FROM sesiones WHERE usuario_id = ?', existente.id);
    console.log('✔  Súper admin restablecido con los datos de configuración. Cambie RESTABLECER_SUPERADMIN a "no".');
  }
}

async function inicializarDatos() {
  await crearTablas();
  const { n } = await uno('SELECT COUNT(*) AS n FROM categorias');
  if (n === 0) await sembrar();
  await asegurarSuperadmin();
  await limpiarSesionesVencidas();
}

module.exports = { inicializarDatos };
