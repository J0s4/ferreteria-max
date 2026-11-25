// Sucursales con mapa (OpenStreetMap, no necesita llave de API)
'use strict';

(async () => {
  await FM.iniciar('sucursales');
  const sucursales = await FM.api('/api/sucursales');
  const e = FM.esc;

  const mapa = (s) => {
    if (s.latitud === null || s.longitud === null) return '<div class="mapa"></div>';
    const d = 0.006;
    const bbox = [s.longitud - d, s.latitud - d * 0.7, s.longitud + d, s.latitud + d * 0.7].join(',');
    return `<div class="mapa"><iframe title="Mapa de ${e(s.nombre)}" loading="lazy"
      src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${s.latitud},${s.longitud}"></iframe></div>`;
  };

  document.getElementById('lista-sucursales').innerHTML = sucursales.length ? sucursales.map((s) => `
    <article class="sucursal">
      <div class="info">
        <h2>${e(s.nombre)}</h2>
        <dl>
          <dt>Dirección</dt><dd>${e(s.direccion)}</dd>
          <dt>Horario</dt><dd>${e(s.horario)}</dd>
          ${s.telefono ? `<dt>Teléfono</dt><dd><a class="enlace" href="tel:${e(s.telefono.replace(/\D/g, ''))}">${e(s.telefono)}</a></dd>` : ''}
          ${s.correo ? `<dt>Correo</dt><dd><a class="enlace" href="mailto:${e(s.correo)}">${e(s.correo)}</a></dd>` : ''}
        </dl>
        ${s.latitud !== null ? `<div class="botones-fila">
          <a class="boton boton-chico" href="https://waze.com/ul?ll=${s.latitud},${s.longitud}&amp;navigate=yes" target="_blank" rel="noopener">Ir con Waze</a>
          <a class="boton boton-borde boton-chico" href="https://www.google.com/maps/search/?api=1&amp;query=${s.latitud},${s.longitud}" target="_blank" rel="noopener">Abrir en Google Maps</a>
        </div>` : ''}
      </div>
      ${mapa(s)}
    </article>`).join('') : '<div class="vacio"><p>Pronto publicaremos nuestras sucursales.</p></div>';
})();
