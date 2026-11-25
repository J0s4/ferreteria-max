// Catálogo: buscador y filtros por categoría y precio
'use strict';

(async () => {
  await FM.iniciar('catalogo');
  const $ = (id) => document.getElementById(id);
  const url = new URLSearchParams(location.search);

  // Estado de los filtros (se refleja en la dirección para poder compartirla)
  const filtros = {
    q: url.get('q') || '',
    categoria: url.get('categoria') || '',
    min: url.get('min') || '',
    max: url.get('max') || '',
    ofertas: url.get('ofertas') === '1',
    disponibles: url.get('disponibles') === '1',
    orden: url.get('orden') || '',
  };

  const categorias = await FM.api('/api/categorias');

  function pintarCategorias() {
    const total = categorias.reduce((s, c) => s + c.total, 0);
    $('lista-categorias').innerHTML =
      `<li><button type="button" data-categoria="" aria-pressed="${!filtros.categoria}">Todas <small>${total}</small></button></li>` +
      categorias.map((c) => `<li><button type="button" data-categoria="${c.id}" aria-pressed="${String(filtros.categoria) === String(c.id)}">
        <span>${FM.esc(c.icono)} ${FM.esc(c.nombre)}</span><small>${c.total}</small></button></li>`).join('');
  }

  function sincronizarFormulario() {
    $('q').value = filtros.q;
    $('min').value = filtros.min;
    $('max').value = filtros.max;
    $('solo-ofertas').checked = filtros.ofertas;
    $('solo-disponibles').checked = filtros.disponibles;
    $('orden').value = filtros.orden;
  }

  async function buscar() {
    const p = new URLSearchParams();
    if (filtros.q) p.set('q', filtros.q);
    if (filtros.categoria) p.set('categoria', filtros.categoria);
    if (filtros.min) p.set('min', filtros.min);
    if (filtros.max) p.set('max', filtros.max);
    if (filtros.ofertas) p.set('ofertas', '1');
    if (filtros.disponibles) p.set('disponibles', '1');
    if (filtros.orden) p.set('orden', filtros.orden);
    history.replaceState(null, '', p.toString() ? `/catalogo?${p}` : '/catalogo');

    const cat = categorias.find((c) => String(c.id) === String(filtros.categoria));
    $('titulo-catalogo').textContent = cat ? cat.nombre : filtros.ofertas ? 'Ofertas' : 'Catálogo';
    pintarCategorias();

    try {
      const { productos } = await FM.api(`/api/productos?${p}`);
      $('conteo').textContent = productos.length === 1 ? '1 producto encontrado' : `${productos.length} productos encontrados`;
      $('resultados').innerHTML = productos.length
        ? productos.map(FM.tarjetaProducto).join('')
        : `<div class="vacio" style="grid-column:1/-1"><h3>No encontramos productos con esos filtros</h3>
             <p>Pruebe con otra palabra o quite algún filtro. Si no lo encuentra, escríbanos: lo conseguimos.</p>
             <button class="boton boton-oscuro" type="button" data-limpiar>Limpiar filtros</button></div>`;
    } catch (e) {
      $('resultados').innerHTML = `<div class="vacio" style="grid-column:1/-1"><p>${FM.esc(e.message)}</p></div>`;
    }
  }

  function limpiar() {
    Object.assign(filtros, { q: '', categoria: '', min: '', max: '', ofertas: false, disponibles: false, orden: '' });
    sincronizarFormulario();
    buscar();
  }

  // ----- Eventos -----
  $('lista-categorias').addEventListener('click', (e) => {
    const b = e.target.closest('[data-categoria]');
    if (!b) return;
    filtros.categoria = b.dataset.categoria;
    buscar();
    if (window.innerWidth <= 860) $('resultados').scrollIntoView({ behavior: 'smooth' });
  });
  $('form-buscar').addEventListener('submit', (e) => { e.preventDefault(); filtros.q = $('q').value.trim(); buscar(); });
  $('form-precio').addEventListener('submit', (e) => {
    e.preventDefault();
    filtros.min = $('min').value;
    filtros.max = $('max').value;
    filtros.ofertas = $('solo-ofertas').checked;
    filtros.disponibles = $('solo-disponibles').checked;
    if (filtros.min && filtros.max && Number(filtros.min) > Number(filtros.max)) {
      FM.aviso('El precio "desde" no puede ser mayor que el precio "hasta".', 'error');
      return;
    }
    buscar();
  });
  $('orden').addEventListener('change', () => { filtros.orden = $('orden').value; buscar(); });
  $('limpiar').addEventListener('click', limpiar);
  $('resultados').addEventListener('click', (e) => { if (e.target.closest('[data-limpiar]')) limpiar(); });
  $('boton-filtros').addEventListener('click', () => {
    const abierto = $('filtros').classList.toggle('abierto');
    $('boton-filtros').setAttribute('aria-expanded', String(abierto));
  });

  sincronizarFormulario();
  buscar();
})();
