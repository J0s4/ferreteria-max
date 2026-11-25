// Detalle del pedido: instrucciones de SINPE Móvil y envío del comprobante
'use strict';

(async () => {
  const { usuario } = await FM.iniciar('');
  const e = FM.esc;
  const zona = document.getElementById('zona-pedido');
  const id = Number(FM.parametro('id'));
  if (!usuario) { location.href = `/login?volver=${encodeURIComponent(location.pathname + location.search)}`; return; }

  async function cargar(mensajeInicial) {
    let p;
    try {
      p = await FM.api(`/api/pedidos/${id}`);
    } catch (err) {
      zona.innerHTML = `<div class="vacio" style="margin:3rem 0"><h2>No encontramos ese pedido</h2><p>${e(err.message)}</p>
        <a class="boton" href="/cuenta">Ver mis pedidos</a></div>`;
      return;
    }
    document.title = `Pedido ${p.codigo} | Ferretería Max`;
    const pendiente = p.estado_pago !== 'hecho';
    const esDueno = usuario.rol === 'cliente';
    const copiar = (texto, etiqueta) => `<button class="boton-copiar" type="button" data-copiar="${e(texto)}" aria-label="Copiar ${etiqueta}">Copiar</button>`;

    let bloqueEstado = '';
    if (p.estado_pago === 'hecho') {
      bloqueEstado = `<div class="mensaje-formulario ok"><strong>Pago confirmado</strong> (${e(FM.fecha(p.confirmado_en))}).
        Su pedido se prepara para retiro en <strong>${e(p.sucursal_retiro)}</strong>. Lleve su cédula y el código ${e(p.codigo)}.</div>`;
    } else if (p.estado_pago === 'no_hecho') {
      bloqueEstado = `<div class="mensaje-formulario error"><strong>No pudimos confirmar el pago.</strong>
        ${p.nota_admin ? e(p.nota_admin) : 'No recibimos la transferencia.'} Revise los datos y envíe el comprobante de nuevo.</div>`;
    } else if (p.comprobante_numero) {
      bloqueEstado = `<div class="mensaje-formulario ok">Recibimos su comprobante <strong>${e(p.comprobante_numero)}</strong>
        (${e(FM.fecha(p.comprobante_enviado_en))}). Estamos verificando el pago; el estado cambia aquí cuando lo confirmemos.</div>`;
    }

    const cajaSinpe = pendiente ? `
      <section class="caja-sinpe" aria-labelledby="titulo-sinpe">
        <h2 id="titulo-sinpe">Pague por SINPE Móvil</h2>
        <dl>
          <dt>Número SINPE</dt><dd class="grande">${e(p.sinpe_numero)} ${copiar(p.sinpe_numero.replace(/\D/g, ''), 'número SINPE')}</dd>
          <dt>A nombre de</dt><dd style="font-size:1.3rem">${e(p.sinpe_titular)}</dd>
          <dt>Monto exacto</dt><dd>${FM.colones(p.total)} ${copiar(String(p.total), 'monto')}</dd>
          <dt>Detalle</dt><dd>${e(p.codigo)} ${copiar(p.codigo, 'código del pedido')}</dd>
        </dl>
        <ol>
          <li>Abra la aplicación de su banco y elija SINPE Móvil.</li>
          <li>Envíe el monto exacto al número indicado y escriba <strong>${e(p.codigo)}</strong> en el detalle.</li>
          <li>Copie el número de comprobante que le da el banco y péguelo abajo.</li>
        </ol>
      </section>` : '';

    const formComprobante = pendiente && esDueno ? `
      <form class="panel" id="form-comprobante" novalidate style="margin-bottom:1.25rem">
        <h2>${p.comprobante_numero ? 'Actualizar comprobante' : 'Enviar comprobante'}</h2>
        <div id="mensaje-comprobante" class="oculto" role="alert"></div>
        <div class="campo">
          <label for="numero">Número de comprobante</label>
          <input type="text" id="numero" name="numero" required maxlength="40" inputmode="numeric" autocomplete="off"
                 value="${e(p.comprobante_numero)}" placeholder="Ej.: 2026112400012345678">
        </div>
        <div class="campo">
          <label for="foto">Foto o captura del comprobante (opcional)</label>
          <input type="file" id="foto" name="foto" accept="image/jpeg,image/png,image/webp">
          <span class="ayuda">JPG, PNG o WEBP de máximo 5 MB.</span>
          ${p.comprobante_imagen ? `<a class="enlace" href="${e(p.comprobante_imagen)}" target="_blank" rel="noopener">Ver la foto que envió</a>` : ''}
        </div>
        <button class="boton" type="submit">${p.comprobante_numero ? 'Actualizar comprobante' : 'Enviar comprobante'}</button>
      </form>` : '';

    zona.innerHTML = `
      <div style="padding:2rem 0 3rem">
        <nav class="migas texto-suave"><a href="/cuenta">Mi cuenta</a> / Pedidos</nav>
        <div class="cabecera-seccion">
          <div><h1 style="margin:0">Pedido ${e(p.codigo)}</h1><p>Hecho el ${e(FM.fecha(p.creado_en))}, retiro en ${e(p.sucursal_retiro)}</p></div>
          <div>Estado del pago: ${FM.etiquetaEstado(p.estado_pago)}</div>
        </div>
        ${mensajeInicial ? `<div class="mensaje-formulario ok"><strong>¡Pedido creado!</strong> Haga el SINPE Móvil y envíenos el comprobante para confirmarlo.</div>` : ''}
        ${bloqueEstado}
        <div class="${pendiente ? 'dos-columnas' : ''}" style="padding:0">
          ${pendiente ? `<div>${cajaSinpe}${formComprobante}</div>` : ''}
          <section class="panel" aria-label="Productos del pedido">
            <h2>Productos</h2>
            <div class="envoltura-tabla"><table class="tabla-simple">
              <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Subtotal</th></tr></thead>
              <tbody>${p.items.map((it) => `<tr><td>${e(it.producto_nombre)}<br><small class="texto-suave">${FM.colones(it.precio_unitario)} c/u</small></td>
                <td class="num">${it.cantidad}</td><td class="num">${FM.colones(it.subtotal)}</td></tr>`).join('')}</tbody>
              <tfoot><tr><td colspan="2">Total</td><td class="num">${FM.colones(p.total)}</td></tr></tfoot>
            </table></div>
            ${p.notas ? `<p style="margin-top:1rem"><strong>Sus notas:</strong> ${e(p.notas)}</p>` : ''}
          </section>
        </div>
      </div>`;
  }

  zona.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-copiar]');
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.dataset.copiar);
      b.textContent = 'Copiado';
      setTimeout(() => { b.textContent = 'Copiar'; }, 1800);
    } catch {
      FM.aviso('No se pudo copiar. Selecciónelo y cópielo a mano.', 'error');
    }
  });

  zona.addEventListener('submit', async (ev) => {
    if (ev.target.id !== 'form-comprobante') return;
    ev.preventDefault();
    const form = ev.target;
    const caja = document.getElementById('mensaje-comprobante');
    const numero = form.numero.value.trim();
    if (numero.length < 4) { FM.mensajeEn(caja, 'Escriba el número de comprobante que le dio el banco.'); return; }
    const foto = form.foto.files[0];
    if (foto && foto.size > 5 * 1024 * 1024) { FM.mensajeEn(caja, 'La foto pesa más de 5 MB. Use una captura más liviana.'); return; }
    const datos = new FormData();
    datos.append('numero', numero);
    if (foto) datos.append('foto', foto);
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      const r = await FM.api(`/api/pedidos/${id}/comprobante`, { metodo: 'POST', formulario: datos });
      FM.aviso(r.mensaje);
      await cargar(false);
    } catch (err) {
      FM.mensajeEn(caja, err.message);
      boton.disabled = false;
    }
  });

  await cargar(FM.parametro('nuevo') === '1');
  // Quitar "nuevo=1" de la dirección para que el aviso no se repita al recargar
  if (FM.parametro('nuevo')) history.replaceState(null, '', `/pedido?id=${id}`);
})();
