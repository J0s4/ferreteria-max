// =============================================================
//  comun.js — Código compartido por todas las páginas públicas:
//  llamadas a la API, encabezado, pie, carrito y avisos.
// =============================================================
'use strict';

const FM = (() => {
  const estado = { config: null, usuario: null };

  // ---------- Llamar a la API del servidor ----------
  async function api(url, { metodo = 'GET', datos, formulario } = {}) {
    const opciones = { method: metodo, headers: {}, credentials: 'same-origin' };
    if (formulario) opciones.body = formulario; // FormData (para subir imágenes)
    else if (datos !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(datos);
    }
    let respuesta;
    try {
      respuesta = await fetch(url, opciones);
    } catch {
      throw new Error('No hay conexión con el servidor. Revise que esté encendido e intente de nuevo.');
    }
    let cuerpo = null;
    try { cuerpo = await respuesta.json(); } catch { /* sin cuerpo JSON */ }
    if (!respuesta.ok) {
      const error = new Error(cuerpo?.error || `Error ${respuesta.status}`);
      error.estado = respuesta.status;
      throw error;
    }
    return cuerpo;
  }

  // ---------- Utilidades de formato ----------
  /** Escapa texto antes de meterlo en HTML (evita ataques XSS) */
  const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const formatoColones = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const colones = (n) => formatoColones.format(Number(n) || 0);
  /** Las fechas vienen en UTC desde la base de datos; se muestran en hora de Costa Rica */
  const aFecha = (texto) => (texto ? new Date(String(texto).replace(' ', 'T') + (String(texto).length <= 19 ? 'Z' : '')) : null);
  const fecha = (texto, conHora = true) => {
    const d = aFecha(texto);
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', dateStyle: 'medium', ...(conHora ? { timeStyle: 'short' } : {}) });
  };
  const parametro = (nombre) => new URLSearchParams(location.search).get(nombre);
  const iniciales = (nombre) => String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  const DISPONIBILIDAD = { disponible: 'Disponible', pocas: 'Pocas unidades', agotado: 'Agotado' };
  const ESTADOS_PAGO = { por_hacer: 'Por hacer', hecho: 'Hecho', no_hecho: 'No hecho' };
  const etiquetaDisp = (d) => `<span class="disp disp-${esc(d)}">${DISPONIBILIDAD[d] || ''}</span>`;
  const etiquetaEstado = (e) => `<span class="estado estado-${esc(e)}">${ESTADOS_PAGO[e] || e}</span>`;

  // ---------- Avisos flotantes ----------
  function aviso(mensaje, tipo = 'ok') {
    let caja = document.querySelector('.avisos');
    if (!caja) {
      caja = document.createElement('div');
      caja.className = 'avisos';
      caja.setAttribute('role', 'status');
      caja.setAttribute('aria-live', 'polite');
      document.body.appendChild(caja);
    }
    const el = document.createElement('div');
    el.className = `aviso ${tipo}`;
    el.textContent = mensaje;
    caja.appendChild(el);
    setTimeout(() => el.remove(), tipo === 'error' ? 7000 : 4500);
  }

  /** Muestra un mensaje dentro de un formulario */
  function mensajeEn(contenedor, texto, tipo = 'error') {
    if (!contenedor) return;
    contenedor.className = `mensaje-formulario ${tipo}`;
    contenedor.textContent = texto;
    contenedor.classList.toggle('oculto', !texto);
    if (texto) contenedor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ---------- Carrito (se guarda en el navegador; los precios reales vienen del servidor) ----------
  const CLAVE_CARRITO = 'fm_carrito';
  const carrito = {
    obtener() {
      try { return JSON.parse(localStorage.getItem(CLAVE_CARRITO)) || []; } catch { return []; }
    },
    guardar(items) {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(items.filter((i) => i.cantidad > 0)));
      actualizarContador();
    },
    agregar(id, cantidad = 1) {
      const items = carrito.obtener();
      const existente = items.find((i) => i.id === id);
      if (existente) existente.cantidad = Math.min(existente.cantidad + cantidad, 999);
      else items.push({ id, cantidad });
      carrito.guardar(items);
    },
    cambiar(id, cantidad) {
      const items = carrito.obtener().map((i) => (i.id === id ? { ...i, cantidad: Math.max(0, Math.min(cantidad, 999)) } : i));
      carrito.guardar(items);
    },
    quitar(id) { carrito.guardar(carrito.obtener().filter((i) => i.id !== id)); },
    vaciar() { carrito.guardar([]); },
    unidades() { return carrito.obtener().reduce((s, i) => s + i.cantidad, 0); },
  };

  function actualizarContador() {
    const n = carrito.unidades();
    document.querySelectorAll('[data-contador-carrito]').forEach((el) => {
      el.textContent = n;
      el.classList.toggle('oculto', n === 0);
    });
    const enlace = document.querySelector('[data-enlace-carrito]');
    if (enlace) enlace.setAttribute('aria-label', `Carrito: ${n} ${n === 1 ? 'unidad' : 'unidades'}`);
  }

  // ---------- Íconos ----------
  const ICONOS = {
    carrito: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2.5 3h3l2.6 12.2a1 1 0 0 0 1 .8h9.3a1 1 0 0 0 1-.8L21 7H6.4"/></svg>',
    usuario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    cerrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    buscar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  };

  // ---------- Encabezado y pie ----------
  const PAGINAS = [
    ['inicio', '/', 'Inicio'],
    ['catalogo', '/catalogo', 'Catálogo'],
    ['sucursales', '/sucursales', 'Sucursales'],
    ['personal', '/personal', 'Nuestro personal'],
    ['contacto', '/contacto', 'Contacto'],
  ];

  function pintarEncabezado(pagina) {
    const c = estado.config;
    const u = estado.usuario;
    const esPersonal = u && (u.rol === 'admin' || u.rol === 'superadmin');
    const cuenta = !u
      ? { href: '/login', texto: 'Ingresar' }
      : esPersonal ? { href: '/admin', texto: 'Panel' } : { href: '/cuenta', texto: 'Mi cuenta' };

    const avisoVentas = c.ventas_activas ? '' : `
      <div class="aviso-ventas" role="note"><div class="franja-precaucion" aria-hidden="true"></div>
        <div class="contenedor"><strong>Compras en pausa</strong><span>${esc(c.mensaje_ventas)}</span></div></div>`;

    const html = `
      <a class="saltar" href="#contenido">Saltar al contenido</a>
      ${avisoVentas}
      <header class="encabezado">
        <div class="contenedor encabezado-fila">
          <a class="marca" href="/"><img src="${esc(c.logo || '/img/logo.svg')}" alt=""><span>${esc(c.nombre_tienda)}</span></a>
          <nav class="menu-principal" id="menu-principal" aria-label="Principal">
            ${PAGINAS.map(([clave, href, texto]) => `<a href="${href}"${clave === pagina ? ' aria-current="page"' : ''}>${texto}</a>`).join('')}
            <form class="buscador-encabezado buscador-movil" action="/catalogo" role="search">
              <label class="solo-lector" for="buscar-movil">Buscar productos</label>
              <input type="search" id="buscar-movil" name="q" placeholder="Buscar productos">
              <button type="submit" aria-label="Buscar">${ICONOS.buscar}</button>
            </form>
          </nav>
          <form class="buscador-encabezado" action="/catalogo" role="search">
            <label class="solo-lector" for="buscar-encabezado">Buscar productos</label>
            <input type="search" id="buscar-encabezado" name="q" placeholder="Buscar: clavos, pintura…">
            <button type="submit" aria-label="Buscar">${ICONOS.buscar}</button>
          </form>
          <div class="acciones-encabezado">
            <a class="boton-icono" href="/carrito" data-enlace-carrito>${ICONOS.carrito}<span class="contador-carrito oculto" data-contador-carrito>0</span></a>
            <a class="boton-icono" href="${cuenta.href}" aria-label="${cuenta.texto}">${ICONOS.usuario}<span class="texto-cuenta">${cuenta.texto}</span></a>
            <button class="boton-icono boton-menu" type="button" aria-expanded="false" aria-controls="menu-principal" aria-label="Abrir menú">${ICONOS.menu}</button>
          </div>
        </div>
      </header>`;
    const contenedor = document.getElementById('encabezado');
    contenedor.innerHTML = html;

    const botonMenu = contenedor.querySelector('.boton-menu');
    const menu = contenedor.querySelector('#menu-principal');
    botonMenu.addEventListener('click', () => {
      const abierto = menu.classList.toggle('abierto');
      botonMenu.setAttribute('aria-expanded', String(abierto));
      botonMenu.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
      botonMenu.innerHTML = abierto ? ICONOS.cerrar : ICONOS.menu;
    });
    actualizarContador();
  }

  function pintarPie() {
    const c = estado.config;
    const anio = new Date().getFullYear();
    document.getElementById('pie').innerHTML = `
      <footer class="pie">
        <div class="franja-precaucion" aria-hidden="true"></div>
        <div class="contenedor pie-rejilla">
          <div>
            <h2>${esc(c.nombre_tienda)}</h2>
            <p>${esc(c.eslogan)}</p>
            <p>Teléfono: <a href="tel:${esc(c.telefono.replace(/\D/g, ''))}">${esc(c.telefono)}</a><br>
               Correo: <a href="mailto:${esc(c.correo)}">${esc(c.correo)}</a><br>
               SINPE Móvil: ${esc(c.sinpe_numero)}</p>
          </div>
          <div>
            <h2>El sitio</h2>
            <ul>${PAGINAS.map(([, href, texto]) => `<li><a href="${href}">${texto}</a></li>`).join('')}
              <li><a href="/carrito">Carrito</a></li></ul>
          </div>
          <div>
            <h2>Horario</h2>
            <p class="horario">${esc(c.horario_general)}</p>
          </div>
        </div>
        <div class="pie-final"><div class="contenedor">© ${anio} ${esc(c.nombre_tienda)}, Costa Rica. Precios en colones, IVA incluido.</div></div>
      </footer>`;
  }

  // ---------- Tarjeta de producto (se usa en inicio, catálogo y detalle) ----------
  function tarjetaProducto(p) {
    const agotado = p.disponibilidad === 'agotado';
    const sinVentas = !estado.config.ventas_activas;
    const ahorro = p.precio_oferta !== null && p.precio_oferta !== undefined
      ? Math.round((1 - p.precio_oferta / p.precio) * 100) : 0;
    const textoBoton = agotado ? 'Agotado' : sinVentas ? 'Solo catálogo' : 'Agregar al carrito';
    return `
      <article class="tarjeta-producto">
        <a class="foto" href="/producto?id=${p.id}" tabindex="-1" aria-hidden="true">
          <img src="${esc(p.imagen || '/img/sin-imagen.svg')}" alt="" loading="lazy" width="400" height="300">
          ${ahorro > 0 ? `<span class="cinta-oferta">−${ahorro} %</span>` : ''}
        </a>
        <div class="cuerpo">
          <span class="categoria">${esc(p.categoria)}</span>
          <h3><a href="/producto?id=${p.id}">${esc(p.nombre)}</a></h3>
          ${etiquetaDisp(p.disponibilidad)}
          <div class="fila-precio">
            <span class="precio">${colones(p.precio_final)}</span>
            ${ahorro > 0 ? `<span class="precio-anterior"><span class="solo-lector">Antes </span>${colones(p.precio)}</span>` : ''}
          </div>
          <button class="boton boton-chico" type="button" data-agregar="${p.id}" data-nombre="${esc(p.nombre)}"
            ${agotado || sinVentas ? 'disabled' : ''}>${textoBoton}</button>
        </div>
      </article>`;
  }

  // Un solo "escuchador" para todos los botones "Agregar al carrito"
  document.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-agregar]');
    if (!boton || boton.disabled) return;
    const id = Number(boton.dataset.agregar);
    const cantidadInput = boton.dataset.cantidadDe ? document.querySelector(boton.dataset.cantidadDe) : null;
    const cantidad = Math.max(1, Number(cantidadInput?.value) || 1);
    carrito.agregar(id, cantidad);
    aviso(`Agregado al carrito: ${boton.dataset.nombre}${cantidad > 1 ? ` (${cantidad})` : ''}`);
  });

  // ---------- Arranque de cada página ----------
  async function iniciar(pagina) {
    try {
      const [config, yo] = await Promise.all([api('/api/configuracion'), api('/api/auth/yo')]);
      estado.config = config;
      estado.usuario = yo.usuario;
    } catch (e) {
      document.body.innerHTML = `<main class="aviso-completo"><h1>No se pudo cargar el sitio</h1><p>${esc(e.message)}</p></main>`;
      throw e;
    }
    // Modo mantenimiento (el servidor solo lo avisa a quien no es personal de la ferretería)
    if (estado.config.mantenimiento && !location.pathname.startsWith('/login')) {
      const c = estado.config;
      document.title = `${c.nombre_tienda} · En mantenimiento`;
      document.body.className = 'pagina-aviso';
      document.body.innerHTML = `<main class="aviso-completo">
        <div class="franja-precaucion" aria-hidden="true"></div>
        <img src="${esc(c.logo || '/img/logo.svg')}" alt="" class="aviso-logo">
        <h1>${esc(c.nombre_tienda)} está en mantenimiento</h1>
        <p>${esc(c.mensaje_mantenimiento)}</p>
        <p class="aviso-contacto">¿Necesita algo urgente? Llámenos al ${esc(c.telefono)}.</p></main>`;
      throw new Error('Sitio en mantenimiento');
    }
    pintarEncabezado(pagina);
    pintarPie();
    if (estado.config.nombre_tienda && !document.title.includes(estado.config.nombre_tienda)) {
      document.title = document.title.replace('Ferretería Max', estado.config.nombre_tienda);
    }
    return estado;
  }

  async function cerrarSesion() {
    await api('/api/auth/logout', { metodo: 'POST' });
    location.href = '/';
  }

  return {
    estado, api, esc, colones, fecha, parametro, iniciales, aviso, mensajeEn, carrito, actualizarContador,
    tarjetaProducto, etiquetaDisp, etiquetaEstado, iniciar, cerrarSesion, DISPONIBILIDAD, ESTADOS_PAGO, ICONOS,
  };
})();
