// Carrito y confirmación del pedido
'use strict';

(async () => {
  const { config, usuario } = await FM.iniciar('');
  const e = FM.esc;
  const zona = document.getElementById('contenido-carrito');
  const sucursales = await FM.api('/api/sucursales');
  let productos = new Map();

  async function cargarProductos() {
    const items = FM.carrito.obtener();
    if (!items.length) return;
    const { productos: lista } = await FM.api(`/api/productos?ids=${items.map((i) => i.id).join(',')}`);
    productos = new Map(lista.map((p) => [p.id, p]));
    // Quitar del carrito lo que ya no existe en el catálogo
    const faltantes = items.filter((i) => !productos.has(i.id));
    if (faltantes.length) {
      FM.carrito.guardar(items.filter((i) => productos.has(i.id)));
      FM.aviso('Quitamos del carrito productos que ya no están a la venta.', 'info');
    }
  }

  function pintar() {
    // Conservar lo que el cliente ya eligió si se vuelve a dibujar la página
    const sucursalPrevia = document.getElementById('sucursal')?.value || '';
    const notasPrevias = document.getElementById('notas')?.value || '';
    const items = FM.carrito.obtener().filter((i) => productos.has(i.id));
    if (!items.length) {
      zona.innerHTML = `<div class="vacio" style="margin:2.5rem 0 3rem"><h2>Su carrito está vacío</h2>
        <p>Busque lo que necesita en el catálogo y agréguelo aquí.</p><a class="boton" href="/catalogo">Ir al catálogo</a></div>`;
      return;
    }
    const total = items.reduce((s, i) => s + productos.get(i.id).precio_final * i.cantidad, 0);
    const unidades = items.reduce((s, i) => s + i.cantidad, 0);
    const hayAgotados = items.some((i) => productos.get(i.id).disponibilidad === 'agotado');
    const esPersonal = usuario && usuario.rol !== 'cliente';

    let accion;
    if (!config.ventas_activas) accion = `<p class="mensaje-formulario error">${e(config.mensaje_ventas)}</p>`;
    else if (!usuario) accion = `<a class="boton boton-ancho" href="/login?volver=/carrito">Ingresar para hacer el pedido</a>
      <p class="texto-suave" style="margin-top:.6rem">¿No tiene cuenta? <a class="enlace" href="/registro?volver=/carrito">Regístrese aquí</a>.</p>`;
    else if (esPersonal) accion = '<p class="mensaje-formulario error">Las cuentas de administración no pueden hacer pedidos. Use una cuenta de cliente.</p>';
    else accion = `<button class="boton boton-ancho" type="submit" ${hayAgotados ? 'disabled' : ''}>Confirmar pedido</button>
      ${hayAgotados ? '<p class="mensaje-formulario error" style="margin-top:.75rem">Quite los productos agotados para continuar.</p>' : ''}`;

    zona.innerHTML = `
      <div class="dos-columnas">
        <section class="panel" aria-label="Productos en el carrito">
          ${items.map((i) => {
            const p = productos.get(i.id);
            return `
            <div class="linea-carrito">
              <img src="${e(p.imagen || '/img/sin-imagen.svg')}" alt="">
              <div>
                <h3><a href="/producto?id=${p.id}">${e(p.nombre)}</a></h3>
                <span class="texto-suave">${FM.colones(p.precio_final)} c/u</span>
                <div class="controles">
                  <div class="cantidad" role="group" aria-label="Cantidad de ${e(p.nombre)}">
                    <button type="button" data-cambiar="${p.id}" data-paso="-1" aria-label="Quitar una">−</button>
                    <input type="number" min="1" max="999" value="${i.cantidad}" data-cantidad="${p.id}" aria-label="Cantidad" inputmode="numeric">
                    <button type="button" data-cambiar="${p.id}" data-paso="1" aria-label="Agregar una">+</button>
                  </div>
                  ${FM.etiquetaDisp(p.disponibilidad)}
                  <button class="boton-quitar" type="button" data-quitar="${p.id}">Quitar</button>
                </div>
              </div>
              <div class="subtotal"><span class="precio" style="font-size:1.35rem">${FM.colones(p.precio_final * i.cantidad)}</span></div>
            </div>`;
          }).join('')}
          <p style="margin:1rem 0 0"><a class="enlace" href="/catalogo">Seguir comprando</a></p>
        </section>

        <form class="panel resumen" id="form-pedido" novalidate>
          <h2>Resumen</h2>
          <div class="fila"><span>Productos</span><span>${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}</span></div>
          <div class="fila"><span>Pago</span><span>SINPE Móvil</span></div>
          <div class="fila total"><strong>Total</strong><span class="precio">${FM.colones(total)}</span></div>
          <div class="campo" style="margin-top:1.25rem">
            <label for="sucursal">Sucursal de retiro</label>
            <select id="sucursal" required>
              <option value="">Elija una sucursal</option>
              ${sucursales.map((s) => `<option value="${s.id}">${e(s.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label for="notas">Notas para la tienda (opcional)</label>
            <textarea id="notas" maxlength="500" style="min-height:80px" placeholder="Ej.: retiro el sábado en la mañana"></textarea>
          </div>
          <div id="mensaje-pedido" class="oculto" role="alert"></div>
          ${accion}
        </form>
      </div>`;
    document.getElementById('sucursal').value = sucursalPrevia;
    document.getElementById('notas').value = notasPrevias;
  }

  // ----- Eventos (delegados en la zona) -----
  zona.addEventListener('click', (ev) => {
    const cambiar = ev.target.closest('[data-cambiar]');
    if (cambiar) {
      const id = Number(cambiar.dataset.cambiar);
      const item = FM.carrito.obtener().find((i) => i.id === id);
      const nueva = Math.max(1, (item?.cantidad || 1) + Number(cambiar.dataset.paso));
      FM.carrito.cambiar(id, nueva);
      pintar();
      return;
    }
    const quitar = ev.target.closest('[data-quitar]');
    if (quitar) {
      FM.carrito.quitar(Number(quitar.dataset.quitar));
      FM.aviso('Producto quitado del carrito.', 'info');
      pintar();
    }
  });
  zona.addEventListener('change', (ev) => {
    const input = ev.target.closest('[data-cantidad]');
    if (!input) return;
    FM.carrito.cambiar(Number(input.dataset.cantidad), Math.max(1, Math.min(999, Number(input.value) || 1)));
    pintar();
  });
  zona.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const caja = document.getElementById('mensaje-pedido');
    const sucursal = document.getElementById('sucursal').value;
    if (!sucursal) { FM.mensajeEn(caja, 'Elija la sucursal donde va a retirar el pedido.'); return; }
    const boton = ev.target.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'Creando pedido…';
    try {
      const r = await FM.api('/api/pedidos', {
        metodo: 'POST',
        datos: {
          items: FM.carrito.obtener().map((i) => ({ producto_id: i.id, cantidad: i.cantidad })),
          sucursal_retiro_id: Number(sucursal),
          notas: document.getElementById('notas').value,
        },
      });
      FM.carrito.vaciar();
      location.href = `/pedido?id=${r.pedido.id}&nuevo=1`;
    } catch (err) {
      FM.mensajeEn(caja, err.message);
      boton.disabled = false;
      boton.textContent = 'Confirmar pedido';
      if (err.estado === 409) { await cargarProductos(); }
    }
  });

  try {
    await cargarProductos();
  } catch (err) {
    zona.innerHTML = `<div class="vacio" style="margin:2rem 0"><p>${e(err.message)}</p></div>`;
    return;
  }
  pintar();
})();
