// =============================================================
//  app.js — Arma la aplicación Express: seguridad, sesiones,
//  rutas de la API y archivos públicos. La usan:
//   • servidor.js   → en su computadora (npm start)
//   • api/index.js  → en Vercel
// =============================================================
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const config = require('./config');
const { inicializarDatos } = require('./semilla');
const { cargarUsuario, esPersonal } = require('./middleware/auth');
const { cabecerasSeguras, verificarOrigen } = require('./middleware/seguridad');
const { modoMantenimiento } = require('./middleware/mantenimiento');
const tema = require('./servicios/tema');
const archivos = require('./servicios/archivos');

const app = express();
app.disable('x-powered-by');
// En Vercel las peticiones llegan a través de su red: así se conoce la IP real y si es HTTPS
if (config.enVercel) app.set('trust proxy', 1);

// 1) La base de datos debe estar lista antes de atender (se prepara una vez)
let preparacion = null;
function listo() {
  if (!preparacion) {
    preparacion = inicializarDatos().catch((e) => {
      preparacion = null; // se reintenta en la próxima petición
      throw e;
    });
  }
  return preparacion;
}
app.use(async (req, res, next) => { await listo(); next(); });

// 2) Middleware que corre en TODAS las peticiones, en este orden
app.use(cabecerasSeguras);                                       // cabeceras de seguridad
app.use(express.json({ limit: '1mb' }));                         // lee el cuerpo JSON
app.use(express.urlencoded({ extended: false, limit: '1mb' }));  // y formularios simples
app.use(cargarUsuario);                                          // ¿hay sesión? → req.usuario
app.use(verificarOrigen);                                        // protección CSRF
app.use(modoMantenimiento);                                      // aviso de mantenimiento

// 3) Colores del sitio (se generan desde la configuración)
app.get('/tema.css', async (req, res) => {
  res.type('text/css').set('Cache-Control', 'no-cache').send(await tema.css());
});

// 4) Imágenes subidas (guardadas en la base de datos)
app.get('/archivos/:nombre', async (req, res) => {
  const archivo = await archivos.obtener(req.params.nombre);
  if (!archivo || archivo.privado) return res.status(404).json({ error: 'No encontrado.' });
  archivos.enviar(res, archivo);
});

// 5) API
app.use('/api/auth', require('./rutas/auth').router);
app.use('/api', require('./rutas/publico'));
app.use('/api', require('./rutas/cliente').router);
app.use('/api/admin', require('./rutas/admin'));
if (config.superadmin.habilitado) app.use(config.rutaSecreta, require('./rutas/superadmin')); // ruta oculta

// 6) El panel de administración solo se entrega a admin y súper admin
app.get(['/admin', '/admin/', '/admin/index.html'], (req, res) => {
  if (!esPersonal(req.usuario)) return res.redirect('/login?volver=/admin');
  res.sendFile(path.join(config.rutas.publico, 'admin', 'index.html'));
});

// 7) Archivos públicos. "extensions" permite abrir /catalogo en vez de /catalogo.html
//    (en Vercel estos archivos los entrega directamente su red)
app.use(express.static(config.rutas.publico, { extensions: ['html'], index: 'index.html' }));

// 8) Rutas que no existen
app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado.' }));
app.use((req, res) => res.status(404).sendFile(path.join(config.rutas.publico, '404.html')));

// 9) Manejo central de errores: convierte cualquier error en un mensaje claro
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let estado = err.estado || err.status || 500;
  let mensaje = err.estado ? err.message : 'Ocurrió un error inesperado. Intente de nuevo.';
  if (err instanceof multer.MulterError) {
    estado = 400;
    mensaje = err.code === 'LIMIT_FILE_SIZE' ? 'La imagen es muy pesada. Use una de máximo 3 MB.' : 'No se pudo subir el archivo.';
  } else if (err.type === 'entity.parse.failed') {
    estado = 400; mensaje = 'Los datos enviados no tienen un formato válido.';
  } else if (err.type === 'entity.too.large') {
    estado = 413; mensaje = 'Los datos enviados son demasiado grandes.';
  }
  if (estado >= 500) console.error(err);
  res.status(estado).json({ error: mensaje });
});

// Se exporta la app directamente (así también la reconoce Vercel) y la función listo()
module.exports = app;
module.exports.app = app;
module.exports.listo = listo;
