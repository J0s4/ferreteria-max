// Detalle de un producto
'use strict';

(async () => {
  const { config } = await FM.iniciar('catalogo');
  const contenedor = document.getElementById('detalle');
  const id = Number(FM.parametro('id'));

  let datos;
  try {
    datos = await FM.api(`/api/productos/${id}`);
  } catch (e) {
    contenedor.innerHTML = `<div class="vacio" style="margin:3rem 0"><h2>Producto no encontrado</h2>
      <p>${FM.esc(e.message)}</p><a class="boton" href="/catalogo">Volver al catálogo</a></div>`;
    return;
  }

  const { producto: p, relacionados } = datos;
  document.title = `${p.nombre} | ${config.nombre_tienda}`;
  const agotado = p.disponibilidad === 'agotado';
  const tieneOferta = p.precio_oferta !== null;
  const textoDisponibilidad = {
    disponible: 'Hay suficientes unidades en tienda.',
    pocas: 'Quedan pocas unidades: si lo necesita, pídalo pronto.',
    agotado: 'Por ahora está agotado. Consúltenos por teléfono si necesita saber cuándo llega.',
  }[p.disponibilidad];

  let zonaCompra;
  if (!config.ventas_activas) {
    zonaCompra = `<p class="mensaje-formulario error">${FM.esc(config.mensaje_ventas)}</p>`;
  } else if (agotado) {
    zonaCompra = '<button class="boton" type="button" disabled>Agotado</button>';
  } else {
    zonaCompra = `
      <div class="cantidad" role="group" aria-label="Cantidad">
        <button type="button" data-paso="-1" aria-label="Quitar una unidad">−</button>
        <input type="number" id="cantidad" value="1" min="1" max="999" inputmode="numeric" aria-label="Cantidad">
        <button type="button" data-paso="1" aria-label="Agregar una unidad">+</button>
      </div>
      <button class="boton" type="button" data-agregar="${p.id}" data-nombre="${FM.esc(p.nombre)}" data-cantidad-de="#cantidad">Agregar al carrito</button>`;
  }

  contenedor.innerHTML = `
    <div class="detalle">
      <div class="detalle-foto"><img src="${FM.esc(p.imagen || '/img/sin-imagen.svg')}" alt="${FM.esc(p.nombre)}"></div>
      <div class="detalle-info">
        <nav class="migas texto-suave" aria-label="Ruta"><a href="/catalogo">Catálogo</a> / <a href="/catalogo?categoria=${p.categoria_id}">${FM.esc(p.categoria)}</a></nav>
        <h1>${FM.esc(p.nombre)}</h1>
        <div class="fila-precio" style="display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap;margin-bottom:.8rem">
          <span class="precio">${FM.colones(p.precio_final)}</span>
          ${tieneOferta ? `<span class="precio-anterior"><span class="solo-lector">Antes </span>${FM.colones(p.precio)}</span>` : ''}
        </div>
        ${FM.etiquetaDisp(p.disponibilidad)}
        <p class="texto-suave" style="margin-top:.5rem">${textoDisponibilidad}</p>
        <p class="descripcion">${FM.esc(p.descripcion)}</p>
        <div class="comprar">${zonaCompra}</div>
        <div class="datos-tienda">
          Pago por SINPE Móvil y retiro en sucursal. ¿Dudas con este producto? Llámenos al
          <a class="enlace" href="tel:${FM.esc(config.telefono.replace(/\D/g, ''))}">${FM.esc(config.telefono)}</a>.
        </div>
      </div>
    </div>`;

  // Botones + y − de la cantidad
  contenedor.addEventListener('click', (e) => {
    const b = e.target.closest('[data-paso]');
    if (!b) return;
    const input = document.getElementById('cantidad');
    input.value = Math.min(999, Math.max(1, (Number(input.value) || 1) + Number(b.dataset.paso)));
  });

  if (relacionados.length) {
    document.getElementById('relacionados').innerHTML = relacionados.map(FM.tarjetaProducto).join('');
    document.getElementById('bloque-relacionados').classList.remove('oculto');
  }
})();
