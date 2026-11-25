// Inicio de sesión y registro de clientes
'use strict';

(async () => {
  const { usuario } = await FM.iniciar('');
  const caja = document.getElementById('mensaje');

  // Solo se permite volver a páginas de este mismo sitio (evita redirecciones a sitios falsos)
  const volverCrudo = FM.parametro('volver') || '';
  const volver = /^\/(?!\/)[\w\-/?=&.%]*$/.test(volverCrudo) ? volverCrudo : '';
  const destino = (u) => (u.rol === 'cliente' ? (volver && !volver.startsWith('/admin') ? volver : '/cuenta') : '/admin');

  if (usuario) { location.href = destino(usuario); return; }
  if (volver) {
    document.getElementById('enlace-registro')?.setAttribute('href', `/registro?volver=${encodeURIComponent(volver)}`);
    document.getElementById('enlace-login')?.setAttribute('href', `/login?volver=${encodeURIComponent(volver)}`);
  }

  async function enviar(form, url, validar) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const datos = Object.fromEntries(new FormData(form));
      const problema = validar(datos);
      if (problema) { FM.mensajeEn(caja, problema); return; }
      const boton = form.querySelector('button[type="submit"]');
      boton.disabled = true;
      try {
        const r = await FM.api(url, { metodo: 'POST', datos });
        FM.mensajeEn(caja, r.mensaje, 'ok');
        location.href = destino(r.usuario);
      } catch (err) {
        FM.mensajeEn(caja, err.message);
        boton.disabled = false;
      }
    });
  }

  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    enviar(formLogin, '/api/auth/login', (d) => (!d.correo || !d.contrasena ? 'Escriba su correo y su contraseña.' : ''));
  }

  const formRegistro = document.getElementById('form-registro');
  if (formRegistro) {
    enviar(formRegistro, '/api/auth/registro', (d) => {
      if (!d.nombre.trim() || !d.correo.trim() || !d.telefono.trim()) return 'Complete su nombre, correo y teléfono.';
      if (d.contrasena.length < 8 || !/[A-Za-z]/.test(d.contrasena) || !/\d/.test(d.contrasena)) {
        return 'La contraseña debe tener al menos 8 caracteres, con letras y números.';
      }
      if (d.contrasena !== d.confirmar) return 'Las contraseñas no coinciden.';
      return '';
    });
  }
})();
