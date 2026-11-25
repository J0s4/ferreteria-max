// =============================================================
//  seguridad.js — Cabeceras de seguridad, control de origen y
//  límite de intentos de inicio de sesión.
// =============================================================

/** Cabeceras que le dicen al navegador cómo protegerse */
function cabecerasSeguras(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",                 // ningún script en línea: evita XSS
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      'frame-src https://www.openstreetmap.org', // mapas de sucursales
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  next();
}

/**
 * Protección CSRF sencilla: si una petición que modifica datos viene
 * desde otro sitio web, se rechaza. (Además la cookie es SameSite=Lax.)
 */
function verificarOrigen(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origen = req.get('origin');
  if (origen) {
    try {
      if (new URL(origen).host !== req.get('host')) {
        return res.status(403).json({ error: 'Petición rechazada: origen no permitido.' });
      }
    } catch {
      return res.status(403).json({ error: 'Petición rechazada: origen no válido.' });
    }
  }
  next();
}

/**
 * Límite de intentos fallidos (contra ataques de fuerza bruta).
 * Guarda los intentos en memoria: se reinician al reiniciar el servidor.
 */
function crearLimitador({ maxIntentos = 8, ventanaMinutos = 15 } = {}) {
  const intentos = new Map();
  const ventana = ventanaMinutos * 60 * 1000;
  return {
    bloqueado(clave) {
      const r = intentos.get(clave);
      if (!r) return false;
      if (Date.now() - r.inicio > ventana) { intentos.delete(clave); return false; }
      return r.cuenta >= maxIntentos;
    },
    fallo(clave) {
      const r = intentos.get(clave);
      if (!r || Date.now() - r.inicio > ventana) intentos.set(clave, { cuenta: 1, inicio: Date.now() });
      else r.cuenta++;
    },
    exito(clave) { intentos.delete(clave); },
    minutos: ventanaMinutos,
  };
}

module.exports = { cabecerasSeguras, verificarOrigen, crearLimitador };
