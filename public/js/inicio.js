// Página de inicio: banners, categorías, ofertas y destacados
'use strict';

(async () => {
  const { config } = await FM.iniciar('inicio');
  const [categorias, ofertas, destacados] = await Promise.all([
    FM.api('/api/categorias'),
    FM.api('/api/productos?ofertas=1&limite=8'),
    FM.api('/api/productos?destacados=1&limite=8'),
  ]);

  // ----- Banners (los edita el súper admin) -----
  const banners = config.banners.length ? config.banners : [{
    titulo: 'Todo para construir, reparar y pintar', texto: config.eslogan, enlace: '/catalogo', texto_boton: 'Ver el catálogo',
  }];
  const iconosTablero = categorias.slice(0, 6).map((c) => c.icono);
  let actual = 0;
  let temporizador = null;

  function mostrarBanner(i) {
    actual = (i + banners.length) % banners.length;
    const b = banners[actual];
    document.getElementById('banner-titulo').textContent = b.titulo;
    document.getElementById('banner-texto').textContent = b.texto || '';
    const boton = document.getElementById('banner-boton');
    boton.textContent = b.texto_boton || 'Ver más';
    boton.href = b.enlace || '/catalogo';
    boton.classList.toggle('oculto', !b.enlace);
    document.getElementById('banner-imagen').innerHTML = b.imagen
      ? `<img src="${FM.esc(b.imagen)}" alt="">`
      : `<div class="tablero">${iconosTablero.map((ic) => `<span>${FM.esc(ic)}</span>`).join('')}</div>`;
    document.querySelectorAll('#banner-controles button').forEach((bt, j) => bt.setAttribute('aria-current', String(j === actual)));
  }

  const controles = document.getElementById('banner-controles');
  if (banners.length > 1) {
    controles.innerHTML = banners.map((b, i) => `<button type="button" aria-label="Ver banner ${i + 1}: ${FM.esc(b.titulo)}" data-banner="${i}"></button>`).join('');
    controles.addEventListener('click', (e) => {
      const bt = e.target.closest('[data-banner]');
      if (!bt) return;
      mostrarBanner(Number(bt.dataset.banner));
      reiniciar();
    });
  }
  const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function reiniciar() {
    clearInterval(temporizador);
    if (banners.length > 1 && !reducirMovimiento) temporizador = setInterval(() => mostrarBanner(actual + 1), 8000);
  }
  const portada = document.querySelector('.portada');
  portada.addEventListener('mouseenter', () => clearInterval(temporizador));
  portada.addEventListener('mouseleave', reiniciar);
  portada.addEventListener('focusin', () => clearInterval(temporizador));
  mostrarBanner(0);
  reiniciar();

  // ----- Categorías -----
  document.getElementById('categorias').innerHTML = categorias.map((c) => `
    <a class="gaveta" href="/catalogo?categoria=${c.id}">
      <span class="icono" aria-hidden="true">${FM.esc(c.icono)}</span>
      <strong>${FM.esc(c.nombre)}</strong>
      <small>${c.total} ${c.total === 1 ? 'producto' : 'productos'}</small>
    </a>`).join('');

  // ----- Ofertas y destacados -----
  if (ofertas.productos.length) document.getElementById('ofertas').innerHTML = ofertas.productos.map(FM.tarjetaProducto).join('');
  else document.getElementById('bloque-ofertas').classList.add('oculto');
  document.getElementById('destacados').innerHTML = destacados.productos.map(FM.tarjetaProducto).join('');
})();
