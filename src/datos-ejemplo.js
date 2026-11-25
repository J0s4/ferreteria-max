// =============================================================
//  datos-ejemplo.js — Los datos con los que arranca el sitio:
//  categorías, productos con precios de Costa Rica, sucursales,
//  personal, usuarios de prueba y pedidos de ejemplo.
//  También dibuja las imágenes de ejemplo de los productos.
// =============================================================

// ---------------- Categorías ----------------
// [nombre, ícono, descripción, color de fondo para la imagen]
const CATEGORIAS = [
  ['Tornillos', '🔩', 'Tornillos para madera, gypsum, metal y anclaje.', '#CFD8DC'],
  ['Espanders y tacos', '🧱', 'Anclajes plásticos y metálicos para concreto y block.', '#E0E0E0'],
  ['Clavos', '📍', 'Clavos de construcción, de concreto, de techo y de acabado.', '#D7CCC8'],
  ['Pinturas y accesorios', '🎨', 'Pinturas, esmaltes, brochas, rodillos y diluyentes.', '#FFE0B2'],
  ['Herramientas manuales', '🔨', 'Martillos, destornilladores, alicates, medición y más.', '#FFECB3'],
  ['Herramientas eléctricas', '🛠️', 'Taladros, esmeriladoras y sierras para trabajo pesado.', '#FFD180'],
  ['Madera', '🌲', 'Tablas, reglas, alfajillas y plywood.', '#DCEDC8'],
  ['Electricidad', '💡', 'Cable, tomacorrientes, breakers e iluminación.', '#FFF59D'],
  ['Plomería', '🚿', 'Tubería PVC, accesorios y griferías.', '#B3E5FC'],
  ['Construcción', '🏗️', 'Cemento, varilla, block y materiales de obra gris.', '#CFD8DC'],
  ['Adhesivos', '🧴', 'Pegamentos, silicones y epóxicos.', '#E1BEE7'],
  ['Cerrajería', '🔑', 'Candados, llavines y bisagras.', '#FFE082'],
  ['Seguridad industrial', '⛑️', 'Equipo de protección personal para la obra.', '#FFCCBC'],
  ['Jardinería', '🌱', 'Mangueras, palas, machetes y herramientas de patio.', '#C8E6C9'],
];

// ---------------- Productos ----------------
// [categoría, nombre, descripción, precio ₡, oferta ₡ | null, inventario, destacado]
const PRODUCTOS = [
  ['Tornillos', 'Tornillo gypsum punta fina 6 x 1" (bolsa 100 u.)', 'Tornillo fosfatado negro para fijar láminas de gypsum a perfiles metálicos livianos.', 1500, null, 180, 0],
  ['Tornillos', 'Tornillo para madera 8 x 1-1/2" (bolsa 50 u.)', 'Cabeza plana Phillips, rosca gruesa. Ideal para muebles y estructuras de madera.', 1800, null, 95, 0],
  ['Tornillos', 'Tornillo punta broca 10 x 3/4" (bolsa 100 u.)', 'Autoperforante para lámina de zinc y perfil metálico hasta 2 mm. Con arandela.', 2900, 2500, 60, 1],
  ['Tornillos', 'Tornillo hexagonal galvanizado 3/8 x 2"', 'Precio por unidad. Incluye tuerca y arandela. Para estructuras y anclajes.', 250, null, 12, 0],

  ['Espanders y tacos', 'Espander plástico 1/4" con tornillo (bolsa 25 u.)', 'Para fijar cuadros, repisas y accesorios livianos en concreto o block.', 1200, null, 150, 0],
  ['Espanders y tacos', 'Espander plástico 5/16" (bolsa 25 u.)', 'Taco de nylon para cargas medianas. Use broca de 5/16".', 1500, null, 70, 0],
  ['Espanders y tacos', 'Taco metálico de expansión 3/8"', 'Anclaje de acero para cargas pesadas en concreto. Precio por unidad.', 450, null, 8, 0],

  ['Clavos', 'Clavo de construcción 2-1/2" (kilo)', 'Clavo de cabeza plana, acero brillante. Para formaleta y estructuras.', 1300, null, 220, 1],
  ['Clavos', 'Clavo de acero para concreto 2" (caja 100 u.)', 'Endurecido para clavar directamente en concreto y block.', 2500, null, 40, 0],
  ['Clavos', 'Clavo de techo con arandela 2-1/2" (kilo)', 'Clavo galvanizado con arandela de hule para lámina de zinc.', 2200, null, 0, 0],
  ['Clavos', 'Clavo de acabado sin cabeza 1-1/2" (kilo)', 'Para molduras, rodapiés y trabajos de ebanistería.', 1600, null, 35, 0],

  ['Pinturas y accesorios', 'Pintura látex interior blanco mate (galón)', 'Látex acrílico lavable, rinde hasta 35 m² por galón a una mano. Secado rápido.', 16900, 14900, 48, 1],
  ['Pinturas y accesorios', 'Pintura acrílica para exteriores (galón)', 'Resistente al sol y la lluvia. Protección contra hongos. Color blanco hueso.', 22500, null, 26, 0],
  ['Pinturas y accesorios', 'Esmalte anticorrosivo negro (galón)', 'Protege rejas, portones y estructuras metálicas contra el óxido.', 18900, 16500, 15, 1],
  ['Pinturas y accesorios', 'Brocha de cerda natural 2"', 'Mango de madera. Para esmaltes, barnices y retoques.', 1450, null, 90, 0],
  ['Pinturas y accesorios', 'Rodillo de 9" con bandeja', 'Felpa de 3/8" para superficies lisas y semilisas. Incluye bandeja plástica.', 4950, 3950, 34, 0],
  ['Pinturas y accesorios', 'Diluyente / thinner (galón)', 'Para diluir esmaltes y limpiar brochas y herramientas.', 6500, null, 22, 0],
  ['Pinturas y accesorios', 'Cinta de enmascarar 3/4" x 40 m', 'Masking tape para delimitar áreas al pintar. No deja residuos.', 950, null, 120, 0],

  ['Herramientas manuales', 'Martillo de uña 16 oz', 'Cabeza de acero forjado y mango de fibra de vidrio antideslizante.', 5900, null, 30, 1],
  ['Herramientas manuales', 'Juego de destornilladores (6 piezas)', '3 planos y 3 Phillips con punta magnética y mango ergonómico.', 6500, 5500, 18, 0],
  ['Herramientas manuales', 'Cinta métrica de 5 m', 'Carcasa resistente a golpes, freno automático, en metros y pulgadas.', 3200, null, 64, 0],
  ['Herramientas manuales', 'Alicate universal 8"', 'Acero al cromo vanadio con mango aislado.', 4800, null, 27, 0],
  ['Herramientas manuales', 'Nivel de aluminio 24"', 'Tres burbujas (horizontal, vertical y 45°). Base fresada.', 7500, null, 9, 0],

  ['Herramientas eléctricas', 'Taladro percutor 1/2" 750 W', 'Velocidad variable y reversible, modo percutor para concreto. Incluye maletín.', 39900, 35900, 11, 1],
  ['Herramientas eléctricas', 'Esmeriladora angular 4-1/2" 820 W', 'Para cortar y desbastar metal y piedra. Incluye guarda y mango lateral.', 34500, null, 7, 0],
  ['Herramientas eléctricas', 'Sierra circular 7-1/4" 1400 W', 'Corte en bisel hasta 45°, disco de 24 dientes incluido.', 62000, null, 0, 0],

  ['Madera', 'Tabla de pino 1 x 12" x 4 varas', 'Pino cepillado de primera, seco. Para repisas, muebles y forros.', 9800, null, 40, 0],
  ['Madera', 'Regla de pino 1 x 2" x 4 varas', 'Para marcos, formaleta y estructuras livianas.', 1900, null, 150, 0],
  ['Madera', 'Plywood 4 x 8\' de 12 mm', 'Lámina de contrachapado para muebles, divisiones y entrepisos.', 21500, null, 16, 1],
  ['Madera', 'Alfajilla de pino 2 x 3" x 4 varas', 'Para estructuras de techo, cielos y tabiques.', 3200, null, 85, 0],

  ['Electricidad', 'Cable THHN #12 (metro)', 'Cobre, aislamiento 600 V. Para circuitos de tomacorrientes de 20 A.', 650, null, 500, 0],
  ['Electricidad', 'Tomacorriente doble 110 V', 'Polarizado con tierra, color blanco, incluye placa.', 1450, null, 75, 0],
  ['Electricidad', 'Bombillo LED 9 W luz blanca', 'Equivale a 60 W incandescente. Rosca E27, larga duración.', 1200, 950, 200, 1],
  ['Electricidad', 'Breaker de 1 polo 20 A', 'Interruptor termomagnético tipo enchufable para centro de carga.', 3900, null, 19, 0],

  ['Plomería', 'Tubo PVC 1/2" SDR 13.5 (6 m)', 'Tubería para agua potable a presión.', 3400, null, 60, 0],
  ['Plomería', 'Codo PVC 1/2" x 90°', 'Accesorio para tubería de agua potable. Precio por unidad.', 250, null, 300, 0],
  ['Plomería', 'Llave de chorro 1/2"', 'Grifería metálica para patio o pila, rosca macho.', 3500, null, 25, 0],
  ['Plomería', 'Pegamento para PVC (1/8 galón)', 'Cemento solvente de secado rápido para uniones de PVC.', 3900, null, 3, 0],

  ['Construcción', 'Cemento gris uso general (saco 50 kg)', 'Para repellos, pegado de block, contrapisos y concreto.', 6900, null, 120, 1],
  ['Construcción', 'Varilla corrugada #3 (3/8") x 6 m', 'Acero grado 40 para columnas, vigas y cimientos.', 2950, null, 200, 0],
  ['Construcción', 'Block de concreto 12 x 20 x 40 cm', 'Block estructural para paredes. Precio por unidad.', 650, null, 900, 0],

  ['Adhesivos', 'Pegamento blanco para madera (1/4 galón)', 'Cola vinílica de alta resistencia para carpintería.', 4200, null, 28, 0],
  ['Adhesivos', 'Silicón transparente 280 ml', 'Sellador multiuso para baños, ventanas y cocinas. Antihongos.', 3300, 2800, 44, 0],
  ['Adhesivos', 'Epóxico de 2 componentes (25 ml)', 'Pega metal, cerámica, vidrio y madera. Fragua en 5 minutos.', 2800, null, 14, 0],

  ['Cerrajería', 'Candado de bronce 40 mm', 'Arco de acero endurecido, incluye 3 llaves.', 4500, null, 32, 0],
  ['Cerrajería', 'Llavín de pomo para puerta de entrada', 'Acabado satinado, con llave y seguro interior.', 8900, null, 13, 0],
  ['Cerrajería', 'Bisagra de 3" (par)', 'Bisagra de acero cromado para puertas de madera.', 1300, null, 58, 0],

  ['Seguridad industrial', 'Guantes de cuero (par)', 'Guante de carnaza reforzado para trabajo pesado.', 2900, null, 47, 0],
  ['Seguridad industrial', 'Lentes de seguridad transparentes', 'Protección contra impactos y rayos UV. Antiempañantes.', 1800, null, 66, 0],
  ['Seguridad industrial', 'Casco de seguridad con rachet', 'Casco tipo I con ajuste de rachet. Color amarillo.', 4500, null, 21, 0],
  ['Seguridad industrial', 'Botas de hule (par)', 'Bota alta impermeable, suela antideslizante. Tallas 38 a 44.', 8500, null, 5, 0],

  ['Jardinería', 'Manguera reforzada 1/2" x 15 m', 'Manguera flexible con acoples metálicos.', 9500, 8500, 23, 0],
  ['Jardinería', 'Pala redonda con mango de madera', 'Hoja de acero templado, mango largo.', 7900, null, 18, 0],
  ['Jardinería', 'Machete de 22"', 'Hoja de acero al carbono con mango plástico remachado.', 4200, null, 52, 1],
  ['Jardinería', 'Rastrillo de 14 dientes', 'Cabeza metálica con mango de madera de 1,4 m.', 4900, null, 0, 0],
];

// ---------------- Sucursales ----------------
const SUCURSALES = [
  ['Sucursal San José Centro', 'Avenida 10, entre calles 3 y 5, San José centro', '2200-1000', 'central@ferreteriamax.cr',
    'Lunes a viernes: 7:00 a. m. a 5:30 p. m.\nSábados: 7:00 a. m. a 1:00 p. m.\nDomingos: cerrado', 9.9281, -84.0779],
  ['Sucursal Heredia', 'Del Mercado Municipal de Heredia, 200 m al norte', '2260-2000', 'heredia@ferreteriamax.cr',
    'Lunes a viernes: 7:30 a. m. a 5:30 p. m.\nSábados: 8:00 a. m. a 12:00 m. d.\nDomingos: cerrado', 9.9995, -84.1168],
  ['Sucursal Cartago', 'Costado este de las Ruinas de Santiago Apóstol, 100 m al sur', '2550-3000', 'cartago@ferreteriamax.cr',
    'Lunes a sábado: 7:00 a. m. a 5:00 p. m.\nDomingos: 8:00 a. m. a 12:00 m. d.', 9.8629, -83.9189],
];

// ---------------- Personal ----------------
// [nombre, puesto, índice de sucursal, descripción]
const PERSONAL = [
  ['Marco Vinicio Solano Rojas', 'Gerente general', 0, 'Más de 20 años en el negocio ferretero. Atiende a constructores y empresas.'],
  ['Andrea Mora Quesada', 'Encargada de caja y pagos SINPE', 0, 'Verifica los pagos de los pedidos en línea.'],
  ['Luis Diego Jiménez Vargas', 'Asesor de herramientas eléctricas', 0, 'Le ayuda a elegir la herramienta correcta para cada trabajo.'],
  ['Karla Fernández Chaves', 'Asesora en pinturas y acabados', 0, 'Igualación de colores y recomendaciones de acabados.'],
  ['José Pablo Araya Brenes', 'Jefe de bodega', 1, 'Coordina el inventario y el despacho de pedidos.'],
  ['Daniela Castro Ulate', 'Vendedora', 1, 'Atención en mostrador, cotizaciones y pedidos especiales.'],
  ['Rándall Céspedes Arias', 'Encargado de sucursal', 2, 'Responsable de la operación diaria en Cartago.'],
  ['María José Calderón Pérez', 'Asesora en plomería y electricidad', 2, 'Le orienta con materiales para instalaciones en casa.'],
  ['Esteban Navarro Solís', 'Despacho y carga', 2, 'Prepara y entrega los pedidos para retiro en sucursal.'],
];

// ---------------- Usuarios de prueba ----------------
const USUARIOS = [
  ['Laura Méndez Villalobos', 'admin@ferreteriamax.cr', '8811-2233', 'Admin2026!', 'admin'],
  ['Carlos Ramírez Mora', 'cliente@ferreteriamax.cr', '8701-4455', 'Cliente2026!', 'cliente'],
  ['Sofía Vargas Rojas', 'sofia@correo.cr', '6123-7788', 'Cliente2026!', 'cliente'],
];

// ---------------- Imágenes de ejemplo ----------------
const escXML = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function partirTexto(texto, maxCaracteres) {
  const palabras = texto.split(' ');
  const lineas = [''];
  for (const p of palabras) {
    const actual = lineas[lineas.length - 1];
    if ((actual + ' ' + p).trim().length > maxCaracteres && actual) lineas.push(p);
    else lineas[lineas.length - 1] = (actual + ' ' + p).trim();
  }
  return lineas.slice(0, 3);
}

/** Dibuja una imagen sencilla: tablero perforado + ícono + etiqueta con el nombre */
function svgProducto(nombre, icono, color) {
  const nombreCorto = nombre.replace(/\s*\(.*\)\s*$/, '');
  const lineas = partirTexto(nombreCorto, 30);
  const altoEtiqueta = 46 + lineas.length * 40;
  const yEtiqueta = 600 - altoEtiqueta - 36;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <pattern id="perforado" width="36" height="36" patternUnits="userSpaceOnUse">
      <circle cx="18" cy="18" r="4.5" fill="#000" fill-opacity="0.13"/>
    </pattern>
  </defs>
  <rect width="800" height="600" fill="${color}"/>
  <rect width="800" height="600" fill="url(#perforado)"/>
  <text x="400" y="${yEtiqueta / 2 + 20}" font-size="190" text-anchor="middle" dominant-baseline="middle"
        font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">${icono}</text>
  <rect x="48" y="${yEtiqueta}" width="704" height="${altoEtiqueta}" rx="10" fill="#2A2E33"/>
  <rect x="48" y="${yEtiqueta}" width="14" height="${altoEtiqueta}" rx="4" fill="#F28C00"/>
  ${lineas.map((l, i) => `<text x="88" y="${yEtiqueta + 56 + i * 40}" font-size="34" font-weight="700" fill="#FFFFFF"
        font-family="Barlow Condensed, Arial Narrow, Arial, sans-serif">${escXML(l)}</text>`).join('\n  ')}
</svg>`;
}

function slug(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

// ---------------- Pedidos de ejemplo ----------------
// usuario = índice en USUARIOS; dias = hace cuántos días; items = [nombre del producto, cantidad]
const PEDIDOS = [
  { usuario: 1, dias: 8, estado: 'hecho', comp: '20261115000123456',
    items: [['Cemento gris uso general (saco 50 kg)', 5], ['Varilla corrugada #3 (3/8") x 6 m', 10]] },
  { usuario: 2, dias: 3, estado: 'hecho', comp: '20261121000987654',
    items: [['Pintura látex interior blanco mate (galón)', 2], ['Rodillo de 9" con bandeja', 1], ['Brocha de cerda natural 2"', 2]] },
  { usuario: 1, dias: 0, estado: 'hecho', comp: '20261124000555111',
    items: [['Taladro percutor 1/2" 750 W', 1], ['Espander plástico 1/4" con tornillo (bolsa 25 u.)', 2]] },
  { usuario: 2, dias: 2, estado: 'no_hecho', comp: '12345', nota: 'No encontramos esa transferencia. Revise el número de comprobante.',
    items: [['Manguera reforzada 1/2" x 15 m', 1]] },
  { usuario: 2, dias: 0, estado: 'por_hacer', comp: '20261124000777222',
    items: [['Machete de 22"', 1], ['Guantes de cuero (par)', 2]] },
  { usuario: 1, dias: 0, estado: 'por_hacer', comp: '',
    items: [['Bombillo LED 9 W luz blanca', 6], ['Tomacorriente doble 110 V', 3]] },
];

/** Dirección de la imagen de ejemplo de un producto */
const imagenProducto = (nombre) => `/img/productos/${slug(nombre)}.svg`;

module.exports = { CATEGORIAS, PRODUCTOS, SUCURSALES, PERSONAL, USUARIOS, PEDIDOS, svgProducto, slug, imagenProducto };
