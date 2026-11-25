# Ferretería Max: sitio web completo

Tienda en línea de una ferretería en Costa Rica: catálogo con buscador y filtros, carrito, pedidos con pago por **SINPE Móvil** (verificación manual) y tres tipos de usuario: **cliente**, **administrador** y **súper administrador** (cuenta secreta).

- **Stack:** Node.js + Express 5 + SQLite + HTML, CSS y JavaScript sin frameworks.
- **Dos formas de correr:** en su computadora (SQLite en un archivo) o publicado en **Vercel** con la base de datos en **Turso** (SQLite en la nube). Es el mismo código.
- **Dependencias:** 4 paquetes (`express`, `bcryptjs`, `multer`, `@libsql/client`). No hay que compilar nada.
- **Idioma:** todo en español, precios en colones (₡) y horas de Costa Rica.

---

## 1. Instalar y correr (paso a paso)

### Lo que necesita
- **Node.js 22.13 o más reciente.** Descargue la versión **LTS** en <https://nodejs.org> e instálela con las opciones por defecto.
- Un navegador (Chrome, Edge o Firefox).

Para comprobar que Node quedó instalado, abra una terminal y escriba:
```bash
node -v
```
Debe mostrar `v22.13.0` o un número mayor (por ejemplo `v24.x.x`).

### Forma rápida (doble clic)
1. Instale Node.js LTS desde <https://nodejs.org>.
2. Descomprima `ferreteria-max.zip`.
3. Dentro de la carpeta, haga **doble clic en `INICIAR.bat`** (en Mac, `INICIAR-Mac.command`). La primera vez instala lo necesario; después arranca el sitio y abre el navegador solo. No cierre la ventana negra mientras use el sitio.

### Pasos a mano (lo mismo, con comandos)
1. **Descomprima** `ferreteria-max.zip` en una carpeta, por ejemplo `Documentos\ferreteria-max`.
2. **Abra una terminal dentro de esa carpeta.**
   - Windows: abra la carpeta, haga clic en la barra de direcciones, escriba `cmd` y presione Enter.
   - Mac o Linux: abra la Terminal y escriba `cd ` seguido de la ruta de la carpeta.
3. **Instale las dependencias** (solo la primera vez; necesita internet):
   ```bash
   npm install
   ```
4. **Arranque el sitio:**
   ```bash
   npm start
   ```
   La primera vez se crea el archivo `.env`, la base de datos y los datos de ejemplo. Verá algo así:
   ```
   🔩  Ferretería Max está corriendo
       Sitio público:  http://localhost:3000
       Panel admin:    http://localhost:3000/admin
       Súper admin:    http://localhost:3000/acceso-fm-8q3z
   ```
5. **Abra en el navegador:** <http://localhost:3000>
6. Para **detenerlo**, vuelva a la terminal y presione `Ctrl + C`.

> Para ver el sitio desde su celular en la misma red wifi, use la IP de su computadora (por ejemplo `http://192.168.1.50:3000`). En Windows la ve con el comando `ipconfig`.

---

## 2. Usuarios de prueba

| Rol | Dónde entra | Correo | Contraseña |
|---|---|---|---|
| Cliente | <http://localhost:3000/login> | `cliente@ferreteriamax.cr` | `Cliente2026!` |
| Cliente 2 | <http://localhost:3000/login> | `sofia@correo.cr` | `Cliente2026!` |
| Administrador | <http://localhost:3000/login> (lo lleva a `/admin`) | `admin@ferreteriamax.cr` | `Admin2026!` |
| **Súper admin** | **<http://localhost:3000/acceso-fm-8q3z>** (ruta oculta) | `creador@ferreteriamax.cr` | `Creador-Max-2026` |

- El súper admin **no puede** entrar por `/login` normal, solo por la ruta oculta.
- Sus credenciales y la ruta oculta están en el archivo **`.env`**. Cámbielas ahí y reinicie el servidor.
- Si el valor de una variable en `.env` lleva el símbolo `#`, escríbalo entre comillas (`"Mi#Clave1"`); si no, todo lo que va después del `#` se ignora.

---

## 3. Qué trae el sitio

### Sitio público
- **Inicio:** banners que rotan, categorías, ofertas y productos destacados.
- **Catálogo:** buscador (encuentra "electrica" aunque diga "Eléctrica"), filtros por categoría y precio, solo ofertas, ocultar agotados y orden.
- **Detalle de producto** con productos relacionados.
- **Nuestro personal** (9 personas por sucursal), **Sucursales** (3, con mapa, Waze y Google Maps) y **Contacto** (los mensajes llegan al panel).
- **Carrito → pedido → pago SINPE:** al confirmar, el cliente ve el número SINPE, el monto, el código del pedido (`FM-000123`) para el detalle y botones para copiar. Luego envía el número de comprobante y, si quiere, una foto.

### Inventario que ve el cliente
El cliente **nunca** ve la cantidad exacta. El servidor solo le envía:
- **Disponible:** 20 o más
- **Pocas unidades:** de 1 a 19
- **Agotado:** 0 (no se puede agregar al carrito)

### Panel del administrador (`/admin`)
- **Panel de control:** pagos por verificar, ventas del día y del mes, productos con pocas unidades y agotados.
- **Pedidos:** filtro por estado, búsqueda y ventana para verificar el pago: **Hecho / No hecho / Por hacer**, con nota para el cliente.
- **Productos** (con imagen, oferta, destacado, visible u oculto) y **Categorías**.
- **Inventario:** entradas, salidas y ajustes por conteo, con historial (quién, cuándo y por qué).
- **Total SINPE:** suma automática de pagos confirmados por día, semana o mes.
- **Mensajes** del formulario de contacto.

### Extras del súper admin (aparecen en el mismo panel)
- **Ventas y mantenimiento:** apagar las ventas (el sitio queda como catálogo, con su mensaje) o activar el modo mantenimiento.
- **Usuarios:** crear, editar, suspender, eliminar y restablecer contraseñas de clientes y administradores.
- **Información del sitio:** nombre, eslogan, logo, colores, número SINPE, teléfonos, horario y banners.
- **Sucursales** y **Personal**.
- **Reportes:** ventas por día y por mes, productos más vendidos, ventas por categoría y mejores clientes.
- **Bitácora:** registro de cada cambio, incluidos los intentos fallidos de entrar a la ruta oculta.
- **Exportar** a Excel (.xlsx) o CSV y **respaldos** de la base de datos.

---

## 4. Publicarlo en internet (GitHub + Turso + Vercel)

Vercel no guarda archivos entre visitas, así que en internet la base de datos vive en **Turso** (SQLite en la nube, plan gratis) y las imágenes subidas se guardan dentro de esa base.

1. **Código en GitHub:** suba esta carpeta a un repositorio (el archivo `.env` no se sube; ya está en `.gitignore`).
2. **Base de datos en Turso:**
   - Entre a <https://turso.tech> e inicie sesión con su cuenta de GitHub.
   - Cree una base de datos llamada `ferreteria-max`. Si le pide región, elija una de Estados Unidos (este), cerca de los servidores de Vercel.
   - Copie la **URL** de la base (empieza con `libsql://`).
   - Cree un **token** de acceso con permiso de lectura y escritura, y cópielo.
3. **Proyecto en Vercel:**
   - En <https://vercel.com/new> importe el repositorio. No cambie nada de "Build settings".
   - Antes de presionar **Deploy**, abra **Environment Variables** y agregue:

| Variable | Valor |
|---|---|
| `TURSO_DATABASE_URL` | La URL de Turso (`libsql://…`) |
| `TURSO_AUTH_TOKEN` | El token de Turso |
| `RUTA_SECRETA` | Una ruta propia para el súper admin, por ejemplo `/panel-k7m2x9q4` |
| `SUPERADMIN_CORREO` | El correo del súper admin |
| `SUPERADMIN_CONTRASENA` | Una contraseña larga y nueva |

   - Presione **Deploy**. La primera visita crea las tablas y carga los datos de ejemplo (tarda unos segundos).

**Importante:** como el repositorio puede ser público, en Vercel **nunca** se usan la ruta y la contraseña de ejemplo de `.env.ejemplo`. Si faltan `RUTA_SECRETA` o `SUPERADMIN_CONTRASENA`, el súper admin queda desactivado. Si faltan las variables de Turso, el sitio muestra un mensaje que lo indica.

Para volver la demo a los datos de ejemplo: ponga `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` en su `.env` local, ejecute `npm run reiniciar`, escriba `BORRAR` y abra el sitio otra vez.

---

## 5. Cómo funciona por dentro

```
 Navegador (HTML + CSS + JS)          Servidor Node.js (Express)                 Base de datos
 ─────────────────────────           ───────────────────────────               ─────────────
 public/*.html  ── pide páginas ──▶  express.static (archivos públicos)
 public/js/*.js ── fetch /api/... ─▶  1. cabeceras de seguridad
                                      2. lee JSON / formularios
                                      3. ¿hay cookie de sesión? → req.usuario ──▶ tabla sesiones
                                      4. bloquea peticiones de otros sitios
                                      5. ¿modo mantenimiento?
                                      6. rutas: /api/auth, /api, /api/admin,
                                         RUTA_SECRETA (súper admin)  ─────────▶ local: datos/ferreteria.db
                                      7. errores → mensaje claro en JSON          nube:  Turso (SQLite)
```

**Una sola aplicación, dos lugares.** `src/app.js` arma todo el servidor. En su computadora lo arranca `servidor.js`; en Vercel lo usa `api/index.js`. `src/db.js` decide la base: si existe `TURSO_DATABASE_URL` usa Turso por internet, si no, el archivo `datos/ferreteria.db`. El resto del código pide los datos igual en los dos casos (`await uno(...)`, `await todos(...)`, `await transaccion(...)`).

**Las imágenes subidas** (productos, logo, banners, personal y comprobantes) se guardan dentro de la base, en la tabla `archivos`, y se sirven en `/archivos/...`. Las fotos de comprobantes se marcan como privadas: solo las ven el dueño del pedido y el personal. Las imágenes de los productos de ejemplo son archivos fijos en `public/img/productos`.

**Las páginas** son HTML casi vacío. Al cargar, su JavaScript pide los datos a la API (por ejemplo `GET /api/productos`) y dibuja el contenido. `public/js/comun.js` tiene lo compartido: encabezado, pie, carrito y avisos.

**El carrito** vive en el navegador (`localStorage`) y solo guarda id y cantidad. Al confirmar, el servidor vuelve a buscar los precios y la disponibilidad en la base de datos, así nadie puede cambiar un precio desde el navegador.

**Las sesiones** funcionan así: al iniciar sesión se crea un token aleatorio que se guarda en una cookie `HttpOnly` (JavaScript no la puede leer) que dura 30 días; por eso el cliente sigue logueado aunque cierre el navegador. En la base de datos solo se guarda el *hash* del token. Si el súper admin suspende a alguien, se borran sus sesiones y queda fuera de inmediato.

**Las contraseñas** se guardan con `bcrypt` (hash con sal), nunca en texto plano.

**Los permisos** se validan en el servidor en cada petición (`src/middleware/auth.js`). Ocultar un botón en la pantalla es solo comodidad: si un cliente llama a `/api/admin/...` recibe 403. Las rutas del súper admin responden **404** a cualquier otra persona, como si no existieran. Su panel extra (`privado/super-panel.js`) está fuera de la carpeta pública y solo se entrega a su sesión. Ningún archivo público menciona la ruta oculta.

**Un pedido de punta a punta:**
1. El cliente confirma el carrito y se crea el pedido en estado **Por hacer**. El inventario todavía no se toca.
2. El cliente hace el SINPE y envía el número de comprobante (y la foto, que se guarda en una carpeta privada).
3. El administrador revisa su banco y marca **Hecho**. En ese momento, dentro de una transacción, se descuenta el inventario y se registra cada movimiento como "Venta en línea".
4. Si luego lo cambia a **No hecho** o **Por hacer**, las unidades se devuelven solas.
5. El **Total SINPE** y los **reportes** suman solo pedidos en **Hecho**, por la fecha en que se confirmó el pago.

**Los respaldos** se generan al momento y se descargan: un JSON con todas las tablas (sirve en local y en la nube) y, en local, también la copia exacta `.db`.

**Otras protecciones incluidas:** límite de intentos de inicio de sesión (contra fuerza bruta), política CSP que no permite scripts incrustados (contra XSS), todo texto se escapa antes de mostrarse, subida de imágenes solo JPG, PNG, WEBP o GIF (SVG no, porque puede llevar código), protección de nombres de archivo en respaldos y exportaciones a Excel que no ejecutan fórmulas.

### ¿Por qué este stack?
- **Node.js + Express:** un solo lenguaje (JavaScript) en el navegador y en el servidor, y Express es fácil de leer.
- **SQLite integrado (`node:sqlite`):** la base de datos es un solo archivo (`datos/ferreteria.db`), no hay que instalar ni configurar un servidor de base de datos y no se compila nada al hacer `npm install`.
- **Sin frameworks de interfaz:** cada página se puede leer y entender completa; no hay paso de compilación.

---

## 6. Estructura de carpetas

```
ferreteria-max/
├── servidor.js               ← arranca el sitio en su computadora (npm start)
├── api/index.js              ← punto de entrada en Vercel
├── vercel.json               ← configuración de Vercel
├── INICIAR.bat               ← doble clic para arrancar en Windows
├── package.json              ← dependencias y comandos
├── .env.ejemplo              ← plantilla de configuración (se copia a .env)
├── src/
│   ├── app.js                ← arma la aplicación Express (seguridad + rutas)
│   ├── config.js             ← lee .env o las variables de Vercel
│   ├── db.js                 ← base de datos: archivo local o Turso, y las tablas
│   ├── datos-ejemplo.js      ← productos, sucursales, personal y usuarios de prueba
│   ├── semilla.js            ← carga los datos de ejemplo y crea el súper admin
│   ├── generar-imagenes.js   ← dibuja las imágenes de ejemplo (npm run imagenes)
│   ├── reiniciar.js          ← borra la base para empezar de cero
│   ├── middleware/
│   │   ├── auth.js           ← sesiones y permisos por rol
│   │   ├── seguridad.js      ← cabeceras, control de origen, límite de intentos
│   │   ├── mantenimiento.js  ← aviso de mantenimiento
│   │   └── subidas.js        ← subida de imágenes (multer)
│   ├── rutas/
│   │   ├── auth.js           ← registro, login, perfil   (/api/auth)
│   │   ├── publico.js        ← catálogo, sucursales...   (/api)
│   │   ├── cliente.js        ← pedidos y comprobantes    (/api/pedidos)
│   │   ├── admin.js          ← panel del admin           (/api/admin)
│   │   └── superadmin.js     ← solo súper admin          (RUTA_SECRETA)
│   ├── servicios/
│   │   ├── inventario.js     ← movimientos y descuento al confirmar pagos
│   │   ├── archivos.js       ← imágenes guardadas en la base de datos
│   │   ├── configuracion.js  ← nombre, colores, SINPE, banners...
│   │   ├── bitacora.js       ← registro de actividad
│   │   └── tema.js           ← genera /tema.css con los colores elegidos
│   └── utilidades/
│       ├── validar.js        ← revisa todo lo que llega del navegador
│       ├── fechas.js         ← hora de Costa Rica y períodos (día, semana, mes)
│       └── exportar.js       ← genera CSV y Excel (.xlsx) sin librerías
├── privado/                  ← NO es público: acceso y panel del súper admin
│   ├── super-login.html
│   ├── super-login.js
│   └── super-panel.js
├── public/                   ← lo que ve el navegador
│   ├── index.html, catalogo.html, producto.html, personal.html,
│   │   sucursales.html, contacto.html, carrito.html, pedido.html,
│   │   login.html, registro.html, cuenta.html, 404.html
│   ├── admin/index.html, admin/admin.js   ← panel de administración
│   ├── css/estilos.css, css/admin.css
│   ├── js/                   ← un archivo por página + comun.js
│   ├── img/                  ← logo, ícono e imágenes de los productos de ejemplo
│   └── fonts/                ← tipografía Barlow (licencia libre OFL)
└── datos/                    ← se crea sola en local: el archivo ferreteria.db
```

### Tablas de la base de datos
`usuarios`, `sesiones`, `categorias`, `productos`, `movimientos_inventario`, `pedidos`, `detalle_pedido`, `sucursales`, `personal`, `configuracion`, `bitacora`, `mensajes_contacto` y `archivos`. Están definidas en `src/db.js`.

---

## 7. Tareas comunes

| Quiero… | Haga esto |
|---|---|
| Empezar con los datos de ejemplo otra vez | Detenga el servidor, ejecute `npm run reiniciar` y luego `npm start` (con Turso configurado en `.env`, borra la base en la nube) |
| Que el servidor se reinicie solo al editar código | `npm run dev` |
| Cambiar el puerto | Edite `PUERTO` en `.env` |
| Cambiar la ruta oculta o la contraseña del súper admin | Edite `.env`. Para una contraseña nueva ponga `RESTABLECER_SUPERADMIN=si`, reinicie y vuelva a ponerlo en `no` |
| Restaurar un respaldo (local) | Detenga el servidor, copie la copia `.db` descargada sobre `datos/ferreteria.db`, borre `ferreteria.db-wal` y `ferreteria.db-shm` si existen, y arranque de nuevo |
| Restaurar en la nube | Desde el panel de Turso, que guarda copias automáticas |
| Abrir la base de datos para estudiarla | Use [DB Browser for SQLite](https://sqlitebrowser.org) y abra `datos/ferreteria.db` |

## 8. Problemas frecuentes

- **"Su versión de Node.js es…"**: instale la versión LTS más reciente desde nodejs.org.
- **"El puerto 3000 ya está en uso"**: cierre la otra terminal donde corre el sitio o cambie `PUERTO` en `.env`.
- **"npm no se reconoce como un comando"**: cierre y vuelva a abrir la terminal después de instalar Node (en Windows, a veces hay que reiniciar la computadora).
- **No entra el súper admin**: revise que use la ruta de `RUTA_SECRETA` y no `/login`. Tras 8 intentos fallidos hay que esperar 15 minutos (o reiniciar el servidor).
- **Los mapas de sucursales no cargan**: necesitan internet (vienen de OpenStreetMap). El resto del sitio funciona sin conexión.
- **En Vercel sale "Falta configurar la base de datos"**: faltan `TURSO_DATABASE_URL` o `TURSO_AUTH_TOKEN` en Environment Variables. Agréguelas y haga **Redeploy**.
- **En Vercel la ruta del súper admin da "No encontrado"**: falta `RUTA_SECRETA` o `SUPERADMIN_CONTRASENA`, o está usando la ruta de ejemplo en vez de la suya.

Los datos de ejemplo (números SINPE, teléfonos, direcciones y personas) son ficticios.
