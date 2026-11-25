// Inicio de sesión del súper administrador (ruta oculta)
'use strict';
(() => {
  const base = document.currentScript.src.replace(/\/login\.js(\?.*)?$/, '');
  const form = document.getElementById('form-maestro');
  const caja = document.getElementById('mensaje');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('button');
    boton.disabled = true;
    caja.classList.add('oculto');
    try {
      const r = await fetch(`${base}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ correo: form.correo.value, contrasena: form.contrasena.value }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || 'No se pudo entrar.');
      location.href = '/admin#estado-sitio';
    } catch (err) {
      caja.className = 'mensaje-formulario error';
      caja.textContent = err.message;
      boton.disabled = false;
    }
  });
})();
