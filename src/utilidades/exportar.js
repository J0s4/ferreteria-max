// =============================================================
//  exportar.js — Genera archivos CSV y Excel (.xlsx) sin librerías.
//  Un .xlsx es en realidad un archivo ZIP con varios XML adentro;
//  aquí armamos ese ZIP a mano usando zlib, que viene con Node.
// =============================================================
const zlib = require('node:zlib');

// ---------------------------- CSV ----------------------------
function aCSV(columnas, filas) {
  const celda = (v) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    // Evita "inyección de fórmulas" al abrir en Excel
    if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lineas = [columnas.map((c) => celda(c.titulo)).join(',')];
  for (const fila of filas) lineas.push(columnas.map((c) => celda(fila[c.campo])).join(','));
  // ﻿ (BOM) hace que Excel reconozca tildes y ñ
  return Buffer.from('﻿' + lineas.join('\r\n'), 'utf8');
}

// ---------------------------- XLSX ---------------------------
const escXML = (s) =>
  String(s)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function letraColumna(indice) {
  let s = '';
  let n = indice + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function hojaXML(columnas, filas) {
  const celda = (ref, valor, estilo) => {
    if (valor === null || valor === undefined || valor === '') return '';
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''}><v>${valor}</v></c>`;
    }
    return `<c r="${ref}" t="inlineStr"${estilo ? ` s="${estilo}"` : ''}><is><t xml:space="preserve">${escXML(valor)}</t></is></c>`;
  };
  const anchos = columnas.map((c, i) => {
    const largo = Math.max(String(c.titulo).length, ...filas.slice(0, 200).map((f) => String(f[c.campo] ?? '').length));
    return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(Math.max(largo + 2, 8), 60)}" customWidth="1"/>`;
  });
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${anchos.join('')}</cols><sheetData>`;
  xml += '<row r="1">' + columnas.map((c, i) => celda(letraColumna(i) + '1', c.titulo, 1)).join('') + '</row>';
  filas.forEach((fila, f) => {
    const r = f + 2;
    xml += `<row r="${r}">` + columnas.map((c, i) => celda(letraColumna(i) + r, fila[c.campo])).join('') + '</row>';
  });
  return xml + '</sheetData></worksheet>';
}

function archivosXLSX(columnas, filas, nombreHoja) {
  const hoja = escXML(String(nombreHoja || 'Datos').replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Datos');
  return {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${hoja}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>',
    'xl/styles.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF2A2E33"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>',
    'xl/worksheets/sheet1.xml': hojaXML(columnas, filas),
  };
}

/** Arma un archivo ZIP (formato estándar) a partir de { nombre: contenido } */
function crearZIP(archivos) {
  const ahora = new Date();
  const horaDOS = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | Math.floor(ahora.getSeconds() / 2);
  const fechaDOS = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;

  for (const [nombre, contenido] of Object.entries(archivos)) {
    const datos = Buffer.from(contenido, 'utf8');
    const comprimido = zlib.deflateRawSync(datos);
    const crc = zlib.crc32(datos);
    const nombreBuf = Buffer.from(nombre, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8);      // método: deflate
    local.writeUInt16LE(horaDOS, 10);
    local.writeUInt16LE(fechaDOS, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombreBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombreBuf, comprimido);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(horaDOS, 12);
    central.writeUInt16LE(fechaDOS, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(nombreBuf.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(central, nombreBuf);

    desplazamiento += local.length + nombreBuf.length + comprimido.length;
  }

  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(Object.keys(archivos).length, 8);
  fin.writeUInt16LE(Object.keys(archivos).length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, directorio, fin]);
}

function aXLSX(columnas, filas, nombreHoja) {
  return crearZIP(archivosXLSX(columnas, filas, nombreHoja));
}

module.exports = { aCSV, aXLSX };
