// =============================================================
//  servidor.js — Arranca el sitio en su computadora.  npm start
//  (En Vercel se usa api/index.js en lugar de este archivo.)
// =============================================================

// 1) Verificar la versión de Node.js (se necesita SQLite integrado)
const [mayor, menor] = process.versions.node.split('.').map(Number);
if (mayor < 22 || (mayor === 22 && menor < 13)) {
  console.error(`\n✖ Su versión de Node.js es ${process.versions.node}. Este proyecto necesita la 22.13 o más reciente.`);
  console.error('  Descargue la versión LTS en https://nodejs.org y vuelva a intentar.\n');
  process.exit(1);
}

const config = require('./src/config');
const { app, listo } = require('./src/app');
const { db, modo } = require('./src/db');

async function arrancar() {
  // 2) Crear tablas y cargar datos de ejemplo antes de abrir el puerto
  await listo();

  const servidor = app.listen(config.puerto, () => {
    const url = `http://localhost:${config.puerto}`;
    console.log('\n========================================================');
    console.log('  🔩  Ferretería Max está corriendo');
    console.log(`      Sitio público:  ${url}`);
    console.log(`      Panel admin:    ${url}/admin`);
    console.log(`      Súper admin:    ${url}${config.rutaSecreta}   (no la comparta)`);
    console.log(`      Base de datos:  ${modo === 'nube' ? 'Turso (en la nube)' : 'datos/ferreteria.db (local)'}`);
    console.log('      Para detenerlo presione Ctrl + C');
    console.log('========================================================\n');

    // Si se arrancó con INICIAR.bat (o INICIAR-Mac.command), abre el navegador solo
    if (process.env.ABRIR_NAVEGADOR === 'si') {
      const { exec } = require('node:child_process');
      const orden = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      exec(orden, () => { /* si no se pudo abrir, el usuario escribe la dirección a mano */ });
    }
  });

  // Al apagar con Ctrl + C se cierra la base de datos de forma ordenada
  function apagar() {
    console.log('\nApagando Ferretería Max…');
    servidor.close();
    db.cerrar();
    process.exit(0);
  }
  process.on('SIGINT', apagar);
  process.on('SIGTERM', apagar);

  servidor.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n✖ El puerto ${config.puerto} ya está en uso. Cierre el otro programa o cambie PUERTO en .env.\n`);
      process.exit(1);
    }
    throw e;
  });
}

arrancar().catch((e) => {
  console.error('\n✖ No se pudo arrancar:', e.message, '\n');
  process.exit(1);
});
