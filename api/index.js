// =============================================================
//  api/index.js — Punto de entrada en Vercel.
//  Vercel entrega directamente los archivos de /public (HTML, CSS,
//  JS, imágenes) y manda todo lo demás (la API, /tema.css, las
//  imágenes subidas y la ruta secreta) a esta función, que es la
//  misma aplicación Express que corre en su computadora.
// =============================================================
const { app } = require('../src/app');

module.exports = app;
