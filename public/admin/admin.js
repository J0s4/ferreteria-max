// =============================================================
//  admin.js — Panel de administración (admin y súper admin).
//  Cada sección se "registra" con un título y una función que
//  la dibuja. El súper admin carga además un archivo secreto que
//  registra sus secciones extra (ver privado/super-panel.js).
//  OJO: ocultar botones aquí es solo comodidad; los permisos
//  reales se revisan en el servidor en cada petición.
// =============================================================
'use strict';

const PanelAdmin = (() => {
  const { esc, colones, fecha, aviso, etiquetaEstado, etiquetaDisp } = FM;
  const secciones = new Map();
  const estado = { usuario: null, sitio: null };
  const $ = (sel, raiz = document) => raiz.querySelector(sel);

  // ---------- API con manejo de sesión vencida ----------
  async function api(url, opciones) {
    try {
      return await FM.api(url, opciones);
    } catch (e) {
      if (e.estado === 401) location.href = '/login?volver=/admin';
      throw e;
    }
  }

  // ---------- Registro de secciones y menú ----------
  function registrar(seccion) {
    secciones.set(seccion.id, { grupo: 'Tienda', ...seccion });
    pintarMenu();
  }

  const seccionActual = () => {
    const id = location.hash.slice(1).split('?')[0];
    return secciones.has(id) ? id : 'resumen';
  };
  const parametrosHash = () => new URLSearchParams(location.hash.split('?')[1] || '');

  function globo(id) {
    const s = estado.sitio;
    if (!s) return '';
    const n = id === 'pedidos' ? s.pendientes : id === 'mensajes' ? s.mensajes_sin_leer : 0;
    return n ? `<span class="globo" aria-label="${n} pendientes">${n}</span>` : '';
  }

  function pintarMenu() {
    const menu = $('#menu-admin');
    if (!menu) return;
    const grupos = {};
    for (const s of secciones.values()) (grupos[s.grupo] ||= []).push(s);
    const actual = seccionActual();
    menu.innerHTML = Object.entries(grupos).map(([grupo, lista]) => `<h2>${esc(grupo)}</h2>` + lista.map((s) =>
      `<a href="#${s.id}"${s.id === actual ? ' aria-current="page"' : ''}><span class="icono" aria-hidden="true">${s.icono}</span>${esc(s.titulo)}${globo(s.id)}</a>`
    ).join('')).join('');
  }

  async function actualizarEstadoSitio() {
    estado.sitio = await api('/api/admin/estado');
    const avisos = [];
    const enlace = estado.usuario.rol === 'superadmin' ? '#estado-sitio' : '#resumen';
    if (estado.sitio.mantenimiento) avisos.push(`<a href="${enlace}"><div class="franja-precaucion"></div><div class="contenido"><strong>Modo mantenimiento activo.</strong>Los visitantes no pueden ver el sitio.</div></a>`);
    if (!estado.sitio.ventas_activas) avisos.push(`<a href="${enlace}"><div class="franja-precaucion"></div><div class="contenido"><strong>Ventas desactivadas.</strong>El sitio funciona solo como catálogo.</div></a>`);
    $('#estado-sitio').innerHTML = avisos.join('');
    $('#nombre-tienda-admin').textContent = estado.sitio.nombre_tienda;
    if (estado.sitio.logo) $('#logo-admin').src = estado.sitio.logo;
    pintarMenu();
  }

  async function mostrar() {
    const id = seccionActual();
    const seccion = secciones.get(id);
    pintarMenu();
    cerrarMenuMovil();
    const contenedor = $('#contenido-admin');
    // Zona nueva en cada visita: así no se acumulan eventos viejos
    const zona = document.createElement('div');
    zona.innerHTML = '<p class="cargando">Cargando…</p>';
    contenedor.replaceChildren(zona);
    document.title = `${seccion.titulo} | Panel de administración`;
    try {
      await seccion.render(zona, parametrosHash());
    } catch (e) {
      zona.innerHTML = `<div class="mensaje-formulario error">${esc(e.message)}</div>`;
    }
  }

  function recargar() { actualizarEstadoSitio().catch(() => {}); return mostrar(); }

  // ---------- Encabezado de sección ----------
  const cabecera = (titulo, descripcion = '', acciones = '') => `
    <div class="cabecera-admin">
      <div><h1>${esc(titulo)}</h1>${descripcion ? `<p>${descripcion}</p>` : ''}</div>
      ${acciones ? `<div class="botones-fila">${acciones}</div>` : ''}
    </div>`;

  // ---------- Ventana modal ----------
  function modal({ titulo, cuerpo, pie = '', ancho = false }) {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `
      <div class="modal${ancho ? ' ancho' : ''}" role="dialog" aria-modal="true" aria-labelledby="titulo-modal">
        <div class="modal-cabecera"><h2 id="titulo-modal">${esc(titulo)}</h2>
          <button class="modal-cerrar" type="button" aria-label="Cerrar">×</button></div>
        <div class="modal-cuerpo">${cuerpo}</div>
        ${pie ? `<div class="modal-pie">${pie}</div>` : ''}
      </div>`;
    const previo = document.activeElement;
    document.body.appendChild(fondo);
    document.body.style.overflow = 'hidden';
    const alTeclado = (e) => { if (e.key === 'Escape') cerrar(); };
    function cerrar() {
      fondo.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', alTeclado);
      previo?.focus?.();
    }
    document.addEventListener('keydown', alTeclado);
    $('.modal-cerrar', fondo).addEventListener('click', cerrar);
    fondo.addEventListener('mousedown', (e) => { if (e.target === fondo) cerrar(); });
    fondo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
    setTimeout(() => ($('input:not([type=hidden]), select, textarea', fondo) || $('.modal-cerrar', fondo)).focus(), 30);
    return { elemento: $('.modal', fondo), cerrar };
  }

  function confirmar(mensaje, { titulo = 'Confirmar', textoBoton = 'Sí, continuar', peligro = false } = {}) {
    return new Promise((resolver) => {
      let respuesta = false;
      const m = modal({
        titulo,
        cuerpo: `<p style="margin:0">${mensaje}</p>`,
        pie: `<button class="boton boton-borde" type="button" data-cerrar>Cancelar</button>
              <button class="boton ${peligro ? 'boton-peligro' : ''}" type="button" data-si>${esc(textoBoton)}</button>`,
      });
      const observador = new MutationObserver(() => {
        if (!document.body.contains(m.elemento)) { observador.disconnect(); resolver(respuesta); }
      });
      observador.observe(document.body, { childList: true });
      $('[data-si]', m.elemento).addEventListener('click', () => { respuesta = true; m.cerrar(); });
    });
  }

  // ---------- Formularios genéricos ----------
  const TIPOS = { texto: 'text', numero: 'number', correo: 'email', tel: 'tel', contrasena: 'password', fecha: 'date' };

  function campoHTML(c, valor) {
    const id = `campo-${c.nombre}`;
    const req = c.requerido ? ' required' : '';
    const ayuda = c.ayuda ? `<span class="ayuda">${esc(c.ayuda)}</span>` : '';
    const v = valor ?? c.valor ?? '';
    let control;
    switch (c.tipo) {
      case 'area':
        control = `<textarea id="${id}" name="${c.nombre}"${req} maxlength="${c.max || 2000}" ${c.alto ? `style="min-height:${c.alto}px"` : ''}>${esc(v)}</textarea>`;
        break;
      case 'select':
        control = `<select id="${id}" name="${c.nombre}"${req}>${c.opciones.map(([val, txt]) =>
          `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(txt)}</option>`).join('')}</select>`;
        break;
      case 'casilla':
        return `<div class="campo"><label class="casilla"><input type="checkbox" name="${c.nombre}" id="${id}"${v ? ' checked' : ''}> ${esc(c.etiqueta)}</label>${ayuda}</div>`;
      case 'archivo':
        control = `<input type="file" id="${id}" name="${c.nombre}" accept="${c.accept || 'image/jpeg,image/png,image/webp,image/gif'}">
          ${c.vistaPrevia ? `<img class="vista-previa" src="${esc(c.vistaPrevia)}" alt="Imagen actual">` : ''}`;
        break;
      case 'color':
        control = `<input type="color" id="${id}" name="${c.nombre}" value="${esc(v || '#000000')}">`;
        break;
      default:
        control = `<input type="${TIPOS[c.tipo] || 'text'}" id="${id}" name="${c.nombre}" value="${esc(v)}"${req}
          ${c.min !== undefined ? ` min="${c.min}"` : ''}${c.max !== undefined && c.tipo === 'numero' ? ` max="${c.max}"` : ''}
          ${c.max && c.tipo !== 'numero' ? ` maxlength="${c.max}"` : ''}${c.paso ? ` step="${c.paso}"` : ''}
          ${c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : ''}${c.lista ? ` list="${id}-lista"` : ''}
          ${c.tipo === 'numero' ? ' inputmode="numeric"' : ''} autocomplete="${c.autocompletar || 'off'}">
          ${c.lista ? `<datalist id="${id}-lista">${c.lista.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}`;
    }
    return `<div class="campo"><label for="${id}">${esc(c.etiqueta)}${c.requerido ? '' : c.opcional === false ? '' : ' <span class="texto-suave">(opcional)</span>'}</label>${control}${ayuda}</div>`;
  }

  /**
   * Abre un formulario en una ventana modal.
   * campos: lista de campos; un arreglo dentro de la lista = campos en la misma fila.
   * enviar(datos): función async; si lanza error se muestra en el formulario.
   */
  function formulario({ titulo, campos, valores = {}, textoEnviar = 'Guardar', multipart = false, ancho = false, antes = '', enviar }) {
    const idForm = `form-${Math.random().toString(36).slice(2, 8)}`;
    const pintar = (c) => Array.isArray(c)
      ? `<div class="fila-campos">${c.map((x) => campoHTML(x, valores[x.nombre])).join('')}</div>`
      : campoHTML(c, valores[c.nombre]);
    const m = modal({
      titulo, ancho,
      cuerpo: `<form id="${idForm}" novalidate>${antes}<div class="mensaje-formulario error oculto" role="alert"></div>${campos.map(pintar).join('')}</form>`,
      pie: `<button class="boton boton-borde" type="button" data-cerrar>Cancelar</button>
            <button class="boton" type="submit" form="${idForm}">${esc(textoEnviar)}</button>`,
    });
    const form = $(`#${idForm}`, m.elemento);
    const caja = $('.mensaje-formulario', form);
    const planos = campos.flat();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Validación básica en el navegador (el servidor valida de nuevo)
      for (const c of planos) {
        const el = form.elements[c.nombre];
        if (c.requerido && el && c.tipo !== 'casilla' && c.tipo !== 'archivo' && !String(el.value).trim()) {
          FM.mensajeEn(caja, `Complete el campo "${c.etiqueta}".`);
          el.focus();
          return;
        }
      }
      let datos;
      if (multipart) {
        datos = new FormData(form);
        for (const c of planos) if (c.tipo === 'casilla') datos.set(c.nombre, form.elements[c.nombre].checked ? '1' : '0');
        for (const c of planos) if (c.tipo === 'archivo' && !form.elements[c.nombre].files.length) datos.delete(c.nombre);
      } else {
        datos = {};
        for (const c of planos) {
          const el = form.elements[c.nombre];
          if (!el) continue;
          datos[c.nombre] = c.tipo === 'casilla' ? el.checked : el.value;
        }
      }
      const boton = $(`button[form="${idForm}"]`, m.elemento);
      boton.disabled = true;
      try {
        const r = await enviar(datos);
        m.cerrar();
        if (r?.mensaje) aviso(r.mensaje);
      } catch (err) {
        FM.mensajeEn(caja, err.message);
        boton.disabled = false;
      }
    });
    return m;
  }

  /** Devuelve el HTML de varios campos (para formularios que no van en ventana modal) */
  const camposHTML = (campos, valores = {}) => campos.map((c) => Array.isArray(c)
    ? `<div class="fila-campos">${c.map((x) => campoHTML(x, valores[x.nombre])).join('')}</div>`
    : campoHTML(c, valores[c.nombre])).join('');

  // ---------- Tablas ----------
  function tabla(columnas, filas, vacio = 'No hay datos para mostrar.') {
    if (!filas.length) return `<div class="caja"><p class="vacio-chico">${vacio}</p></div>`;
    return `<div class="marco-tabla"><table class="tabla-admin">
      <thead><tr>${columnas.map((c) => `<th class="${c.clase || ''}" scope="col">${c.titulo}</th>`).join('')}</tr></thead>
      <tbody>${filas.map((f) => `<tr>${columnas.map((c) => `<td class="${c.clase || ''}">${c.html(f)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }

  /** Descarga un archivo con la sesión actual (para exportaciones) */
  const descargar = (url) => { location.href = url; };

  // =============================================================
  //  DETALLE DE PEDIDO (se abre desde varias secciones)
  // =============================================================
  async function abrirPedido(id) {
    const p = await api(`/api/pedidos/${id}`);
    const dato = (etiqueta, valor) => `<div><span>${etiqueta}</span><strong>${valor || '—'}</strong></div>`;
    const m = modal({
      titulo: `Pedido ${p.codigo}`,
      ancho: true,
      cuerpo: `
        <div class="datos-pedido">
          ${dato('Estado del pago', etiquetaEstado(p.estado_pago))}
          ${dato('Total', `<span class="precio" style="font-size:1.6rem">${colones(p.total)}</span>`)}
          ${dato('Cliente', esc(p.cliente_nombre))}
          ${dato('Teléfono', esc(p.cliente_telefono))}
          ${dato('Correo', esc(p.cliente_correo))}
          ${dato('Retira en', esc(p.sucursal_retiro))}
          ${dato('Pedido hecho', esc(fecha(p.creado_en)))}
          ${dato('Comprobante SINPE', p.comprobante_numero ? esc(p.comprobante_numero) : '<span style="color:var(--error)">Aún no lo envía</span>')}
          ${dato('Comprobante enviado', esc(fecha(p.comprobante_enviado_en)))}
          ${dato('Pago confirmado', esc(fecha(p.confirmado_en)))}
        </div>
        ${p.comprobante_imagen ? `<p><a class="boton boton-borde boton-chico" href="${esc(p.comprobante_imagen)}" target="_blank" rel="noopener">Ver foto del comprobante</a></p>` : ''}
        ${p.notas ? `<p><strong>Notas del cliente:</strong> ${esc(p.notas)}</p>` : ''}
        <div class="envoltura-tabla"><table class="tabla-simple">
          <thead><tr><th>Producto</th><th class="num">Precio</th><th class="num">Cant.</th><th class="num">Subtotal</th></tr></thead>
          <tbody>${p.items.map((i) => `<tr><td>${esc(i.producto_nombre)}${i.producto_id ? '' : ' <span class="etiqueta-gris">eliminado</span>'}</td>
            <td class="num">${colones(i.precio_unitario)}</td><td class="num">${i.cantidad}</td><td class="num">${colones(i.subtotal)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">Total</td><td class="num">${colones(p.total)}</td></tr></tfoot>
        </table></div>
        <div class="acciones-estado">
          <strong>Verificación del pago SINPE</strong>
          <span class="texto-suave">Revise en la cuenta del banco que entró ${colones(p.total)} con el detalle ${esc(p.codigo)}. Al marcarlo "Hecho" se descuenta el inventario.</span>
          <div class="mensaje-formulario error oculto" role="alert"></div>
          <div class="campo" style="margin:0"><label for="nota-admin">Nota para el cliente (opcional)</label>
            <input type="text" id="nota-admin" maxlength="300" value="${esc(p.nota_admin)}" placeholder="Ej.: No encontramos la transferencia"></div>
          <div class="botones-fila">
            <button class="boton boton-verde" type="button" data-estado="hecho" ${p.estado_pago === 'hecho' ? 'disabled' : ''}>Marcar Hecho</button>
            <button class="boton boton-peligro" type="button" data-estado="no_hecho" ${p.estado_pago === 'no_hecho' ? 'disabled' : ''}>Marcar No hecho</button>
            <button class="boton boton-borde" type="button" data-estado="por_hacer" ${p.estado_pago === 'por_hacer' ? 'disabled' : ''}>Volver a Por hacer</button>
          </div>
        </div>`,
    });
    m.elemento.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-estado]');
      if (!b) return;
      const nuevo = b.dataset.estado;
      if (p.estado_pago === 'hecho' && nuevo !== 'hecho') {
        const ok = await confirmar(`Las unidades de este pedido se devolverán al inventario. ¿Continuar?`, { titulo: 'Revertir pago confirmado' });
        if (!ok) return;
      }
      b.disabled = true;
      try {
        const r = await api(`/api/admin/pedidos/${p.id}/estado`, { metodo: 'PUT', datos: { estado: nuevo, nota: $('#nota-admin', m.elemento).value } });
        m.cerrar();
        aviso(r.mensaje);
        recargar();
      } catch (err) {
        FM.mensajeEn($('.acciones-estado .mensaje-formulario', m.elemento), err.message);
        b.disabled = false;
      }
    });
  }

  // =============================================================
  //  MOVIMIENTO DE INVENTARIO (entrada, salida o ajuste)
  // =============================================================
  function abrirMovimiento(producto) {
    formulario({
      titulo: 'Actualizar inventario',
      antes: `<p style="margin-top:0"><strong>${esc(producto.nombre)}</strong><br>
        Cantidad actual: <span class="stock-numero">${producto.stock}</span> ${etiquetaDisp(producto.disponibilidad)}</p>`,
      campos: [
        { nombre: 'tipo', etiqueta: 'Tipo de movimiento', tipo: 'select', requerido: true, opciones: [
          ['salida', 'Salida: vendido en tienda, dañado o uso interno'],
          ['entrada', 'Entrada: llegó mercadería'],
          ['ajuste', 'Ajuste: escribir la cantidad que hay en bodega'],
        ] },
        { nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero', requerido: true, min: 0, max: 1000000,
          ayuda: 'En "Ajuste" escriba la cantidad total real; en entrada o salida, cuántas unidades entran o salen.' },
        { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'texto', max: 200,
          lista: ['Venta en tienda física', 'Compra a proveedor', 'Producto dañado', 'Uso interno', 'Conteo físico de bodega', 'Devolución de cliente'] },
      ],
      textoEnviar: 'Registrar movimiento',
      enviar: async (d) => {
        const r = await api('/api/admin/inventario/movimiento', { metodo: 'POST', datos: { ...d, producto_id: producto.id } });
        recargar();
        return r;
      },
    });
  }

  // =============================================================
  //  SECCIÓN: PANEL DE CONTROL
  // =============================================================
  registrar({
    id: 'resumen', titulo: 'Panel de control', icono: '📊',
    async render(zona) {
      const r = await api('/api/admin/resumen');
      const atencion = [...r.agotados.map((p) => ({ ...p, stock: 0 })), ...r.pocas_unidades];
      const indicador = (valor, etiqueta, detalle, clase, href) =>
        `<${href ? `a href="${href}"` : 'div'} class="indicador ${clase}"><span class="valor">${valor}</span>
          <span class="etiqueta-ind">${etiqueta}</span>${detalle ? `<small>${detalle}</small>` : ''}</${href ? 'a' : 'div'}>`;
      zona.innerHTML = `
        ${cabecera('Panel de control', `Resumen al ${esc(fecha(r.hoy + ' 18:00:00', false))}.`)}
        <div class="indicadores">
          ${indicador(r.pendientes_total, 'Pagos por verificar', 'Pedidos en "Por hacer"', r.pendientes_total ? 'atencion' : 'bien', '#pedidos?estado=por_hacer')}
          ${indicador(colones(r.ventas_dia.total), 'Ventas de hoy', `${r.ventas_dia.cantidad} pago(s) confirmado(s)`, 'bien', '#sinpe?periodo=dia')}
          ${indicador(colones(r.ventas_mes.total), 'Ventas del mes', `${r.ventas_mes.cantidad} pago(s) confirmado(s)`, 'bien', '#sinpe?periodo=mes')}
          ${indicador(r.pocas_unidades.length, 'Con pocas unidades', 'Menos de 20 en inventario', r.pocas_unidades.length ? 'atencion' : 'bien', '#inventario?filtro=pocas')}
          ${indicador(r.agotados.length, 'Agotados', 'Los clientes no pueden comprarlos', r.agotados.length ? 'peligro' : 'bien', '#inventario?filtro=agotado')}
          ${indicador(r.mensajes_sin_leer, 'Mensajes sin leer', `${r.pedidos_hoy} pedido(s) nuevo(s) hoy`, r.mensajes_sin_leer ? 'atencion' : '', '#mensajes')}
        </div>
        <div class="rejilla-admin">
          <section class="caja">
            <h2>Pedidos por verificar</h2>
            ${r.pendientes.length ? `<ul class="lista-simple">${r.pendientes.map((p) => `
              <li><div><strong>${esc(p.codigo)}</strong>, ${esc(p.cliente_nombre)}<br>
                <small class="texto-suave">${p.comprobante_numero ? `Comprobante ${esc(p.comprobante_numero)}` : 'Sin comprobante todavía'}. ${esc(fecha(p.creado_en))}</small></div>
                <div style="text-align:right"><strong>${colones(p.total)}</strong><br>
                <button class="boton boton-chico boton-oscuro" type="button" data-pedido="${p.id}">Revisar</button></div></li>`).join('')}</ul>
              <p style="margin:.75rem 0 0"><a class="enlace" href="#pedidos?estado=por_hacer">Ver todos los pendientes</a></p>`
              : '<p class="vacio-chico">No hay pagos pendientes de verificar.</p>'}
          </section>
          <section class="caja">
            <h2>Inventario que requiere atención</h2>
            ${atencion.length ? `<ul class="lista-simple">
              ${atencion.slice(0, 10).map((p) => `<li><div>${esc(p.nombre)}
                <small class="${p.stock ? 'texto-pocas' : 'texto-agotado'}">${p.stock ? `Quedan ${p.stock}` : 'Agotado'}</small></div>
                <button class="boton boton-chico boton-borde" type="button" data-inventario="${p.id}">Actualizar</button></li>`).join('')}
            </ul>
            <p style="margin:.75rem 0 0"><a class="enlace" href="#inventario?filtro=${r.agotados.length ? 'agotado' : 'pocas'}">Ver ${atencion.length > 10 ? `los ${atencion.length} productos` : 'todo el inventario'}</a></p>`
              : '<p class="vacio-chico">Todo el inventario está en buen nivel.</p>'}
          </section>
        </div>`;
      zona.addEventListener('click', async (e) => {
        const ped = e.target.closest('[data-pedido]');
        if (ped) abrirPedido(Number(ped.dataset.pedido)).catch((err) => aviso(err.message, 'error'));
        const inv = e.target.closest('[data-inventario]');
        if (inv) {
          const productos = await api('/api/admin/productos');
          abrirMovimiento(productos.find((p) => p.id === Number(inv.dataset.inventario)));
        }
      });
    },
  });

  // =============================================================
  //  SECCIÓN: PEDIDOS
  // =============================================================
  registrar({
    id: 'pedidos', titulo: 'Pedidos', icono: '🧾',
    async render(zona, parametros) {
      let filtro = parametros.get('estado') || '';
      let texto = '';
      zona.innerHTML = `
        ${cabecera('Pedidos', 'Verifique los pagos SINPE y cambie el estado de cada pedido.')}
        <div class="herramientas">
          <div class="segmentos" role="group" aria-label="Filtrar por estado">
            ${[['', 'Todos'], ['por_hacer', 'Por hacer'], ['hecho', 'Hecho'], ['no_hecho', 'No hecho']].map(([v, t]) =>
              `<button type="button" data-filtro="${v}" aria-pressed="${filtro === v}">${t}</button>`).join('')}
          </div>
          <input type="search" id="buscar-pedido" placeholder="Buscar por código, cliente o comprobante" aria-label="Buscar pedidos">
        </div>
        <div id="tabla-pedidos"><p class="cargando">Cargando…</p></div>`;

      async function cargar() {
        const p = new URLSearchParams();
        if (filtro) p.set('estado', filtro);
        if (texto) p.set('q', texto);
        const pedidos = await api(`/api/admin/pedidos?${p}`);
        $('#tabla-pedidos', zona).innerHTML = tabla([
          { titulo: 'Pedido', html: (f) => `<strong>${esc(f.codigo)}</strong>` },
          { titulo: 'Fecha', html: (f) => esc(fecha(f.creado_en)) },
          { titulo: 'Cliente', html: (f) => `${esc(f.cliente_nombre)}<br><small class="texto-suave">${esc(f.cliente_telefono || f.cliente_correo)}</small>` },
          { titulo: 'Retiro', html: (f) => esc(f.sucursal_retiro_nombre) },
          { titulo: 'Comprobante', html: (f) => f.comprobante_numero ? `${esc(f.comprobante_numero)}${f.tiene_foto ? ' <span class="etiqueta-gris">foto</span>' : ''}` : '<span class="texto-suave">Sin enviar</span>' },
          { titulo: 'Total', clase: 'num', html: (f) => colones(f.total) },
          { titulo: 'Estado', html: (f) => etiquetaEstado(f.estado_pago) },
          { titulo: '<span class="solo-lector">Acciones</span>', clase: 'acciones', html: (f) => `<button class="boton boton-chico boton-oscuro" type="button" data-pedido="${f.id}">Ver y verificar</button>` },
        ], pedidos, 'No hay pedidos con ese filtro.');
      }

      zona.addEventListener('click', (e) => {
        const f = e.target.closest('[data-filtro]');
        if (f) {
          filtro = f.dataset.filtro;
          zona.querySelectorAll('[data-filtro]').forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
          history.replaceState(null, '', filtro ? `#pedidos?estado=${filtro}` : '#pedidos');
          cargar();
        }
        const ped = e.target.closest('[data-pedido]');
        if (ped) abrirPedido(Number(ped.dataset.pedido)).catch((err) => aviso(err.message, 'error'));
      });
      let espera;
      $('#buscar-pedido', zona).addEventListener('input', (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { texto = e.target.value.trim(); cargar(); }, 300);
      });
      await cargar();
    },
  });

  // =============================================================
  //  SECCIÓN: PRODUCTOS
  // =============================================================
  registrar({
    id: 'productos', titulo: 'Productos', icono: '🔩',
    async render(zona) {
      const [productos, categorias] = await Promise.all([api('/api/admin/productos'), api('/api/admin/categorias')]);
      zona.innerHTML = `
        ${cabecera('Productos', `${productos.length} productos en el catálogo.`, '<button class="boton" type="button" data-nuevo>Agregar producto</button>')}
        <div class="herramientas">
          <input type="search" id="buscar-producto" placeholder="Buscar producto" aria-label="Buscar producto">
          <select id="filtro-categoria" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option>
            ${categorias.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select>
        </div>
        <div id="tabla-productos"></div>`;

      function pintar() {
        const q = $('#buscar-producto', zona).value.trim().toLowerCase();
        const cat = $('#filtro-categoria', zona).value;
        const filas = productos.filter((p) => (!q || p.nombre.toLowerCase().includes(q)) && (!cat || String(p.categoria_id) === cat));
        $('#tabla-productos', zona).innerHTML = tabla([
          { titulo: '<span class="solo-lector">Imagen</span>', html: (p) => `<img class="miniatura" src="${esc(p.imagen || '/img/sin-imagen.svg')}" alt="">` },
          { titulo: 'Producto', html: (p) => `<strong>${esc(p.nombre)}</strong>${p.destacado ? '<span class="etiqueta-destacado">Destacado</span>' : ''}${p.activo ? '' : '<span class="etiqueta-gris">Oculto</span>'}` },
          { titulo: 'Categoría', html: (p) => esc(p.categoria) },
          { titulo: 'Precio', clase: 'num', html: (p) => p.precio_oferta !== null ? `<strong>${colones(p.precio_oferta)}</strong><br><s class="texto-suave">${colones(p.precio)}</s>` : colones(p.precio) },
          { titulo: 'Inventario', clase: 'num', html: (p) => `<span class="stock-numero">${p.stock}</span>` },
          { titulo: 'El cliente ve', html: (p) => etiquetaDisp(p.disponibilidad) },
          { titulo: '<span class="solo-lector">Acciones</span>', clase: 'acciones', html: (p) => `
            <button class="boton boton-chico boton-borde" type="button" data-editar="${p.id}">Editar</button>
            <button class="boton boton-chico boton-peligro" type="button" data-eliminar="${p.id}">Eliminar</button>` },
        ], filas, 'No hay productos que coincidan.');
      }

      function abrirFormulario(p = null) {
        formulario({
          titulo: p ? 'Editar producto' : 'Agregar producto',
          ancho: true,
          multipart: true,
          valores: p ? { ...p, precio_oferta: p.precio_oferta ?? '' } : { activo: true },
          campos: [
            { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 120 },
            [
              { nombre: 'categoria_id', etiqueta: 'Categoría', tipo: 'select', requerido: true, opciones: [['', 'Elija una categoría'], ...categorias.map((c) => [c.id, c.nombre])] },
              { nombre: 'precio', etiqueta: 'Precio normal (₡)', tipo: 'numero', requerido: true, min: 0, paso: 50 },
              { nombre: 'precio_oferta', etiqueta: 'Precio de oferta (₡)', tipo: 'numero', min: 0, paso: 50, ayuda: 'Déjelo vacío si no está en oferta.' },
            ],
            ...(p ? [] : [{ nombre: 'stock_inicial', etiqueta: 'Cantidad inicial en inventario', tipo: 'numero', min: 0, valor: 0, ayuda: 'Después se cambia en la sección Inventario.' }]),
            { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', max: 2000, alto: 100 },
            { nombre: 'imagen', etiqueta: p ? 'Cambiar imagen' : 'Imagen', tipo: 'archivo', vistaPrevia: p?.imagen, ayuda: 'JPG, PNG, WEBP o GIF de máximo 3 MB.' },
            [
              { nombre: 'destacado', etiqueta: 'Mostrar en "Lo más pedido" del inicio', tipo: 'casilla' },
              { nombre: 'activo', etiqueta: 'Visible en el catálogo', tipo: 'casilla' },
            ],
          ],
          textoEnviar: p ? 'Guardar cambios' : 'Agregar producto',
          enviar: async (datos) => {
            const r = await api(p ? `/api/admin/productos/${p.id}` : '/api/admin/productos', { metodo: p ? 'PUT' : 'POST', formulario: datos });
            recargar();
            return r;
          },
        });
      }

      zona.addEventListener('click', async (e) => {
        if (e.target.closest('[data-nuevo]')) abrirFormulario();
        const ed = e.target.closest('[data-editar]');
        if (ed) abrirFormulario(productos.find((p) => p.id === Number(ed.dataset.editar)));
        const el = e.target.closest('[data-eliminar]');
        if (el) {
          const p = productos.find((x) => x.id === Number(el.dataset.eliminar));
          const ok = await confirmar(`¿Eliminar <strong>${esc(p.nombre)}</strong> del catálogo? Los pedidos anteriores lo conservan. Si solo quiere ocultarlo, edítelo y desmarque "Visible en el catálogo".`,
            { titulo: 'Eliminar producto', textoBoton: 'Eliminar', peligro: true });
          if (!ok) return;
          try { aviso((await api(`/api/admin/productos/${p.id}`, { metodo: 'DELETE' })).mensaje); recargar(); }
          catch (err) { aviso(err.message, 'error'); }
        }
      });
      $('#buscar-producto', zona).addEventListener('input', pintar);
      $('#filtro-categoria', zona).addEventListener('change', pintar);
      pintar();
    },
  });

  // =============================================================
  //  SECCIÓN: CATEGORÍAS
  // =============================================================
  registrar({
    id: 'categorias', titulo: 'Categorías', icono: '🗂️',
    async render(zona) {
      const categorias = await api('/api/admin/categorias');
      zona.innerHTML = `
        ${cabecera('Categorías', 'Organizan el catálogo. Solo se pueden eliminar si no tienen productos.', '<button class="boton" type="button" data-nueva>Crear categoría</button>')}
        ${tabla([
          { titulo: 'Orden', clase: 'num', html: (c) => c.orden },
          { titulo: 'Categoría', html: (c) => `<span aria-hidden="true">${esc(c.icono)}</span> <strong>${esc(c.nombre)}</strong>` },
          { titulo: 'Descripción', html: (c) => `<span class="texto-suave">${esc(c.descripcion)}</span>` },
          { titulo: 'Productos', clase: 'num', html: (c) => c.total },
          { titulo: '<span class="solo-lector">Acciones</span>', clase: 'acciones', html: (c) => `
            <button class="boton boton-chico boton-borde" type="button" data-editar="${c.id}">Editar</button>
            <button class="boton boton-chico boton-peligro" type="button" data-eliminar="${c.id}" ${c.total ? 'disabled title="Tiene productos"' : ''}>Eliminar</button>` },
        ], categorias, 'Todavía no hay categorías.')}`;

      const abrir = (c = null) => formulario({
        titulo: c ? 'Editar categoría' : 'Crear categoría',
        valores: c || { icono: '🔧', orden: categorias.length + 1 },
        campos: [
          [{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 60 }, { nombre: 'icono', etiqueta: 'Ícono (emoji)', max: 8, ayuda: 'Ej.: 🔩 🔨 🎨' }],
          { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', max: 300, alto: 80 },
          { nombre: 'orden', etiqueta: 'Orden en el menú', tipo: 'numero', min: 0, max: 999 },
        ],
        enviar: async (d) => {
          const r = await api(c ? `/api/admin/categorias/${c.id}` : '/api/admin/categorias', { metodo: c ? 'PUT' : 'POST', datos: d });
          recargar();
          return r;
        },
      });

      zona.addEventListener('click', async (e) => {
        if (e.target.closest('[data-nueva]')) abrir();
        const ed = e.target.closest('[data-editar]');
        if (ed) abrir(categorias.find((c) => c.id === Number(ed.dataset.editar)));
        const el = e.target.closest('[data-eliminar]');
        if (el && !el.disabled) {
          const c = categorias.find((x) => x.id === Number(el.dataset.eliminar));
          if (!(await confirmar(`¿Eliminar la categoría <strong>${esc(c.nombre)}</strong>?`, { titulo: 'Eliminar categoría', textoBoton: 'Eliminar', peligro: true }))) return;
          try { aviso((await api(`/api/admin/categorias/${c.id}`, { metodo: 'DELETE' })).mensaje); recargar(); }
          catch (err) { aviso(err.message, 'error'); }
        }
      });
    },
  });

  // =============================================================
  //  SECCIÓN: INVENTARIO
  // =============================================================
  const NOMBRES_MOVIMIENTO = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', venta_web: 'Venta en línea', devolucion: 'Devolución' };
  registrar({
    id: 'inventario', titulo: 'Inventario', icono: '📦',
    async render(zona, parametros) {
      const [productos, movimientos] = await Promise.all([api('/api/admin/productos'), api('/api/admin/inventario/movimientos?limite=150')]);
      let filtro = parametros.get('filtro') || '';
      zona.innerHTML = `
        ${cabecera('Inventario', 'Aquí ve la cantidad exacta. El cliente solo ve "Disponible" (20 o más), "Pocas unidades" (1 a 19) o "Agotado".')}
        <div class="herramientas">
          <div class="segmentos" role="group" aria-label="Filtrar">
            ${[['', 'Todos'], ['pocas', 'Pocas unidades'], ['agotado', 'Agotados']].map(([v, t]) => `<button type="button" data-filtro="${v}" aria-pressed="${filtro === v}">${t}</button>`).join('')}
          </div>
          <input type="search" id="buscar-inv" placeholder="Buscar producto" aria-label="Buscar producto">
        </div>
        <div id="tabla-inventario"></div>
        <div class="cabecera-admin" style="margin-top:2rem"><div><h2 style="margin:0">Historial de movimientos</h2><p>Últimos 150 cambios: quién, cuándo y por qué.</p></div>
          <select id="historial-producto" aria-label="Filtrar historial por producto"><option value="">Todos los productos</option>
          ${productos.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></div>
        <div id="tabla-historial"></div>`;

      function pintarProductos() {
        const q = $('#buscar-inv', zona).value.trim().toLowerCase();
        const filas = productos.filter((p) => (!filtro || p.disponibilidad === filtro) && (!q || p.nombre.toLowerCase().includes(q)));
        $('#tabla-inventario', zona).innerHTML = tabla([
          { titulo: 'Producto', html: (p) => `<strong>${esc(p.nombre)}</strong>${p.activo ? '' : '<span class="etiqueta-gris">Oculto</span>'}` },
          { titulo: 'Categoría', html: (p) => esc(p.categoria) },
          { titulo: 'Cantidad', clase: 'num', html: (p) => `<span class="stock-numero">${p.stock}</span>` },
          { titulo: 'El cliente ve', html: (p) => etiquetaDisp(p.disponibilidad) },
          { titulo: '<span class="solo-lector">Acciones</span>', clase: 'acciones', html: (p) => `<button class="boton boton-chico boton-oscuro" type="button" data-mover="${p.id}">Actualizar cantidad</button>` },
        ], filas, 'No hay productos con ese filtro.');
      }

      function pintarHistorial(lista) {
        $('#tabla-historial', zona).innerHTML = tabla([
          { titulo: 'Fecha', html: (m) => esc(fecha(m.fecha)) },
          { titulo: 'Producto', html: (m) => esc(m.producto_nombre) },
          { titulo: 'Tipo', html: (m) => NOMBRES_MOVIMIENTO[m.tipo] || m.tipo },
          { titulo: 'Cambio', clase: 'num', html: (m) => `<span class="${m.cantidad > 0 ? 'mas' : 'menos'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad}</span>` },
          { titulo: 'Antes → después', clase: 'num', html: (m) => `${m.stock_anterior} → <strong>${m.stock_nuevo}</strong>` },
          { titulo: 'Motivo', html: (m) => esc(m.motivo) },
          { titulo: 'Usuario', html: (m) => esc(m.usuario_nombre) },
        ], lista, 'Sin movimientos registrados.');
      }

      zona.addEventListener('click', (e) => {
        const f = e.target.closest('[data-filtro]');
        if (f) {
          filtro = f.dataset.filtro;
          zona.querySelectorAll('[data-filtro]').forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
          pintarProductos();
        }
        const m = e.target.closest('[data-mover]');
        if (m) abrirMovimiento(productos.find((p) => p.id === Number(m.dataset.mover)));
      });
      $('#buscar-inv', zona).addEventListener('input', pintarProductos);
      $('#historial-producto', zona).addEventListener('change', async (e) => {
        const id = e.target.value;
        pintarHistorial(await api(`/api/admin/inventario/movimientos?limite=150${id ? `&producto_id=${id}` : ''}`));
      });
      pintarProductos();
      pintarHistorial(movimientos);
    },
  });

  // =============================================================
  //  SECCIÓN: TOTAL SINPE
  // =============================================================
  registrar({
    id: 'sinpe', titulo: 'Total SINPE', icono: '💰',
    async render(zona, parametros) {
      let periodo = ['dia', 'semana', 'mes'].includes(parametros.get('periodo')) ? parametros.get('periodo') : 'dia';
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }); // AAAA-MM-DD
      zona.innerHTML = `
        ${cabecera('Total SINPE', 'Suma automática de los pagos confirmados como "Hecho".')}
        <div class="herramientas">
          <div class="segmentos" role="group" aria-label="Período">
            ${[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(([v, t]) => `<button type="button" data-periodo="${v}" aria-pressed="${periodo === v}">${t}</button>`).join('')}
          </div>
          <label class="solo-lector" for="fecha-sinpe">Fecha de referencia</label>
          <input type="date" id="fecha-sinpe" value="${hoy}" max="${hoy}">
          <button class="boton boton-borde boton-chico" type="button" data-hoy>Hoy</button>
        </div>
        <div id="resultado-sinpe"></div>`;

      async function cargar() {
        const fechaRef = $('#fecha-sinpe', zona).value || hoy;
        const r = await api(`/api/admin/sinpe?periodo=${periodo}&fecha=${fechaRef}`);
        const hasta = new Date(r.hasta + 'T12:00:00Z');
        hasta.setUTCDate(hasta.getUTCDate() - 1);
        const fmt = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-CR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
        const rango = periodo === 'dia' ? fmt(r.desde) : `del ${fmt(r.desde)} al ${fmt(hasta.toISOString().slice(0, 10))}`;
        $('#resultado-sinpe', zona).innerHTML = `
          <div class="gran-total">
            <div><span class="monto">${colones(r.total)}</span><p>Total recibido por SINPE Móvil, ${esc(rango)}</p></div>
            <div><span class="monto" style="color:inherit;font-size:2.4rem">${r.cantidad}</span><p>pagos confirmados</p></div>
          </div>
          ${tabla([
            { titulo: 'Confirmado', html: (p) => esc(fecha(p.confirmado_en)) },
            { titulo: 'Pedido', html: (p) => `<strong>${esc(p.codigo)}</strong>` },
            { titulo: 'Cliente', html: (p) => esc(p.cliente_nombre) },
            { titulo: 'Comprobante', html: (p) => esc(p.comprobante_numero) },
            { titulo: 'Monto', clase: 'num', html: (p) => colones(p.total) },
          ], r.pagos, 'No hay pagos confirmados en este período.')}`;
      }

      zona.addEventListener('click', (e) => {
        const b = e.target.closest('[data-periodo]');
        if (b) {
          periodo = b.dataset.periodo;
          zona.querySelectorAll('[data-periodo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          cargar();
        }
        if (e.target.closest('[data-hoy]')) { $('#fecha-sinpe', zona).value = hoy; cargar(); }
      });
      $('#fecha-sinpe', zona).addEventListener('change', cargar);
      await cargar();
    },
  });

  // =============================================================
  //  SECCIÓN: MENSAJES DE CONTACTO
  // =============================================================
  registrar({
    id: 'mensajes', titulo: 'Mensajes', icono: '✉️',
    async render(zona) {
      const mensajes = await api('/api/admin/mensajes');
      zona.innerHTML = `${cabecera('Mensajes de contacto', 'Lo que escriben los clientes desde la página Contacto.')}
        ${mensajes.length ? mensajes.map((m) => `
          <article class="mensaje-contacto ${m.leido ? '' : 'no-leido'}">
            <header><div><strong>${esc(m.nombre)}</strong> ${m.leido ? '' : '<span class="etiqueta-destacado">Nuevo</span>'}<br>
              <span class="texto-suave">${esc(m.correo)}${m.telefono ? `, ${esc(m.telefono)}` : ''}</span></div>
              <span class="texto-suave">${esc(fecha(m.creado_en))}</span></header>
            ${m.asunto ? `<strong>${esc(m.asunto)}</strong>` : ''}
            <p>${esc(m.mensaje)}</p>
            <div class="botones-fila">
              <a class="boton boton-chico boton-oscuro" href="mailto:${esc(m.correo)}?subject=${encodeURIComponent('Re: ' + (m.asunto || 'Su consulta'))}">Responder por correo</a>
              <button class="boton boton-chico boton-borde" type="button" data-leido="${m.id}" data-valor="${m.leido ? 0 : 1}">${m.leido ? 'Marcar como no leído' : 'Marcar como leído'}</button>
              <button class="boton boton-chico boton-peligro" type="button" data-borrar="${m.id}">Eliminar</button>
            </div>
          </article>`).join('') : '<div class="caja"><p class="vacio-chico">No hay mensajes.</p></div>'}`;
      zona.addEventListener('click', async (e) => {
        const l = e.target.closest('[data-leido]');
        if (l) { await api(`/api/admin/mensajes/${l.dataset.leido}/leido`, { metodo: 'PUT', datos: { leido: l.dataset.valor === '1' } }); recargar(); }
        const b = e.target.closest('[data-borrar]');
        if (b && await confirmar('¿Eliminar este mensaje?', { titulo: 'Eliminar mensaje', textoBoton: 'Eliminar', peligro: true })) {
          aviso((await api(`/api/admin/mensajes/${b.dataset.borrar}`, { metodo: 'DELETE' })).mensaje);
          recargar();
        }
      });
    },
  });

  // =============================================================
  //  ARRANQUE
  // =============================================================
  function cerrarMenuMovil() {
    $('#menu-admin')?.classList.remove('abierto');
    $('#boton-menu-admin')?.setAttribute('aria-expanded', 'false');
  }

  async function iniciar() {
    const yo = await FM.api('/api/auth/yo');
    if (!yo.usuario || !['admin', 'superadmin'].includes(yo.usuario.rol)) { location.href = '/login?volver=/admin'; return; }
    estado.usuario = yo.usuario;
    $('#nombre-admin').textContent = yo.usuario.nombre;
    $('#rol-admin').textContent = yo.usuario.rol === 'superadmin' ? 'Súper admin' : 'Admin';

    // Solo el súper admin recibe la dirección de su panel extra
    if (yo.panelExtra) {
      await new Promise((ok) => {
        const s = document.createElement('script');
        s.src = yo.panelExtra;
        s.onload = ok;
        s.onerror = ok;
        document.head.appendChild(s);
      });
    }

    $('#boton-menu-admin').addEventListener('click', () => {
      const abierto = $('#menu-admin').classList.toggle('abierto');
      $('#boton-menu-admin').setAttribute('aria-expanded', String(abierto));
    });
    $('#salir').addEventListener('click', FM.cerrarSesion);
    window.addEventListener('hashchange', mostrar);
    await actualizarEstadoSitio();
    await mostrar();
  }

  document.addEventListener('DOMContentLoaded', () => iniciar().catch((e) => {
    $('#contenido-admin').innerHTML = `<div class="mensaje-formulario error">${esc(e.message)}</div>`;
  }));

  return {
    api, esc, colones, fecha, aviso, etiquetaEstado, etiquetaDisp, registrar, modal, confirmar, formulario,
    camposHTML, tabla, cabecera, recargar, descargar, estado,
  };
})();
