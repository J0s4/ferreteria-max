// =============================================================
//  super-panel.js — Secciones exclusivas del súper administrador.
//  Este archivo NO está en /public: el servidor solo lo entrega
//  si la sesión es de súper admin. Se suma al panel normal.
// =============================================================
'use strict';

(() => {
  const P = PanelAdmin;
  const { esc, colones, fecha, aviso, tabla, cabecera, formulario, confirmar } = P;
  // Dirección base de la ruta secreta (se deduce de dónde se cargó este archivo)
  const BASE = new URL(document.currentScript.src).pathname.replace(/\/panel\.js$/, '');
  const api = (ruta, opciones) => P.api(`${BASE}/api${ruta}`, opciones);
  const $ = (sel, raiz) => raiz.querySelector(sel);
  const GRUPO = 'Súper admin';

  /** Contraseña aleatoria fácil de dictar: Max-xxxx-0000 */
  function contrasenaAleatoria() {
    const letras = 'abcdefghjkmnpqrstuvwxyz';
    const azar = crypto.getRandomValues(new Uint32Array(8));
    const parte = Array.from(azar.slice(0, 4), (n) => letras[n % letras.length]).join('');
    const numeros = Array.from(azar.slice(4), (n) => n % 10).join('');
    return `Max-${parte}-${numeros}`;
  }

  // =============================================================
  //  VENTAS Y MANTENIMIENTO
  // =============================================================
  P.registrar({
    id: 'estado-sitio', titulo: 'Ventas y mantenimiento', icono: '🚦', grupo: GRUPO,
    async render(zona) {
      const c = await api('/configuracion');
      zona.innerHTML = `
        ${cabecera('Ventas y mantenimiento', 'Controle si el sitio vende en línea o si se muestra solo para el personal.')}
        <section class="interruptor">
          <div class="texto">
            <h3>Ventas en línea: ${c.ventas_activas ? '<span class="estado estado-hecho">Activas</span>' : '<span class="estado estado-no_hecho">Desactivadas</span>'}</h3>
            <p class="texto-suave">Si las desactiva, el sitio queda como catálogo: se ven productos y precios, pero nadie puede comprar. Los clientes ven este mensaje:</p>
            <div class="campo"><label for="mensaje-ventas">Mensaje para los clientes</label>
              <textarea id="mensaje-ventas" maxlength="300" style="min-height:80px">${esc(c.mensaje_ventas)}</textarea></div>
            <div class="botones-fila">
              <button class="boton ${c.ventas_activas ? 'boton-peligro' : 'boton-verde'}" type="button" data-ventas="${c.ventas_activas ? 0 : 1}">${c.ventas_activas ? 'Desactivar ventas' : 'Activar ventas'}</button>
              <button class="boton boton-borde" type="button" data-guardar="mensaje_ventas">Guardar solo el mensaje</button>
            </div>
          </div>
        </section>
        <section class="interruptor">
          <div class="texto">
            <h3>Modo mantenimiento: ${c.mantenimiento ? '<span class="estado estado-no_hecho">Activo</span>' : '<span class="estado estado-hecho">Apagado</span>'}</h3>
            <p class="texto-suave">Con el modo mantenimiento activo, los visitantes ven un aviso en lugar del sitio. Usted y los administradores siguen entrando normalmente.</p>
            <div class="campo"><label for="mensaje-mantenimiento">Mensaje de mantenimiento</label>
              <textarea id="mensaje-mantenimiento" maxlength="300" style="min-height:80px">${esc(c.mensaje_mantenimiento)}</textarea></div>
            <div class="botones-fila">
              <button class="boton ${c.mantenimiento ? 'boton-verde' : 'boton-peligro'}" type="button" data-mantenimiento="${c.mantenimiento ? 0 : 1}">${c.mantenimiento ? 'Apagar mantenimiento' : 'Activar mantenimiento'}</button>
              <button class="boton boton-borde" type="button" data-guardar="mensaje_mantenimiento">Guardar solo el mensaje</button>
            </div>
          </div>
        </section>`;

      const guardar = async (datos) => {
        try { aviso((await api('/configuracion', { metodo: 'PUT', datos })).mensaje); P.recargar(); }
        catch (e) { aviso(e.message, 'error'); }
      };
      zona.addEventListener('click', async (e) => {
        const v = e.target.closest('[data-ventas]');
        if (v) {
          const activar = v.dataset.ventas === '1';
          if (!activar && !(await confirmar('Los clientes no podrán comprar hasta que vuelva a activar las ventas.', { titulo: 'Desactivar ventas', textoBoton: 'Desactivar', peligro: true }))) return;
          guardar({ ventas_activas: activar, mensaje_ventas: $('#mensaje-ventas', zona).value });
        }
        const m = e.target.closest('[data-mantenimiento]');
        if (m) {
          const activar = m.dataset.mantenimiento === '1';
          if (activar && !(await confirmar('Los visitantes verán solo el aviso de mantenimiento.', { titulo: 'Activar mantenimiento', textoBoton: 'Activar', peligro: true }))) return;
          guardar({ mantenimiento: activar, mensaje_mantenimiento: $('#mensaje-mantenimiento', zona).value });
        }
        const g = e.target.closest('[data-guardar]');
        if (g) {
          const id = g.dataset.guardar === 'mensaje_ventas' ? '#mensaje-ventas' : '#mensaje-mantenimiento';
          guardar({ [g.dataset.guardar]: $(id, zona).value });
        }
      });
    },
  });

  // =============================================================
  //  USUARIOS
  // =============================================================
  P.registrar({
    id: 'usuarios', titulo: 'Usuarios', icono: '👥', grupo: GRUPO,
    async render(zona) {
      let rol = '';
      zona.innerHTML = `
        ${cabecera('Usuarios', 'Clientes y administradores. Su cuenta de súper admin no aparece aquí: se configura en el archivo .env.',
          '<button class="boton" type="button" data-crear>Crear usuario</button>')}
        <div class="herramientas">
          <div class="segmentos" role="group" aria-label="Filtrar por rol">
            ${[['', 'Todos'], ['cliente', 'Clientes'], ['admin', 'Administradores']].map(([v, t]) => `<button type="button" data-rol="${v}" aria-pressed="${v === ''}">${t}</button>`).join('')}
          </div>
          <input type="search" id="buscar-usuario" placeholder="Buscar por nombre, correo o teléfono" aria-label="Buscar usuario">
        </div>
        <div id="tabla-usuarios"></div>`;
      let usuarios = [];

      async function cargar() {
        const p = new URLSearchParams();
        if (rol) p.set('rol', rol);
        const q = $('#buscar-usuario', zona).value.trim();
        if (q) p.set('q', q);
        usuarios = await api(`/usuarios?${p}`);
        $('#tabla-usuarios', zona).innerHTML = tabla([
          { titulo: 'Nombre', html: (u) => `<strong>${esc(u.nombre)}</strong><br><small class="texto-suave">${esc(u.correo)}</small>` },
          { titulo: 'Teléfono', html: (u) => esc(u.telefono) },
          { titulo: 'Rol', html: (u) => (u.rol === 'admin' ? '<span class="etiqueta-destacado">Administrador</span>' : 'Cliente') },
          { titulo: 'Estado', html: (u) => (u.estado === 'activo' ? '<span class="estado estado-hecho">Activo</span>' : '<span class="estado estado-no_hecho">Suspendido</span>') },
          { titulo: 'Pedidos', clase: 'num', html: (u) => u.pedidos },
          { titulo: 'Último acceso', html: (u) => esc(fecha(u.ultimo_acceso)) || '<span class="texto-suave">Nunca</span>' },
          { titulo: '<span class="solo-lector">Acciones</span>', clase: 'acciones', html: (u) => `
            <button class="boton boton-chico boton-borde" type="button" data-editar="${u.id}">Editar</button>
            <button class="boton boton-chico boton-borde" type="button" data-clave="${u.id}">Contraseña</button>
            <button class="boton boton-chico ${u.estado === 'activo' ? 'boton-borde' : 'boton-verde'}" type="button" data-estado="${u.id}">${u.estado === 'activo' ? 'Suspender' : 'Reactivar'}</button>
            <button class="boton boton-chico boton-peligro" type="button" data-eliminar="${u.id}">Eliminar</button>` },
        ], usuarios, 'No hay usuarios con ese filtro.');
      }

      const ROLES = [['cliente', 'Cliente'], ['admin', 'Administrador']];
      zona.addEventListener('click', async (e) => {
        const r = e.target.closest('[data-rol]');
        if (r) {
          rol = r.dataset.rol;
          zona.querySelectorAll('[data-rol]').forEach((b) => b.setAttribute('aria-pressed', String(b === r)));
          cargar();
          return;
        }
        if (e.target.closest('[data-crear]')) {
          formulario({
            titulo: 'Crear usuario',
            valores: { rol: 'cliente', contrasena: contrasenaAleatoria() },
            campos: [
              { nombre: 'nombre', etiqueta: 'Nombre completo', requerido: true, max: 80 },
              [{ nombre: 'correo', etiqueta: 'Correo', tipo: 'correo', requerido: true }, { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' }],
              [{ nombre: 'rol', etiqueta: 'Rol', tipo: 'select', requerido: true, opciones: ROLES },
                { nombre: 'contrasena', etiqueta: 'Contraseña inicial', requerido: true, ayuda: 'Generada al azar. Compártala por un medio seguro.' }],
            ],
            textoEnviar: 'Crear usuario',
            enviar: async (d) => { const x = await api('/usuarios', { metodo: 'POST', datos: d }); cargar(); return x; },
          });
          return;
        }
        const boton = e.target.closest('[data-editar],[data-clave],[data-estado],[data-eliminar]');
        if (!boton) return;
        const id = Number(boton.dataset.editar || boton.dataset.clave || boton.dataset.estado || boton.dataset.eliminar);
        const u = usuarios.find((x) => x.id === id);
        if (!u) return;

        if (boton.dataset.editar) {
          formulario({
            titulo: `Editar a ${u.nombre}`,
            valores: u,
            campos: [
              { nombre: 'nombre', etiqueta: 'Nombre completo', requerido: true, max: 80 },
              [{ nombre: 'correo', etiqueta: 'Correo', tipo: 'correo', requerido: true }, { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' }],
              { nombre: 'direccion', etiqueta: 'Dirección', tipo: 'area', max: 250, alto: 70 },
              { nombre: 'rol', etiqueta: 'Rol', tipo: 'select', requerido: true, opciones: ROLES, ayuda: 'Si cambia el rol, la persona debe volver a iniciar sesión.' },
            ],
            enviar: async (d) => { const x = await api(`/usuarios/${u.id}`, { metodo: 'PUT', datos: d }); cargar(); return x; },
          });
        } else if (boton.dataset.clave) {
          formulario({
            titulo: 'Restablecer contraseña',
            antes: `<p style="margin-top:0">Cuenta de <strong>${esc(u.nombre)}</strong> (${esc(u.correo)}). Se cerrarán sus sesiones abiertas.</p>`,
            valores: { nueva: contrasenaAleatoria() },
            campos: [{ nombre: 'nueva', etiqueta: 'Contraseña nueva', requerido: true, ayuda: 'Mínimo 8 caracteres con letras y números. Puede usar la sugerida.' }],
            textoEnviar: 'Restablecer contraseña',
            enviar: async (d) => api(`/usuarios/${u.id}/contrasena`, { metodo: 'PUT', datos: d }),
          });
        } else if (boton.dataset.estado) {
          const suspender = u.estado === 'activo';
          if (suspender && !(await confirmar(`<strong>${esc(u.nombre)}</strong> no podrá iniciar sesión y se cerrarán sus sesiones abiertas.`, { titulo: 'Suspender cuenta', textoBoton: 'Suspender', peligro: true }))) return;
          try { aviso((await api(`/usuarios/${u.id}/estado`, { metodo: 'PUT', datos: { estado: suspender ? 'suspendido' : 'activo' } })).mensaje); cargar(); }
          catch (err) { aviso(err.message, 'error'); }
        } else if (boton.dataset.eliminar) {
          if (!(await confirmar(`¿Eliminar la cuenta de <strong>${esc(u.nombre)}</strong>? Esta acción no se puede deshacer. Sus pedidos se conservan en el historial.`, { titulo: 'Eliminar usuario', textoBoton: 'Eliminar', peligro: true }))) return;
          try { aviso((await api(`/usuarios/${u.id}`, { metodo: 'DELETE' })).mensaje); cargar(); }
          catch (err) { aviso(err.message, 'error'); }
        }
      });
      let espera;
      $('#buscar-usuario', zona).addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(cargar, 300); });
      await cargar();
    },
  });

  // =============================================================
  //  INFORMACIÓN DEL SITIO (nombre, logo, colores, SINPE, horarios, banners)
  // =============================================================
  P.registrar({
    id: 'sitio', titulo: 'Información del sitio', icono: '🏷️', grupo: GRUPO,
    async render(zona) {
      const c = await api('/configuracion');
      const campos = [
        [{ nombre: 'nombre_tienda', etiqueta: 'Nombre de la tienda', requerido: true, max: 60 }, { nombre: 'eslogan', etiqueta: 'Eslogan', max: 120 }],
        [{ nombre: 'sinpe_numero', etiqueta: 'Número SINPE Móvil', tipo: 'tel', requerido: true, ayuda: 'Es el número que ven los clientes al pagar.' },
          { nombre: 'sinpe_titular', etiqueta: 'Titular de la cuenta SINPE', requerido: true, max: 80 }],
        [{ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' }, { nombre: 'whatsapp', etiqueta: 'WhatsApp', tipo: 'tel' }, { nombre: 'correo', etiqueta: 'Correo', tipo: 'correo' }],
        { nombre: 'horario_general', etiqueta: 'Horario general', tipo: 'area', max: 400, alto: 90, ayuda: 'Se muestra en el pie de página y en Contacto. Cada sucursal tiene su propio horario.' },
        [{ nombre: 'color_primario', etiqueta: 'Color principal', tipo: 'color', opcional: false, ayuda: 'Botones y detalles.' },
          { nombre: 'color_secundario', etiqueta: 'Color secundario', tipo: 'color', opcional: false, ayuda: 'Encabezado y pie de página.' }],
      ];
      zona.innerHTML = `
        ${cabecera('Información del sitio', 'Lo que se muestra en todas las páginas. Los cambios se ven de inmediato.')}
        <div class="rejilla-sitio">
          <form class="caja" id="form-sitio" novalidate>
            <h2>Datos generales</h2>
            <div class="mensaje-formulario error oculto" role="alert"></div>
            ${P.camposHTML(campos, c)}
            <div class="botones-fila">
              <button class="boton" type="submit">Guardar cambios</button>
              <button class="boton boton-borde" type="button" data-colores-originales>Usar colores originales</button>
            </div>
          </form>
          <section class="caja">
            <h2>Logo</h2>
            <div style="background:var(--secundario);padding:1rem;border-radius:8px;display:flex;align-items:center;gap:.75rem;margin-bottom:1rem">
              <img src="${esc(c.logo || '/img/logo.svg')}" alt="Logo actual" style="width:64px;height:64px;object-fit:contain">
              <strong style="color:var(--texto-secundario);font:800 1.4rem var(--letra-rotulo)">${esc(c.nombre_tienda)}</strong>
            </div>
            <form id="form-logo" novalidate>
              <div class="campo"><label for="archivo-logo">Subir logo nuevo</label>
                <input type="file" id="archivo-logo" name="logo" accept="image/png,image/jpeg,image/webp">
                <span class="ayuda">PNG con fondo transparente, cuadrado, de máximo 4 MB.</span></div>
              <div class="botones-fila"><button class="boton boton-chico" type="submit">Subir logo</button>
              ${c.logo ? '<button class="boton boton-chico boton-borde" type="button" data-quitar-logo>Restablecer logo original</button>' : ''}</div>
            </form>
          </section>
        </div>
        <section class="caja" style="margin-top:1.25rem">
          <div class="cabecera-admin" style="margin-bottom:.75rem"><div><h2 style="margin:0">Banners del inicio</h2><p>Se muestran en rotación en la portada. Máximo 6.</p></div>
            <button class="boton" type="button" data-nuevo-banner ${c.banners.length >= 6 ? 'disabled' : ''}>Agregar banner</button></div>
          ${tabla([
            { titulo: 'Imagen', html: (b) => (b.imagen ? `<img class="miniatura" src="${esc(b.imagen)}" alt="">` : '<span class="texto-suave">Tablero de herramientas</span>') },
            { titulo: 'Título', html: (b) => `<strong>${esc(b.titulo)}</strong><br><small class="texto-suave">${esc(b.texto)}</small>` },
            { titulo: 'Botón', html: (b) => (b.enlace ? `${esc(b.texto_boton || 'Ver más')} → ${esc(b.enlace)}` : '<span class="texto-suave">Sin botón</span>') },
            { titulo: '<span class="solo-lector">Acciones</span>', clase: 'acciones', html: (b) => `
              <button class="boton boton-chico boton-borde" type="button" data-editar-banner="${c.banners.indexOf(b)}">Editar</button>
              <button class="boton boton-chico boton-peligro" type="button" data-borrar-banner="${c.banners.indexOf(b)}">Eliminar</button>` },
          ], c.banners, 'No hay banners. La portada muestra el eslogan.')}
        </section>`;

      // Datos generales
      const form = $('#form-sitio', zona);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const datos = Object.fromEntries(new FormData(form));
        try { aviso((await api('/configuracion', { metodo: 'PUT', datos })).mensaje); P.recargar(); }
        catch (err) { FM.mensajeEn($('.mensaje-formulario', form), err.message); }
      });

      // Logo
      $('#form-logo', zona).addEventListener('submit', async (e) => {
        e.preventDefault();
        const archivo = $('#archivo-logo', zona).files[0];
        if (!archivo) { aviso('Elija una imagen para el logo.', 'error'); return; }
        const fd = new FormData();
        fd.append('logo', archivo);
        try { aviso((await api('/configuracion/logo', { metodo: 'POST', formulario: fd })).mensaje); P.recargar(); }
        catch (err) { aviso(err.message, 'error'); }
      });

      const camposBanner = (editando) => [
        { nombre: 'titulo', etiqueta: 'Título', requerido: true, max: 90 },
        { nombre: 'texto', etiqueta: 'Texto', tipo: 'area', max: 220, alto: 70 },
        [{ nombre: 'texto_boton', etiqueta: 'Texto del botón', max: 40, placeholder: 'Ver ofertas' },
          { nombre: 'enlace', etiqueta: 'Enlace del botón', max: 200, placeholder: '/catalogo?ofertas=1', ayuda: 'Una página del sitio. Vacío = sin botón.' }],
        { nombre: 'imagen', etiqueta: editando ? 'Cambiar imagen' : 'Imagen', tipo: 'archivo', ayuda: 'Horizontal (4:3). Sin imagen se muestra un tablero con herramientas.' },
        ...(editando ? [{ nombre: 'quitar_imagen', etiqueta: 'Quitar la imagen actual', tipo: 'casilla' }] : []),
      ];

      zona.addEventListener('click', async (e) => {
        if (e.target.closest('[data-colores-originales]')) {
          form.elements.color_primario.value = '#F28C00';
          form.elements.color_secundario.value = '#2A2E33';
          aviso('Colores originales puestos. Presione "Guardar cambios" para aplicarlos.', 'info');
        }
        if (e.target.closest('[data-quitar-logo]')) {
          try { aviso((await api('/configuracion/logo', { metodo: 'DELETE' })).mensaje); P.recargar(); }
          catch (err) { aviso(err.message, 'error'); }
        }
        if (e.target.closest('[data-nuevo-banner]')) {
          formulario({
            titulo: 'Agregar banner', multipart: true, campos: camposBanner(false),
            valores: { enlace: '/catalogo', texto_boton: 'Ver el catálogo' }, textoEnviar: 'Agregar banner',
            enviar: async (d) => { const r = await api('/configuracion/banners', { metodo: 'POST', formulario: d }); P.recargar(); return r; },
          });
        }
        const ed = e.target.closest('[data-editar-banner]');
        if (ed) {
          const i = Number(ed.dataset.editarBanner);
          formulario({
            titulo: 'Editar banner', multipart: true, campos: camposBanner(true), valores: c.banners[i],
            enviar: async (d) => { const r = await api(`/configuracion/banners/${i}`, { metodo: 'PUT', formulario: d }); P.recargar(); return r; },
          });
        }
        const bo = e.target.closest('[data-borrar-banner]');
        if (bo && await confirmar('¿Eliminar este banner?', { titulo: 'Eliminar banner', textoBoton: 'Eliminar', peligro: true })) {
          try { aviso((await api(`/configuracion/banners/${bo.dataset.borrarBanner}`, { metodo: 'DELETE' })).mensaje); P.recargar(); }
          catch (err) { aviso(err.message, 'error'); }
        }
      });
    },
  });

  // =============================================================
  //  SUCURSALES
  // =============================================================
  P.registrar({
    id: 'sucursales', titulo: 'Sucursales', icono: '🏬', grupo: GRUPO,
    async render(zona) {
      const sucursales = await api('/sucursales');
      zona.innerHTML = `
        ${cabecera('Sucursales', 'Aparecen en la página Sucursales y como opción de retiro en los pedidos.', '<button class="boton" type="button" data-nueva>Agregar sucursal</button>')}
        ${tabla([
          { titulo: 'Sucursal', html: (s) => `<strong>${esc(s.nombre)}</strong>${s.activa ? '' : '<span class="etiqueta-gris">Oculta</span>'}<br><small class="texto-suave">${esc(s.direccion)}</small>` },
          { titulo: 'Teléfono', html: (s) => esc(s.telefono) },
          { titulo: 'Horario', html: (s) => `<small style="white-space:pre-line">${esc(s.horario)}</small>` },
          { titulo: 'Personal', clase: 'num', html: (s) => s.personas },
          { titulo: '<span class="solo-lector">Acciones</span>', clase: 'acciones', html: (s) => `
            <button class="boton boton-chico boton-borde" type="button" data-editar="${s.id}">Editar</button>
            <button class="boton boton-chico boton-peligro" type="button" data-eliminar="${s.id}">Eliminar</button>` },
        ], sucursales, 'No hay sucursales registradas.')}`;

      const abrir = (s = null) => formulario({
        titulo: s ? 'Editar sucursal' : 'Agregar sucursal', ancho: true,
        valores: s || { activa: true, orden: sucursales.length + 1, horario: 'Lunes a viernes: 7:00 a. m. a 5:30 p. m.\nSábados: 7:00 a. m. a 12:00 m. d.\nDomingos: cerrado' },
        campos: [
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 80, placeholder: 'Sucursal Alajuela' },
          { nombre: 'direccion', etiqueta: 'Dirección', requerido: true, max: 300, placeholder: 'De la iglesia, 100 m al sur' },
          [{ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' }, { nombre: 'correo', etiqueta: 'Correo', tipo: 'correo' }],
          { nombre: 'horario', etiqueta: 'Horario', tipo: 'area', max: 400, alto: 90 },
          [{ nombre: 'latitud', etiqueta: 'Latitud', placeholder: '9.9281' }, { nombre: 'longitud', etiqueta: 'Longitud', placeholder: '-84.0779' }],
          { nombre: 'orden', etiqueta: 'Orden', tipo: 'numero', min: 0, max: 999, ayuda: 'Para el mapa: en Google Maps haga clic derecho sobre el local y copie los dos números (latitud, longitud).' },
          { nombre: 'activa', etiqueta: 'Visible en el sitio', tipo: 'casilla' },
        ],
        enviar: async (d) => { const r = await api(s ? `/sucursales/${s.id}` : '/sucursales', { metodo: s ? 'PUT' : 'POST', datos: d }); P.recargar(); return r; },
      });

      zona.addEventListener('click', async (e) => {
        if (e.target.closest('[data-nueva]')) abrir();
        const ed = e.target.closest('[data-editar]');
        if (ed) abrir(sucursales.find((s) => s.id === Number(ed.dataset.editar)));
        const el = e.target.closest('[data-eliminar]');
        if (el) {
          const s = sucursales.find((x) => x.id === Number(el.dataset.eliminar));
          if (!(await confirmar(`¿Eliminar <strong>${esc(s.nombre)}</strong>? Su personal quedará sin sucursal asignada. Si es temporal, mejor edítela y desmarque "Visible en el sitio".`, { titulo: 'Eliminar sucursal', textoBoton: 'Eliminar', peligro: true }))) return;
          try { aviso((await api(`/sucursales/${s.id}`, { metodo: 'DELETE' })).mensaje); P.recargar(); }
          catch (err) { aviso(err.message, 'error'); }
        }
      });
    },
  });

  // =============================================================
  //  PERSONAL
  // =============================================================
  P.registrar({
    id: 'personal', titulo: 'Personal', icono: '🦺', grupo: GRUPO,
    async render(zona) {
      const [personal, sucursales] = await Promise.all([api('/personal'), api('/sucursales')]);
      zona.innerHTML = `
        ${cabecera('Personal', 'Las personas que aparecen en la página "Nuestro personal".', '<button class="boton" type="button" data-nueva>Agregar persona</button>')}
        ${tabla([
          { titulo: '<span class="solo-lector">Foto</span>', html: (p) => `<div class="avatar" style="width:44px;height:44px;font-size:1.1rem">${p.foto ? `<img src="${esc(p.foto)}" alt="">` : esc(FM.iniciales(p.nombre))}</div>` },
          { titulo: 'Nombre', html: (p) => `<strong>${esc(p.nombre)}</strong>` },
          { titulo: 'Puesto', html: (p) => esc(p.puesto) },
          { titulo: 'Sucursal', html: (p) => esc(p.sucursal || 'Sin sucursal') },
          { titulo: '<span class="solo-lector">Acciones</span>', clase: 'acciones', html: (p) => `
            <button class="boton boton-chico boton-borde" type="button" data-editar="${p.id}">Editar</button>
            <button class="boton boton-chico boton-peligro" type="button" data-eliminar="${p.id}">Eliminar</button>` },
        ], personal, 'No hay personal registrado.')}`;

      const abrir = (p = null) => formulario({
        titulo: p ? 'Editar persona' : 'Agregar persona', multipart: true,
        valores: p || { orden: personal.length + 1 },
        campos: [
          { nombre: 'nombre', etiqueta: 'Nombre completo', requerido: true, max: 80 },
          [{ nombre: 'puesto', etiqueta: 'Puesto', requerido: true, max: 80, placeholder: 'Vendedor' },
            { nombre: 'sucursal_id', etiqueta: 'Sucursal', tipo: 'select', opciones: [['', 'Sin sucursal'], ...sucursales.map((s) => [s.id, s.nombre])] }],
          { nombre: 'descripcion', etiqueta: 'Descripción corta', tipo: 'area', max: 300, alto: 70 },
          { nombre: 'foto', etiqueta: p?.foto ? 'Cambiar foto' : 'Foto', tipo: 'archivo', vistaPrevia: p?.foto, ayuda: 'Cuadrada, máximo 3 MB. Sin foto se muestran las iniciales.' },
          ...(p?.foto ? [{ nombre: 'quitar_foto', etiqueta: 'Quitar la foto actual', tipo: 'casilla' }] : []),
          { nombre: 'orden', etiqueta: 'Orden', tipo: 'numero', min: 0, max: 999 },
        ],
        enviar: async (d) => { const r = await api(p ? `/personal/${p.id}` : '/personal', { metodo: p ? 'PUT' : 'POST', formulario: d }); P.recargar(); return r; },
      });

      zona.addEventListener('click', async (e) => {
        if (e.target.closest('[data-nueva]')) abrir();
        const ed = e.target.closest('[data-editar]');
        if (ed) abrir(personal.find((p) => p.id === Number(ed.dataset.editar)));
        const el = e.target.closest('[data-eliminar]');
        if (el) {
          const p = personal.find((x) => x.id === Number(el.dataset.eliminar));
          if (!(await confirmar(`¿Quitar a <strong>${esc(p.nombre)}</strong> de la página de personal?`, { titulo: 'Eliminar persona', textoBoton: 'Eliminar', peligro: true }))) return;
          try { aviso((await api(`/personal/${p.id}`, { metodo: 'DELETE' })).mensaje); P.recargar(); }
          catch (err) { aviso(err.message, 'error'); }
        }
      });
    },
  });

  // =============================================================
  //  REPORTES
  // =============================================================
  P.registrar({
    id: 'reportes', titulo: 'Reportes', icono: '📈', grupo: GRUPO,
    async render(zona) {
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
      const sumar = (f, dias) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };
      const inicioMes = hoy.slice(0, 8) + '01';
      const rangos = {
        mes: [inicioMes, hoy],
        pasado: (() => { const fin = sumar(inicioMes, -1); return [fin.slice(0, 8) + '01', fin]; })(),
        dias30: [sumar(hoy, -29), hoy],
        anio: [hoy.slice(0, 4) + '-01-01', hoy],
      };
      zona.innerHTML = `
        ${cabecera('Reportes', 'Ventas con pago confirmado ("Hecho"), productos más vendidos y clientes.')}
        <div class="herramientas">
          <div class="segmentos" role="group" aria-label="Período rápido">
            <button type="button" data-rango="mes" aria-pressed="true">Este mes</button>
            <button type="button" data-rango="pasado" aria-pressed="false">Mes pasado</button>
            <button type="button" data-rango="dias30" aria-pressed="false">Últimos 30 días</button>
            <button type="button" data-rango="anio" aria-pressed="false">Este año</button>
          </div>
          <label class="solo-lector" for="desde">Desde</label><input type="date" id="desde" value="${rangos.mes[0]}" max="${hoy}">
          <label class="solo-lector" for="hasta">Hasta</label><input type="date" id="hasta" value="${rangos.mes[1]}" max="${hoy}">
          <button class="boton boton-oscuro boton-chico" type="button" data-ver>Ver reporte</button>
        </div>
        <div id="reporte"><p class="cargando">Cargando…</p></div>`;

      const barras = (lista, campoValor, formato) => {
        const max = Math.max(...lista.map((x) => x[campoValor]), 1);
        return `<div class="barras">${lista.map((x) => `
          <div class="barra-fila"><span class="nombre-barra" title="${esc(x.nombre)}">${esc(x.nombre)}</span>
            <div class="pista"><div class="relleno" style="width:${(x[campoValor] / max) * 100}%"></div></div>
            <strong>${formato(x)}</strong></div>`).join('')}</div>`;
      };

      async function cargar() {
        const desde = $('#desde', zona).value;
        const hasta = $('#hasta', zona).value;
        if (desde > hasta) { aviso('La fecha "desde" debe ser anterior a "hasta".', 'error'); return; }
        const r = await api(`/reportes?desde=${desde}&hasta=${hasta}`);
        // Completar los días sin ventas para que el gráfico sea continuo
        const dias = [];
        for (let d = r.desde; d <= r.hasta && dias.length < 400; d = sumar(d, 1)) {
          const v = r.por_dia.find((x) => x.dia === d);
          dias.push({ dia: d, total: v ? v.total : 0, pedidos: v ? v.pedidos : 0 });
        }
        const maxDia = Math.max(...dias.map((d) => d.total), 1);
        const fmtDia = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-CR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
        const nombreMes = (m) => new Date(m + '-15T12:00:00Z').toLocaleDateString('es-CR', { timeZone: 'UTC', month: 'long', year: 'numeric' });

        $('#reporte', zona).innerHTML = `
          <div class="indicadores">
            <div class="indicador bien"><span class="valor">${colones(r.resumen.ventas)}</span><span class="etiqueta-ind">Ventas confirmadas</span></div>
            <div class="indicador"><span class="valor">${r.resumen.pedidos}</span><span class="etiqueta-ind">Pedidos pagados</span><small>${r.resumen.pedidos_creados} pedidos creados</small></div>
            <div class="indicador"><span class="valor">${colones(r.resumen.ticket_promedio)}</span><span class="etiqueta-ind">Compra promedio</span></div>
            <div class="indicador"><span class="valor">${r.resumen.clientes_nuevos}</span><span class="etiqueta-ind">Clientes nuevos</span><small>${r.resumen.clientes_total} clientes en total</small></div>
          </div>
          <section class="caja">
            <h2>Ventas por día</h2>
            <div class="columnas-dia" role="img" aria-label="Gráfico de ventas por día">
              ${dias.map((d) => `<div style="height:${(d.total / maxDia) * 100}%" title="${fmtDia(d.dia)}: ${colones(d.total)} (${d.pedidos} pedidos)"></div>`).join('')}
            </div>
            <div class="eje-dias"><span>${fmtDia(r.desde)}</span><span>${fmtDia(r.hasta)}</span></div>
          </section>
          <div class="rejilla-admin" style="margin-top:1.25rem">
            <section class="caja"><h2>Productos más vendidos</h2>
              ${r.top_productos.length ? barras(r.top_productos, 'unidades', (x) => `${x.unidades} u.`) : '<p class="vacio-chico">Sin ventas en este período.</p>'}</section>
            <section class="caja"><h2>Ventas por categoría</h2>
              ${r.por_categoria.length ? barras(r.por_categoria, 'monto', (x) => colones(x.monto)) : '<p class="vacio-chico">Sin ventas en este período.</p>'}</section>
          </div>
          <div class="rejilla-admin" style="margin-top:1.25rem">
            <section class="caja"><h2>Ventas por mes (último año)</h2>
              ${tabla([
                { titulo: 'Mes', html: (m) => esc(nombreMes(m.mes)) },
                { titulo: 'Pedidos', clase: 'num', html: (m) => m.pedidos },
                { titulo: 'Total', clase: 'num', html: (m) => colones(m.total) },
              ], r.por_mes.slice().reverse(), 'Sin ventas en el último año.')}</section>
            <section class="caja"><h2>Mejores clientes</h2>
              ${tabla([
                { titulo: 'Cliente', html: (c) => `<strong>${esc(c.nombre)}</strong><br><small class="texto-suave">${esc(c.correo)}</small>` },
                { titulo: 'Pedidos', clase: 'num', html: (c) => c.pedidos },
                { titulo: 'Comprado', clase: 'num', html: (c) => colones(c.total_comprado) },
              ], r.clientes.slice(0, 15), 'Sin clientes registrados.')}
              <p style="margin:.75rem 0 0"><a class="enlace" href="#datos">Exportar la lista completa de clientes</a></p></section>
          </div>`;
      }

      zona.addEventListener('click', (e) => {
        const b = e.target.closest('[data-rango]');
        if (b) {
          zona.querySelectorAll('[data-rango]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          [$('#desde', zona).value, $('#hasta', zona).value] = rangos[b.dataset.rango];
          cargar();
        }
        if (e.target.closest('[data-ver]')) {
          zona.querySelectorAll('[data-rango]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          cargar();
        }
      });
      await cargar();
    },
  });

  // =============================================================
  //  BITÁCORA DE ACTIVIDAD
  // =============================================================
  P.registrar({
    id: 'bitacora', titulo: 'Bitácora', icono: '📜', grupo: GRUPO,
    async render(zona) {
      let pagina = 1;
      zona.innerHTML = `
        ${cabecera('Bitácora de actividad', 'Quién hizo cada cambio y cuándo. Incluye inicios de sesión del personal e intentos fallidos de acceso a esta ruta.')}
        <div class="herramientas"><input type="search" id="buscar-bitacora" placeholder="Buscar por acción, detalle o usuario" aria-label="Buscar en la bitácora"></div>
        <div id="tabla-bitacora"></div>`;

      async function cargar() {
        const q = $('#buscar-bitacora', zona).value.trim();
        const r = await api(`/bitacora?pagina=${pagina}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
        $('#tabla-bitacora', zona).innerHTML = tabla([
          { titulo: 'Fecha', html: (b) => `<span style="white-space:nowrap">${esc(fecha(b.fecha))}</span>` },
          { titulo: 'Usuario', html: (b) => `${esc(b.usuario_nombre)}${b.rol ? `<br><small class="texto-suave">${esc(b.rol)}</small>` : ''}` },
          { titulo: 'Acción', html: (b) => `<strong>${esc(b.accion)}</strong>` },
          { titulo: 'Detalle', html: (b) => esc(b.detalle) },
          { titulo: 'IP', html: (b) => `<small class="texto-suave">${esc(b.ip)}</small>` },
        ], r.filas, 'Sin registros.') + `
          <div class="paginacion"><span class="texto-suave">Página ${r.pagina} de ${r.paginas} (${r.total} registros)</span>
            <button class="boton boton-chico boton-borde" type="button" data-pagina="${r.pagina - 1}" ${r.pagina <= 1 ? 'disabled' : ''}>Anterior</button>
            <button class="boton boton-chico boton-borde" type="button" data-pagina="${r.pagina + 1}" ${r.pagina >= r.paginas ? 'disabled' : ''}>Siguiente</button></div>`;
      }
      zona.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pagina]');
        if (b && !b.disabled) { pagina = Number(b.dataset.pagina); cargar(); }
      });
      let espera;
      $('#buscar-bitacora', zona).addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => { pagina = 1; cargar(); }, 300); });
      await cargar();
    },
  });

  // =============================================================
  //  EXPORTAR DATOS Y RESPALDOS
  // =============================================================
  P.registrar({
    id: 'datos', titulo: 'Exportar y respaldos', icono: '💾', grupo: GRUPO,
    async render(zona) {
      const TIPOS = [
        ['productos', 'Productos', 'Catálogo con precios e inventario exacto.'],
        ['pedidos', 'Pedidos', 'Todos los pedidos con su estado de pago.'],
        ['detalle', 'Detalle de pedidos', 'Cada producto vendido en cada pedido.'],
        ['clientes', 'Clientes', 'Datos de contacto y total comprado.'],
        ['usuarios', 'Usuarios', 'Clientes y administradores (sin contraseñas).'],
        ['inventario', 'Movimientos de inventario', 'Entradas, salidas, ajustes y ventas.'],
        ['bitacora', 'Bitácora', 'Registro completo de actividad.'],
      ];

      async function pintar() {
        const info = await api('/respaldo/info');
        zona.innerHTML = `
          ${cabecera('Exportar y respaldos', 'Descargue la información para trabajarla en Excel o guarde una copia completa de la base de datos.')}
          <section class="caja">
            <h2>Exportar datos</h2>
            ${tabla([
              { titulo: 'Información', html: (t) => `<strong>${t[1]}</strong><br><small class="texto-suave">${t[2]}</small>` },
              { titulo: '<span class="solo-lector">Descargar</span>', clase: 'acciones', html: (t) => `
                <a class="boton boton-chico" href="${BASE}/api/exportar/${t[0]}?formato=xlsx">Excel</a>
                <a class="boton boton-chico boton-borde" href="${BASE}/api/exportar/${t[0]}?formato=csv">CSV</a>` },
            ], TIPOS)}
          </section>
          <section class="caja">
            <h2>Respaldo de la base de datos</h2>
            <p>Se genera en el momento y se descarga a su computadora. Guárdelo fuera de ella (USB o nube).</p>
            <div class="botones-fila">
              <a class="boton" href="${BASE}/api/respaldo?formato=json">Descargar respaldo (JSON)</a>
              ${info.permiteDB ? `<a class="boton boton-oscuro" href="${BASE}/api/respaldo?formato=db">Descargar copia exacta (.db)</a>` : ''}
            </div>
            <p class="texto-suave" style="margin:1rem 0 0">
              ${info.permiteDB
                ? 'El archivo JSON trae todas las tablas e imágenes. La copia .db es el archivo completo de SQLite: para restaurarla, detenga el servidor, reemplace <code>datos/ferreteria.db</code> por ella (con ese mismo nombre), borre <code>ferreteria.db-wal</code> y <code>ferreteria.db-shm</code> si existen, y vuelva a ejecutar <code>npm start</code>.'
                : 'La base de datos está en Turso, que además guarda copias automáticas: desde el panel de Turso se puede volver a un momento anterior. El archivo JSON trae todas las tablas e imágenes.'}
            </p>
          </section>`;
      }

      await pintar();
    },
  });
})();
