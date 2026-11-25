// Mi cuenta: pedidos, perfil y contraseña
'use strict';

(async () => {
  const { usuario } = await FM.iniciar('');
  if (!usuario) { location.href = '/login?volver=/cuenta'; return; }
  const e = FM.esc;
  const $ = (id) => document.getElementById(id);

  function pintarCabecera(u) {
    $('saludo').textContent = `Hola, ${u.nombre.split(' ')[0]}`;
    $('correo-usuario').textContent = u.correo;
  }
  pintarCabecera(usuario);

  // ----- Pestañas -----
  const pestanas = ['pedidos', 'perfil', 'clave'];
  function mostrar(nombre) {
    for (const p of pestanas) {
      $(`tab-${p}`).setAttribute('aria-selected', String(p === nombre));
      $(`panel-${p}`).classList.toggle('oculto', p !== nombre);
    }
    history.replaceState(null, '', `#${nombre}`);
  }
  pestanas.forEach((p) => $(`tab-${p}`).addEventListener('click', () => mostrar(p)));

  const esCliente = usuario.rol === 'cliente';
  if (!esCliente) { $('tab-pedidos').classList.add('oculto'); mostrar('perfil'); }
  else mostrar(pestanas.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'pedidos');

  // ----- Pedidos -----
  if (esCliente) {
    const pedidos = await FM.api('/api/pedidos');
    $('lista-pedidos').innerHTML = pedidos.length ? pedidos.map((p) => `
      <a class="pedido-fila" href="/pedido?id=${p.id}">
        <div><strong>${e(p.codigo)}</strong><br><span class="texto-suave">${e(FM.fecha(p.creado_en))}. ${p.unidades} ${p.unidades === 1 ? 'unidad' : 'unidades'}, retiro en ${e(p.sucursal_retiro_nombre)}</span>
          ${p.estado_pago === 'por_hacer' && !p.comprobante_numero ? '<br><span class="texto-suave" style="color:var(--error);font-weight:600">Falta enviar el comprobante SINPE</span>' : ''}</div>
        ${FM.etiquetaEstado(p.estado_pago)}
        <span class="precio" style="font-size:1.4rem">${FM.colones(p.total)}</span>
      </a>`).join('')
      : '<div class="vacio"><h3>Todavía no tiene pedidos</h3><p>Cuando haga uno, aquí verá si el pago está por hacer, hecho o no hecho.</p><a class="boton" href="/catalogo">Ir al catálogo</a></div>';
  }

  // ----- Perfil -----
  const formPerfil = $('form-perfil');
  formPerfil.nombre.value = usuario.nombre;
  formPerfil.correo.value = usuario.correo;
  formPerfil.telefono.value = usuario.telefono || '';
  formPerfil.direccion.value = usuario.direccion || '';
  formPerfil.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const boton = formPerfil.querySelector('button');
    boton.disabled = true;
    try {
      const r = await FM.api('/api/auth/perfil', { metodo: 'PUT', datos: Object.fromEntries(new FormData(formPerfil)) });
      FM.mensajeEn($('mensaje-perfil'), r.mensaje, 'ok');
      pintarCabecera(r.usuario);
    } catch (err) {
      FM.mensajeEn($('mensaje-perfil'), err.message);
    } finally { boton.disabled = false; }
  });

  // ----- Contraseña -----
  const formClave = $('form-clave');
  formClave.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(formClave));
    if (d.nueva !== d.repetir) { FM.mensajeEn($('mensaje-clave'), 'Las contraseñas nuevas no coinciden.'); return; }
    try {
      const r = await FM.api('/api/auth/contrasena', { metodo: 'PUT', datos: { actual: d.actual, nueva: d.nueva } });
      FM.mensajeEn($('mensaje-clave'), r.mensaje, 'ok');
      formClave.reset();
    } catch (err) {
      FM.mensajeEn($('mensaje-clave'), err.message);
    }
  });

  $('cerrar-sesion').addEventListener('click', FM.cerrarSesion);
})();
