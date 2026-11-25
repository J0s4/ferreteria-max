// =============================================================
//  subidas.js — Recibe imágenes (productos, logo, banners, fotos
//  del personal y comprobantes SINPE) con la librería multer.
//  Quedan en memoria y luego se guardan en la base de datos
//  (ver servicios/archivos.js).
// =============================================================
const multer = require('multer');
const { ErrorUsuario } = require('../utilidades/validar');
const { EXTENSION } = require('../servicios/archivos');

// Vercel acepta peticiones de hasta 4,5 MB, por eso los límites
function crearSubida(maxMB) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMB * 1024 * 1024, files: 1 },
    fileFilter: (req, archivo, cb) => {
      // Solo imágenes comunes. SVG NO se permite porque puede llevar código.
      if (EXTENSION[archivo.mimetype]) cb(null, true);
      else cb(new ErrorUsuario('Solo se permiten imágenes JPG, PNG, WEBP o GIF.'));
    },
  });
}

const subirImagen = crearSubida(3);
const subirComprobante = crearSubida(4);

module.exports = {
  subirProducto: subirImagen,
  subirSitio: subirImagen,
  subirPersonal: subirImagen,
  subirComprobante,
};
