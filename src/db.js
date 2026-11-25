// =============================================================
//  db.js — Conexión a la base de datos.
//
//  La misma aplicación funciona de dos formas:
//   • LOCAL (su computadora): SQLite en el archivo datos/ferreteria.db,
//     usando el SQLite que ya trae Node.js (node:sqlite).
//   • NUBE (Vercel): Turso, una base SQLite en internet. Se activa
//     cuando existe la variable TURSO_DATABASE_URL.
//
//  Para el resto del código no hay diferencia: todo se usa con
//  await uno(...), await todos(...), await ejecutar(...) y
//  await transaccion(...). El SQL es el mismo en los dos casos.
// =============================================================
const config = require('./config');

// Normaliza los valores que se mandan a SQLite
const valor = (v) => {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' && !Number.isFinite(v)) return null; // NaN (ej.: un id que no es número)
  return v;
};
const argumentos = (args) => args.map(valor);

/** Convierte un BLOB (imagen) al tipo Buffer de Node */
const aBuffer = (v) => (v instanceof ArrayBuffer ? Buffer.from(v) : v instanceof Uint8Array ? Buffer.from(v.buffer, v.byteOffset, v.byteLength) : v);
const limpiarFila = (fila) => {
  if (!fila) return undefined;
  const obj = {};
  for (const [k, v] of Object.entries(fila)) obj[k] = aBuffer(v);
  return obj;
};

// =============================================================
//  Modo LOCAL: node:sqlite (síncrono por dentro, async por fuera)
// =============================================================
function crearLocal() {
  const { DatabaseSync } = require('node:sqlite');
  const conexion = new DatabaseSync(config.rutas.baseDatos);
  conexion.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  const metodos = {
    async uno(sql, ...args) { return limpiarFila(conexion.prepare(sql).get(...argumentos(args))); },
    async todos(sql, ...args) { return conexion.prepare(sql).all(...argumentos(args)).map(limpiarFila); },
    async ejecutar(sql, ...args) {
      const r = conexion.prepare(sql).run(...argumentos(args));
      return { cambios: Number(r.changes), ultimoId: Number(r.lastInsertRowid) };
    },
  };

  // Una transacción a la vez (evita que dos peticiones se mezclen)
  let cola = Promise.resolve();
  function transaccion(fn) {
    const turno = cola.then(async () => {
      conexion.exec('BEGIN IMMEDIATE');
      try {
        const r = await fn(metodos);
        conexion.exec('COMMIT');
        return r;
      } catch (e) {
        conexion.exec('ROLLBACK');
        throw e;
      }
    });
    cola = turno.catch(() => {});
    return turno;
  }

  return {
    modo: 'local',
    ...metodos,
    transaccion,
    async lote(sentencias) {
      return transaccion(async (t) => { for (const [sql, args = []] of sentencias) await t.ejecutar(sql, ...args); });
    },
    async script(sql) { conexion.exec(sql); },
    /** Copia completa del archivo de base de datos (solo en modo local) */
    async copiarA(ruta) { conexion.exec(`VACUUM INTO '${ruta.replace(/'/g, "''")}'`); },
    cerrar() { try { conexion.close(); } catch { /* ya cerrada */ } },
  };
}

// =============================================================
//  Modo NUBE: Turso / libSQL (por internet)
// =============================================================
function crearLibsql({ url, authToken, cliente }) {
  // En la nube se usa la versión "web" del cliente (no necesita nada nativo).
  // DB_CLIENTE=libsql-archivo sirve para probar este mismo código sin internet.
  const { createClient } = cliente === 'nodo' || url.startsWith('file:') ? require('@libsql/client') : require('@libsql/client/web');
  const conexion = createClient({ url, authToken });

  const aFilas = (rs) => rs.rows.map((fila) => {
    const obj = {};
    rs.columns.forEach((col, i) => { obj[col] = aBuffer(fila[i] !== undefined ? fila[i] : fila[col]); });
    return obj;
  });
  const metodosDe = (ejecutor) => ({
    async uno(sql, ...args) { return aFilas(await ejecutor.execute({ sql, args: argumentos(args) }))[0]; },
    async todos(sql, ...args) { return aFilas(await ejecutor.execute({ sql, args: argumentos(args) })); },
    async ejecutar(sql, ...args) {
      const r = await ejecutor.execute({ sql, args: argumentos(args) });
      return { cambios: r.rowsAffected, ultimoId: r.lastInsertRowid === undefined ? 0 : Number(r.lastInsertRowid) };
    },
  });

  return {
    modo: 'nube',
    ...metodosDe(conexion),
    async transaccion(fn) {
      const tx = await conexion.transaction('write');
      try {
        const r = await fn(metodosDe(tx));
        await tx.commit();
        return r;
      } catch (e) {
        await tx.rollback().catch(() => {});
        throw e;
      } finally {
        tx.close();
      }
    },
    /** Varias sentencias en un solo viaje por internet, todas o ninguna */
    async lote(sentencias) {
      await conexion.batch(sentencias.map(([sql, args = []]) => ({ sql, args: argumentos(args) })), 'write');
    },
    async script(sql) { await conexion.executeMultiple(sql); },
    async copiarA() { throw new Error('La copia .db solo existe en modo local.'); },
    cerrar() { conexion.close(); },
  };
}

// En Vercel sin Turso configurado: cada consulta explica qué falta
function crearSinConfigurar() {
  const { ErrorUsuario } = require('./utilidades/validar');
  const falla = async () => {
    throw new ErrorUsuario('Falta configurar la base de datos: agregue TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en Vercel y vuelva a desplegar.', 503);
  };
  return { modo: 'sin-configurar', uno: falla, todos: falla, ejecutar: falla, transaccion: falla, lote: falla, script: falla, copiarA: falla, cerrar() {} };
}

let db;
if (config.enVercel && !config.turso.url) {
  db = crearSinConfigurar();
} else if (config.turso.url) {
  db = crearLibsql({ url: config.turso.url, authToken: config.turso.token });
} else if (process.env.DB_CLIENTE === 'libsql-archivo') {
  db = crearLibsql({ url: `file:${config.rutas.baseDatos}`, cliente: 'nodo' });
} else {
  db = crearLocal();
}

// ---------- Tablas ----------
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre          TEXT NOT NULL,
  correo          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  telefono        TEXT DEFAULT '',
  direccion       TEXT DEFAULT '',
  hash_contrasena TEXT NOT NULL,
  rol             TEXT NOT NULL CHECK (rol IN ('cliente','admin','superadmin')),
  estado          TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','suspendido')),
  creado_en       TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_acceso   TEXT
);
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash  TEXT PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creada_en   TEXT NOT NULL DEFAULT (datetime('now')),
  expira_en   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  descripcion TEXT DEFAULT '',
  icono       TEXT DEFAULT '🔧',
  orden       INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS productos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT NOT NULL,
  categoria_id   INTEGER REFERENCES categorias(id) ON DELETE RESTRICT,
  descripcion    TEXT DEFAULT '',
  precio         INTEGER NOT NULL CHECK (precio >= 0),
  precio_oferta  INTEGER CHECK (precio_oferta IS NULL OR precio_oferta >= 0),
  imagen         TEXT DEFAULT '',
  stock          INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  destacado      INTEGER NOT NULL DEFAULT 0,
  activo         INTEGER NOT NULL DEFAULT 1,
  creado_en      TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT
);
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id     INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  producto_nombre TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste','venta_web','devolucion')),
  cantidad        INTEGER NOT NULL,
  stock_anterior  INTEGER NOT NULL,
  stock_nuevo     INTEGER NOT NULL,
  motivo          TEXT DEFAULT '',
  pedido_id       INTEGER,
  usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre  TEXT DEFAULT '',
  fecha           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sucursales (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  direccion TEXT NOT NULL,
  telefono  TEXT DEFAULT '',
  correo    TEXT DEFAULT '',
  horario   TEXT DEFAULT '',
  latitud   REAL,
  longitud  REAL,
  activa    INTEGER NOT NULL DEFAULT 1,
  orden     INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS personal (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  puesto      TEXT NOT NULL,
  sucursal_id INTEGER REFERENCES sucursales(id) ON DELETE SET NULL,
  descripcion TEXT DEFAULT '',
  foto        TEXT DEFAULT '',
  orden       INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pedidos (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo                 TEXT UNIQUE,
  usuario_id             INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  cliente_nombre         TEXT NOT NULL,
  cliente_correo         TEXT NOT NULL,
  cliente_telefono       TEXT DEFAULT '',
  sucursal_retiro_id     INTEGER REFERENCES sucursales(id) ON DELETE SET NULL,
  sucursal_retiro_nombre TEXT DEFAULT '',
  notas                  TEXT DEFAULT '',
  total                  INTEGER NOT NULL,
  sinpe_numero           TEXT DEFAULT '',
  estado_pago            TEXT NOT NULL DEFAULT 'por_hacer' CHECK (estado_pago IN ('por_hacer','hecho','no_hecho')),
  comprobante_numero     TEXT DEFAULT '',
  comprobante_imagen     TEXT DEFAULT '',
  comprobante_enviado_en TEXT,
  nota_admin             TEXT DEFAULT '',
  inventario_descontado  INTEGER NOT NULL DEFAULT 0,
  creado_en              TEXT NOT NULL DEFAULT (datetime('now')),
  confirmado_en          TEXT,
  actualizado_en         TEXT
);
CREATE TABLE IF NOT EXISTS detalle_pedido (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id     INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  producto_nombre TEXT NOT NULL,
  precio_unitario INTEGER NOT NULL,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  subtotal        INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT
);
CREATE TABLE IF NOT EXISTS bitacora (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id     INTEGER,
  usuario_nombre TEXT DEFAULT '',
  rol            TEXT DEFAULT '',
  accion         TEXT NOT NULL,
  detalle        TEXT DEFAULT '',
  ip             TEXT DEFAULT '',
  fecha          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mensajes_contacto (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  correo    TEXT NOT NULL,
  telefono  TEXT DEFAULT '',
  asunto    TEXT DEFAULT '',
  mensaje   TEXT NOT NULL,
  leido     INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS archivos (
  id        TEXT PRIMARY KEY,
  tipo      TEXT NOT NULL,
  datos     BLOB NOT NULL,
  privado   INTEGER NOT NULL DEFAULT 0,
  tamano    INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado_pago);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora(fecha);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
`;

async function crearTablas() {
  await db.script(ESQUEMA);
}

/** Quita tildes y pasa a minúsculas: "Eléctrica" → "electrica" (para el buscador) */
const sinTildes = (s) => (s == null ? '' : String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());

module.exports = {
  db,
  modo: db.modo,
  uno: (...a) => db.uno(...a),
  todos: (...a) => db.todos(...a),
  ejecutar: (...a) => db.ejecutar(...a),
  transaccion: (fn) => db.transaccion(fn),
  lote: (s) => db.lote(s),
  crearTablas,
  sinTildes,
  ESQUEMA,
};
