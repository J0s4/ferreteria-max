// =============================================================
//  config.js — Lee la configuración (.env en su computadora o las
//  variables de entorno de Vercel) y define las carpetas.
// =============================================================
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ARCHIVO_ENV = path.join(RAIZ, '.env');
const ARCHIVO_ENV_EJEMPLO = path.join(RAIZ, '.env.ejemplo');

// ¿Estamos corriendo en Vercel? (Vercel pone esta variable sola)
const EN_VERCEL = Boolean(process.env.VERCEL);

if (!EN_VERCEL) {
  // En su computadora: si no existe .env, se crea copiando .env.ejemplo
  if (!fs.existsSync(ARCHIVO_ENV) && fs.existsSync(ARCHIVO_ENV_EJEMPLO)) {
    fs.copyFileSync(ARCHIVO_ENV_EJEMPLO, ARCHIVO_ENV);
    console.log('ℹ  Se creó el archivo .env a partir de .env.ejemplo. Revíselo y cambie la contraseña del súper admin.');
  }
  // Node 22+ trae su propio lector de .env (no hace falta el paquete dotenv)
  try { process.loadEnvFile(ARCHIVO_ENV); } catch { console.warn('⚠  No se pudo leer .env; se usarán valores por defecto.'); }
}

const env = process.env;

// ---------- Súper admin ----------
// En Vercel el repositorio es público, así que la ruta secreta y la
// contraseña DEBEN venir de las variables de entorno; si faltan, el
// súper admin queda desactivado (nunca se usan los valores de ejemplo).
const faltanSecretosEnNube = EN_VERCEL && (!env.RUTA_SECRETA || !env.SUPERADMIN_CONTRASENA);

let rutaSecreta = (env.RUTA_SECRETA || '/acceso-fm-8q3z').trim();
if (!/^\/[a-zA-Z0-9-]{6,60}$/.test(rutaSecreta)) {
  console.warn('⚠  RUTA_SECRETA no es válida (use "/" + letras, números o guiones, mínimo 6). Se usará /acceso-fm-8q3z');
  rutaSecreta = '/acceso-fm-8q3z';
}

const config = {
  enVercel: EN_VERCEL,
  puerto: Number(env.PUERTO || env.PORT) || 3000,
  diasSesion: Number(env.DIAS_SESION) || 30,
  rutaSecreta,
  superadmin: {
    habilitado: !faltanSecretosEnNube,
    nombre: env.SUPERADMIN_NOMBRE || 'Administración General',
    correo: (env.SUPERADMIN_CORREO || 'creador@ferreteriamax.cr').toLowerCase(),
    contrasena: env.SUPERADMIN_CONTRASENA || 'Creador-Max-2026',
    restablecer: (env.RESTABLECER_SUPERADMIN || 'no').toLowerCase() === 'si',
  },
  // Base de datos en la nube (Turso). Si no hay URL, se usa el archivo local.
  turso: {
    url: (env.TURSO_DATABASE_URL || env.LIBSQL_URL || '').trim(),
    token: (env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN || '').trim(),
  },
  rutas: {
    raiz: RAIZ,
    publico: path.join(RAIZ, 'public'),
    privado: path.join(RAIZ, 'privado'),
    datos: path.join(RAIZ, 'datos'),
    baseDatos: path.join(RAIZ, 'datos', 'ferreteria.db'),
  },
  // Umbral de inventario que ve el cliente
  UMBRAL_DISPONIBLE: 20,
};

if (faltanSecretosEnNube) {
  console.error('⚠  Faltan RUTA_SECRETA o SUPERADMIN_CONTRASENA en las variables de Vercel: el súper admin queda desactivado.');
}

// En su computadora se crea la carpeta de datos si no existe
if (!EN_VERCEL && !config.turso.url) fs.mkdirSync(config.rutas.datos, { recursive: true });

module.exports = config;
