// =============================================================
//  configuracion.js — Información general del sitio (nombre, logo,
//  colores, SINPE, horarios, banners, ventas y mantenimiento).
//  Se guarda en la tabla "configuracion" como clave → valor.
//
//  Se guarda en memoria solo 3 segundos: en Vercel puede haber
//  varias copias del servidor a la vez y todas deben enterarse
//  rápido si el súper admin, por ejemplo, apaga las ventas.
// =============================================================
const { todos, transaccion } = require('../db');

const PREDETERMINADA = {
  nombre_tienda: 'Ferretería Max',
  eslogan: 'Todo para construir, reparar y pintar',
  logo: '',
  color_primario: '#F28C00',
  color_secundario: '#2A2E33',
  sinpe_numero: '8000-0000',
  sinpe_titular: 'Ferretería Max S.A.',
  telefono: '2200-1000',
  correo: 'info@ferreteriamax.cr',
  whatsapp: '8000-0000',
  horario_general:
    'Lunes a viernes: 7:00 a. m. a 5:30 p. m.\nSábados: 7:00 a. m. a 12:00 m. d.\nDomingos y feriados: cerrado',
  ventas_activas: '1',
  mensaje_ventas:
    'Por ahora las compras en línea están pausadas. Puede revisar el catálogo y comprar en cualquiera de nuestras sucursales.',
  mantenimiento: '0',
  mensaje_mantenimiento: 'Estamos haciendo mejoras en el sitio. Volvemos en unas horas.',
  banners: JSON.stringify([
    {
      titulo: 'Todo para construir, reparar y pintar',
      texto: 'Más de 40 productos en línea. Pague por SINPE Móvil y retire en la sucursal que le quede más cerca.',
      imagen: '',
      enlace: '/catalogo',
      texto_boton: 'Ver el catálogo',
    },
    {
      titulo: 'Pinturas con precio de temporada',
      texto: 'Látex, esmaltes y accesorios con descuento mientras dure el inventario.',
      imagen: '',
      enlace: '/catalogo?ofertas=1',
      texto_boton: 'Ver ofertas',
    },
  ]),
};

const DURACION_CACHE_MS = 3000;
let cache = null;
let cacheHasta = 0;

async function cargar() {
  const filas = await todos('SELECT clave, valor FROM configuracion');
  cache = { ...PREDETERMINADA };
  for (const f of filas) if (f.clave in PREDETERMINADA) cache[f.clave] = f.valor;
  cacheHasta = Date.now() + DURACION_CACHE_MS;
  return cache;
}

/** Devuelve toda la configuración (con banners como arreglo) */
async function obtener() {
  const c = cache && Date.now() < cacheHasta ? cache : await cargar();
  let banners = [];
  try { banners = JSON.parse(c.banners || '[]'); } catch { banners = []; }
  return {
    ...c,
    banners,
    ventas_activas: c.ventas_activas === '1',
    mantenimiento: c.mantenimiento === '1',
  };
}

/** Guarda varios valores a la vez. Solo acepta claves conocidas. */
async function guardar(cambios) {
  await transaccion(async (t) => {
    for (const [clave, valor] of Object.entries(cambios)) {
      if (!(clave in PREDETERMINADA)) continue;
      let v = valor;
      if (typeof v === 'boolean') v = v ? '1' : '0';
      if (clave === 'banners' && typeof v !== 'string') v = JSON.stringify(v);
      await t.ejecutar(
        'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
        clave, String(v ?? '')
      );
    }
  });
  await cargar();
}

/** Sentencias para guardar los valores por defecto que aún no existan */
const sentenciasIniciales = () =>
  Object.entries(PREDETERMINADA).map(([clave, valor]) => ['INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)', [clave, valor]]);

module.exports = { obtener, guardar, sentenciasIniciales, PREDETERMINADA };
