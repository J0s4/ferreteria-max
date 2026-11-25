// =============================================================
//  validar.js — Revisa los datos que llegan del navegador.
//  Nunca confíe en lo que manda el cliente: todo se valida aquí.
// =============================================================

/** Error con código HTTP y mensaje para mostrar al usuario */
class ErrorUsuario extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

/** Texto limpio. Lanza error si es obligatorio y viene vacío o si es muy largo. */
function texto(valor, nombreCampo, { requerido = false, max = 200, min = 0 } = {}) {
  const limpio = valor === undefined || valor === null ? '' : String(valor).trim();
  if (requerido && !limpio) throw new ErrorUsuario(`El campo "${nombreCampo}" es obligatorio.`);
  if (limpio.length > max) throw new ErrorUsuario(`El campo "${nombreCampo}" admite máximo ${max} caracteres.`);
  if (limpio && limpio.length < min) throw new ErrorUsuario(`El campo "${nombreCampo}" debe tener al menos ${min} caracteres.`);
  return limpio;
}

/** Número entero dentro de un rango */
function entero(valor, nombreCampo, { min = 0, max = 1e12, requerido = true } = {}) {
  if ((valor === undefined || valor === null || valor === '') && !requerido) return null;
  const n = Number(valor);
  if (!Number.isInteger(n)) throw new ErrorUsuario(`"${nombreCampo}" debe ser un número entero.`);
  if (n < min || n > max) throw new ErrorUsuario(`"${nombreCampo}" debe estar entre ${min} y ${max}.`);
  return n;
}

function correo(valor) {
  const c = texto(valor, 'Correo', { requerido: true, max: 120 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)) throw new ErrorUsuario('El correo no tiene un formato válido.');
  return c;
}

function contrasena(valor) {
  const c = valor === undefined || valor === null ? '' : String(valor);
  if (c.length < 8) throw new ErrorUsuario('La contraseña debe tener al menos 8 caracteres.');
  if (c.length > 72) throw new ErrorUsuario('La contraseña admite máximo 72 caracteres.');
  if (!/[A-Za-z]/.test(c) || !/[0-9]/.test(c)) throw new ErrorUsuario('La contraseña debe tener letras y números.');
  return c;
}

/** Teléfono de Costa Rica: 8 dígitos (acepta guion o espacios) */
function telefono(valor, { requerido = false } = {}) {
  const t = texto(valor, 'Teléfono', { requerido, max: 20 });
  if (!t) return '';
  const digitos = t.replace(/[\s-]/g, '').replace(/^\+?506/, '');
  if (!/^\d{8}$/.test(digitos)) throw new ErrorUsuario('El teléfono debe tener 8 dígitos (ej.: 8888-1234).');
  return digitos.slice(0, 4) + '-' + digitos.slice(4);
}

function booleano(valor) {
  return valor === true || valor === 1 || valor === '1' || valor === 'true' || valor === 'on' || valor === 'si';
}

function colorHex(valor, nombreCampo) {
  const c = texto(valor, nombreCampo, { requerido: true, max: 7 });
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new ErrorUsuario(`"${nombreCampo}" debe ser un color como #F28C00.`);
  return c.toUpperCase();
}

module.exports = { ErrorUsuario, texto, entero, correo, contrasena, telefono, booleano, colorHex };
