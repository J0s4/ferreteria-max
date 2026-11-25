// Formulario de contacto
'use strict';

(async () => {
  const { config, usuario } = await FM.iniciar('contacto');
  const e = FM.esc;
  const sucursales = await FM.api('/api/sucursales');
  const whatsapp = (config.whatsapp || '').replace(/\D/g, '');

  document.getElementById('datos-contacto').innerHTML = `
    <h2>Llámenos o visítenos</h2>
    <dl>
      <dt>Teléfono</dt><dd><a class="enlace" href="tel:${e(config.telefono.replace(/\D/g, ''))}">${e(config.telefono)}</a></dd>
      ${whatsapp ? `<dt>WhatsApp</dt><dd><a class="enlace" href="https://wa.me/506${e(whatsapp)}" target="_blank" rel="noopener">${e(config.whatsapp)}</a></dd>` : ''}
      <dt>Correo</dt><dd><a class="enlace" href="mailto:${e(config.correo)}">${e(config.correo)}</a></dd>
      <dt>Horario</dt><dd>${e(config.horario_general)}</dd>
      <dt>Sucursales</dt><dd>${sucursales.map((s) => `${e(s.nombre)}: ${e(s.telefono)}`).join('\n')}</dd>
    </dl>
    <p style="margin-top:1.25rem"><a class="enlace" href="/sucursales">Ver direcciones y mapas</a></p>`;

  const form = document.getElementById('form-contacto');
  if (usuario) {
    form.nombre.value = usuario.nombre;
    form.correo.value = usuario.correo;
    form.telefono.value = usuario.telefono || '';
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const caja = document.getElementById('mensaje');
    const datos = Object.fromEntries(new FormData(form));
    if (!datos.nombre.trim() || !datos.correo.trim() || datos.mensaje.trim().length < 10) {
      FM.mensajeEn(caja, 'Escriba su nombre, su correo y un mensaje de al menos 10 caracteres.');
      return;
    }
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      const r = await FM.api('/api/contacto', { metodo: 'POST', datos });
      FM.mensajeEn(caja, r.mensaje, 'ok');
      form.mensaje.value = '';
      form.asunto.value = '';
    } catch (err) {
      FM.mensajeEn(caja, err.message);
    } finally {
      boton.disabled = false;
    }
  });
})();
