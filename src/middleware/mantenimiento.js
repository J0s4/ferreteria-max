// =============================================================
//  mantenimiento.js — Si el súper admin activa el modo
//  mantenimiento, los visitantes ven un aviso; el personal
//  (admin y súper admin) sigue entrando con normalidad.
//  En Vercel las páginas HTML las entrega directamente su red, sin
//  pasar por aquí; por eso el navegador también revisa el modo
//  mantenimiento al cargar (ver public/js/comun.js).
// =============================================================
const configuracion = require('../servicios/configuracion');
const config = require('../config');
const { esPersonal } = require('./auth');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Rutas que siguen funcionando durante el mantenimiento
const PERMITIDAS = ['/admin', '/api/auth', '/api/admin', '/api/configuracion', '/login', '/css/', '/js/', '/img/', '/fonts/', '/archivos/', '/tema.css', '/favicon'];

function paginaMantenimiento(c) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.nombre_tienda)} · En mantenimiento</title>
<link rel="icon" href="/img/favicon.svg"><link rel="stylesheet" href="/tema.css"><link rel="stylesheet" href="/css/estilos.css"></head>
<body class="pagina-aviso"><main class="aviso-completo">
  <div class="franja-precaucion" aria-hidden="true"></div>
  <img src="${esc(c.logo || '/img/logo.svg')}" alt="" class="aviso-logo">
  <h1>${esc(c.nombre_tienda)} está en mantenimiento</h1>
  <p>${esc(c.mensaje_mantenimiento)}</p>
  <p class="aviso-contacto">¿Necesita algo urgente? Llámenos al ${esc(c.telefono)}.</p>
</main></body></html>`;
}

async function modoMantenimiento(req, res, next) {
  // Archivos de diseño (CSS, JS, imágenes) nunca se bloquean: no se consulta la base
  if (/\.(css|js|svg|png|jpg|webp|gif|woff2|ico)$/.test(req.path) && !req.path.startsWith('/api/')) return next();
  const c = await configuracion.obtener();
  if (!c.mantenimiento || esPersonal(req.usuario)) return next();
  const ruta = req.path;
  if (PERMITIDAS.some((p) => ruta === p || ruta.startsWith(p.endsWith('/') ? p : p + '/') || ruta.startsWith(p + '.'))) return next();
  if (ruta.startsWith(config.rutaSecreta)) return next();
  if (ruta.startsWith('/api/')) {
    return res.status(503).json({ error: c.mensaje_mantenimiento, mantenimiento: true });
  }
  res.status(503).type('html').send(paginaMantenimiento(c));
}

module.exports = { modoMantenimiento };
