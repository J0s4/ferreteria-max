// =============================================================
//  fechas.js — Manejo de fechas en hora de Costa Rica (UTC-6).
//  En la base de datos todo se guarda en UTC con datetime('now').
// =============================================================

// Costa Rica no usa horario de verano: siempre UTC-6.
const HORAS_CR = -6;
// Modificador que SQLite entiende para pasar de UTC a hora local.
const SQL_HORA_CR = "'-6 hours'";

/** Fecha de hoy en Costa Rica, formato AAAA-MM-DD */
function hoyCR() {
  return new Date(Date.now() + HORAS_CR * 3600 * 1000).toISOString().slice(0, 10);
}

function sumarDias(fechaTexto, dias) {
  const d = new Date(fechaTexto + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function esFechaValida(texto) {
  return typeof texto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(texto));
}

/**
 * Devuelve el rango { desde, hasta } (hasta NO incluido) para un período.
 * periodo: 'dia' | 'semana' (lunes a domingo) | 'mes'
 */
function rangoPeriodo(periodo, fechaRef) {
  const ref = esFechaValida(fechaRef) ? fechaRef : hoyCR();
  if (periodo === 'semana') {
    const diaSemana = new Date(ref + 'T00:00:00Z').getUTCDay(); // 0 = domingo
    const desde = sumarDias(ref, -((diaSemana + 6) % 7));        // lunes
    return { desde, hasta: sumarDias(desde, 7) };
  }
  if (periodo === 'mes') {
    const desde = ref.slice(0, 8) + '01';
    const d = new Date(desde + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 1);
    return { desde, hasta: d.toISOString().slice(0, 10) };
  }
  return { desde: ref, hasta: sumarDias(ref, 1) };
}

/** Fecha y hora actual como texto UTC (igual que datetime('now') de SQLite) */
function ahoraUTC() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

module.exports = { HORAS_CR, SQL_HORA_CR, hoyCR, sumarDias, esFechaValida, rangoPeriodo, ahoraUTC };
