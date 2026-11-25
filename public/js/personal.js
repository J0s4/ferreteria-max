// Nuestro personal, agrupado por sucursal
'use strict';

(async () => {
  await FM.iniciar('personal');
  const [personal, sucursales] = await Promise.all([FM.api('/api/personal'), FM.api('/api/sucursales')]);
  let filtro = '';

  function pintar() {
    document.getElementById('chips').innerHTML =
      `<button class="chip" type="button" data-sucursal="" aria-pressed="${filtro === ''}">Todas</button>` +
      sucursales.map((s) => `<button class="chip" type="button" data-sucursal="${s.id}" aria-pressed="${filtro === String(s.id)}">${FM.esc(s.nombre)}</button>`).join('');

    const grupos = [...sucursales.map((s) => ({ id: String(s.id), nombre: s.nombre })), { id: 'ninguna', nombre: 'Oficina central' }]
      .filter((g) => !filtro || g.id === filtro)
      .map((g) => ({ ...g, personas: personal.filter((p) => (p.sucursal_id ? String(p.sucursal_id) : 'ninguna') === g.id) }))
      .filter((g) => g.personas.length);

    document.getElementById('lista-personal').innerHTML = grupos.length
      ? grupos.map((g) => `
        <section class="grupo-personal">
          <h2>${FM.esc(g.nombre)}</h2>
          <div class="rejilla-personal">
            ${g.personas.map((p) => `
              <article class="persona">
                <div class="avatar" aria-hidden="true">${p.foto ? `<img src="${FM.esc(p.foto)}" alt="">` : FM.esc(FM.iniciales(p.nombre))}</div>
                <div>
                  <h3>${FM.esc(p.nombre)}</h3>
                  <p class="puesto">${FM.esc(p.puesto)}</p>
                  ${p.descripcion ? `<p>${FM.esc(p.descripcion)}</p>` : ''}
                </div>
              </article>`).join('')}
          </div>
        </section>`).join('')
      : '<div class="vacio"><p>No hay personal registrado en esta sucursal.</p></div>';
  }

  document.getElementById('chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sucursal]');
    if (!b) return;
    filtro = b.dataset.sucursal;
    pintar();
  });
  pintar();
})();
