// =============================================================
//  tema.js — Genera /tema.css con los colores que el súper admin
//  elige. Así cambiar los colores no requiere tocar el código.
// =============================================================
const configuracion = require('./configuracion');

function hexARgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbAHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Mezcla un color con negro (cantidad > 0) o blanco (cantidad < 0) */
function sombrear(hex, cantidad) {
  const rgb = hexARgb(hex);
  return rgbAHex(rgb.map((v) => (cantidad > 0 ? v * (1 - cantidad) : v + (255 - v) * -cantidad)));
}

function luminancia(hex) {
  const [r, g, b] = hexARgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Elige texto oscuro o blanco según qué se lee mejor sobre el color */
const textoSobre = (hex) => (luminancia(hex) > 0.22 ? '#1C1F22' : '#FFFFFF');

async function css() {
  const c = await configuracion.obtener();
  const seguro = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(v || '') ? v : d);
  const primario = seguro(c.color_primario, '#F28C00');
  const secundario = seguro(c.color_secundario, '#2A2E33');
  return `/* Generado automáticamente desde la configuración del sitio */
:root {
  --primario: ${primario};
  --primario-hover: ${sombrear(primario, 0.12)};
  --primario-suave: ${sombrear(primario, -0.85)};
  --texto-primario: ${textoSobre(primario)};
  --secundario: ${secundario};
  --secundario-claro: ${sombrear(secundario, -0.12)};
  --texto-secundario: ${textoSobre(secundario)};
}
`;
}

module.exports = { css };
