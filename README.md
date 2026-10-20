# Experiencia SV

Aplicación web para descubrir lugares de El Salvador con **datos abiertos de
OpenStreetMap** y un **asistente conversacional con IA opcional**. No usa Google
Maps Platform: no hay claves de Google, no hay facturación de Google y no se
piden tarjetas.

## Estado por fases

- **Fase 1:** identidad visual, navegación, chat de demostración y páginas base.
- **Fase 2:** búsqueda y detalle con datos locales de demostración (retirados).
- **Fase 3:** integración real con OpenStreetMap:
  - búsqueda por texto, municipio o departamento (Nominatim);
  - búsqueda por categoría con etiquetas OSM (Overpass);
  - detalle con dirección, sitio web, teléfono, horario y descripción cuando
    existen en OSM;
  - filtros de radio reales con distancia en línea recta;
  - mini mapa de resultados con marcadores, referencia y radio de búsqueda;
  - ubicación del usuario solo tras pulsar «Buscar cerca de mí»;
  - mapa interactivo Leaflet en el detalle, cargado solo al pulsar «Ver mapa»;
  - errores clasificados y mensajes claros en español.
- **Fase 4:** asistente con IA real conectado al backend:
  - proveedor compatible con OpenAI Chat Completions, configurable por variables;
  - herramientas controladas que consultan los mismos lugares reales de OSM;
  - recomendaciones con tarjetas y enlaces verificados;
  - itinerarios estructurados con paradas reales, orden sugerido, motivos,
    estimaciones marcadas y advertencias;
  - modificación del itinerario por lenguaje natural conservando las paradas no
    afectadas;
  - mapa compacto del itinerario reutilizando Leaflet;
  - estados de carga, error, reintento, cancelación y conversación nueva;
  - clave de IA solo en el servidor y validación de todo lo que devuelve el modelo.
- **Fase 5 (esta entrega):** cuentas e itinerarios guardados con Supabase:
  - registro, inicio y cierre de sesión con correo y contraseña;
  - confirmación de correo, recuperación y restablecimiento de contraseña;
  - sesión persistente con refresco automático y cierre por expiración;
  - perfiles vinculados a `auth.users` e itinerarios privados por propietario;
  - RLS activo en todas las tablas de usuario: cada cuenta solo ve sus datos;
  - guardado desde el chat con una copia nueva del itinerario estructurado;
  - lista, detalle, edición, reordenación, alta/baja de paradas y borrado con
    confirmación;
  - la exploración y la búsqueda siguen siendo públicas: la cuenta solo es
    necesaria para guardar o administrar itinerarios;
  - el navegador solo recibe la URL y la clave pública/anon de Supabase; la
    `service_role` no se usa en ninguna parte de la aplicación.

No se muestran lugares de demostración: todo resultado proviene de
OpenStreetMap en el momento de la consulta. **OpenStreetMap no ofrece fotos,
calificaciones ni reseñas**, así que la interfaz no las muestra ni las inventa.
Si falta `AI_API_KEY`, el resto de la aplicación sigue funcionando y el chat
responde con un error claro de configuración; **no se sustituye la IA por
respuestas simuladas**.

## Requisitos

- Node.js 20.12 o superior (el servidor local usa `process.loadEnvFile`).
- npm.
- Conexión a Internet para consultar Nominatim/Overpass y descargar teselas.
- Una clave de un proveedor de IA compatible con OpenAI Chat Completions para
  usar el chat. Es opcional para desarrollar búsqueda, detalle y mapas.
- Un proyecto de Supabase para cuentas e itinerarios guardados. También es
  opcional para la exploración pública; sin configuración, las rutas de cuenta
  muestran una página de configuración pendiente.
- La CLI de Supabase permite aplicar migraciones al proyecto remoto; Docker
  Desktop solo es necesario para levantar Supabase y ejecutar las pruebas RLS en
  local. Ninguno de los dos hace falta para usar el proyecto remoto desde la
  interfaz.

## Arquitectura

```
Navegador (React + Vite)
 ├─ /api/*  ──>  API propio (server/ en local, api/ en Vercel)
 │                 ├─ Nominatim   (texto, referencia y detalle)
 │                 ├─ Overpass    (categorías por etiquetas OSM)
 │                 └─ Proveedor de IA (solo si está configurado)
 ├─ Supabase Auth + Data API ──> PostgreSQL con RLS
 │                              (solo URL y clave pública/anon)
 └─ Leaflet ──>  teselas del proveedor configurado (por defecto OSM)
```

El navegador nunca llama directo a Nominatim, a Overpass ni al proveedor de IA.
El API propio centraliza el User-Agent, el límite de 1 solicitud por segundo a
Nominatim, la caché, la validación, las herramientas del chatbot y la clave de
IA. La clave **nunca** se envía al navegador ni se registra en logs.

Las cuentas y los itinerarios guardados sí se consultan directamente desde el
navegador con `@supabase/supabase-js`, usando la URL del proyecto y la clave
pública/anon. Esa clave está diseñada para ser pública y no omite RLS. La
protección real vive en las políticas de la base de datos; la `service_role`,
que sí omite RLS, no se usa ni se expone en esta aplicación.

El chatbot no inventa lugares: el modelo puede pedir búsquedas y detalles a
través de herramientas del servidor, y el servidor solo acepta identificadores
que provengan de esas herramientas o del itinerario firmado actual. El
itinerario que viaja al navegador se devuelve con una firma HMAC para que el
cliente no pueda alterarlo.

## Ejecutar en local

Abre **dos terminales**: la API y Vite deben estar ejecutándose a la vez. Si solo
arrancas Vite, el proxy devuelve `ECONNREFUSED` al llamar a `/api/*`.

```bash
npm install
cp .env.example .env        # En PowerShell: Copy-Item .env.example .env
npm run api                 # Terminal 1: API en http://localhost:8787
npm run dev                 # Terminal 2: interfaz en http://localhost:5173
```

Edita `.env` y define `OSM_USER_AGENT` con un contacto real antes de publicar.
Para habilitar el chat, define también `AI_API_KEY` (y opcionalmente
`AI_BASE_URL`, `AI_MODEL` y `AI_PROVIDER_NAME`). Sin esa clave, el chat muestra
«El asistente no está configurado» y el resto de la aplicación funciona normal.

### Configurar Supabase (cuentas e itinerarios)

1. Crea un proyecto en <https://supabase.com/>.
2. En **Project Settings > API**, copia la URL del proyecto y la clave
   publicable/anon. Pega ambos valores en `.env`:
   ```dotenv
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-publica
   ```
   No uses la `service_role` ni ninguna clave secreta en variables `VITE_*`.
3. Aplica la migración versionada. Con la CLI:
   ```bash
   supabase link --project-ref <ref-del-proyecto>
   supabase db push
   ```
   También puedes abrir `supabase/migrations/20261019000000_phase5_profiles_itineraries.sql`
   en el **SQL Editor** y ejecutarlo una vez. La migración crea `profiles`,
   `itineraries`, triggers, restricciones, índices, permisos mínimos y RLS.
4. En **Authentication > URL Configuration**, define:
   - **Site URL:** `http://localhost:5173` en desarrollo y tu dominio real en
     producción.
   - **Redirect URLs:** `http://localhost:5173/cuenta/iniciar-sesion`,
     `http://localhost:5173/cuenta/restablecer` y las equivalentes de
     producción.
   - Usa `http://127.0.0.1:5173` solo si abres la app por ese host; el redirect
     debe coincidir exactamente con el origen que usa el navegador.
5. En **Authentication > Providers > Email**, deja activado el registro y, en
   producción, activa la confirmación de correo. Configura un SMTP propio antes
   de abrir el registro al público: el correo integrado de Supabase tiene límites
   muy bajos (el `config.toml` local documenta `email_sent = 2` por hora).
6. Reinicia Vite después de cambiar `.env` (las variables `VITE_*` se leen al
   arrancar) y vuelve a compilar si ya habías generado `dist/`.

`supabase/config.toml` es la configuración del entorno local de la CLI. Ahí la
confirmación de correo está desactivada para agilizar las pruebas y los correos
se capturan en Inbucket (`http://localhost:54324`). No copies ese ajuste al
proyecto remoto: en el panel de Supabase la confirmación debe estar activa para
producción.

Sin `VITE_SUPABASE_URL` y la clave pública, la app sigue mostrando la
exploración y el chat, pero `/cuenta`, `/itinerarios` y las rutas de detalle
muestran `Configuración pendiente`. No hay datos simulados de cuentas.

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Vite. |
| `npm run api` | API local sin dependencias en el puerto 8787. |
| `npm run build` | Compila la interfaz en `dist/`. |
| `npm run preview` | Sirve la compilación con el proxy del API. |
| `npm run test` | Suite de pruebas con `node --test`. |
| `npm run lint` | ESLint sobre todo el repositorio. |
| `npm run check:bundle` | Revisa `dist/` en busca de secretos de servidor o IA. |

## Variables de entorno

### OpenStreetMap y mapas

| Variable | ¿Obligatoria? | Uso |
| --- | --- | --- |
| `OSM_USER_AGENT` | Recomendada; obligatoria en producción | Identifica la aplicación ante Nominatim y Overpass. Incluye nombre, URL y contacto. |
| `NOMINATIM_URL` | No | Endpoint de Nominatim. Por defecto `https://nominatim.openstreetmap.org`. |
| `OVERPASS_URL` | No | Endpoint de Overpass. Por defecto `https://overpass-api.de/api/interpreter`. |
| `NOMINATIM_MIN_INTERVAL_MS` | No | Espera mínima entre solicitudes a Nominatim. Por defecto `1100` ms (política: 1 req/s). |
| `OSM_TILE_URL` | No | Plantilla de teselas del mapa. Debe ser HTTPS y contener `{z}`, `{x}` e `{y}`. |
| `OSM_TILE_ATTRIBUTION` | No | Atribución HTML dibujada en el mapa. Debe mantener la de OSM. |
| `API_PORT` | No | Puerto del API local. Por defecto `8787`. |
| `ALLOWED_ORIGIN` | No | Si se define, el API rechaza con 403 los orígenes distintos. |

### Asistente con IA

| Variable | ¿Obligatoria? | Uso |
| --- | --- | --- |
| `AI_API_KEY` | Sí, para usar el chat | Clave del proveedor. Vive solo en el servidor. Sin ella el chat queda deshabilitado. |
| `AI_BASE_URL` | No | Base compatible con OpenAI. Por defecto `https://api.openai.com/v1`. Debe ser HTTPS; solo se permite HTTP para `localhost`, `127.0.0.1` o `::1`. |
| `AI_MODEL` | No | Modelo del proveedor. Por defecto `gpt-4o-mini`. |
| `AI_PROVIDER_NAME` | No | Nombre visible del proveedor (por ejemplo `OpenAI`, `Groq`, `Ollama`). |
| `AI_TIMEOUT_MS` | No | Tiempo máximo por llamada al proveedor. Por defecto `15000`; rango `3000`–`25000`. |
| `AI_MAX_OUTPUT_TOKENS` | No | Máximo de tokens de salida por llamada. Por defecto `900`; rango `200`–`2000`. |
| `AI_REASONING_EFFORT` | No | `low`, `medium` o `high`. Reduce la latencia en modelos que razonan antes de responder (por ejemplo Gemini 3). Sin definir, se usa el valor del proveedor. |
| `CHAT_SIGNING_SECRET` | Recomendada en producción | Secreto de al menos 16 caracteres para firmar el itinerario. Si falta, se deriva de `AI_API_KEY`; si la clave rota, los itinerarios abiertos dejan de validarse. |
| `CHAT_RATE_LIMIT_PER_MINUTE` | No | Solicitudes de chat por IP y minuto. Por defecto `12` (rango `1`–`60`). |
| `CHAT_SESSION_LIMIT_PER_MINUTE` | No | Solicitudes por `sessionId` y minuto. Por defecto `8` (rango `1`–`40`). |
| `CHAT_MAX_CONCURRENT` | No | Solicitudes de chat simultáneas por instancia. Por defecto `2` (rango `1`–`5`). |
| `CHAT_MAX_TOOL_CALLS` | No | Herramientas por turno. Por defecto `5` (rango `1`–`6`). |
| `CHAT_MAX_SEARCHES` | No | Llamadas a `search_places` por turno. Por defecto `3` (rango `1`–`4`). |
| `CHAT_MAX_LOCATES` | No | Llamadas a `locate_reference` por turno. Por defecto `2` (rango `1`–`3`). |
| `CHAT_TIMEOUT_MS` | No | Presupuesto total del turno. Por defecto `27000`; rango `10000`–`29000`. |
| `CHAT_ITINERARY_TTL_MS` | No | Validez del token de itinerario. Por defecto 12 h; mínimo 5 min; máximo 7 días. |

### Supabase (cuentas e itinerarios)

| Variable | ¿Obligatoria? | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Sí, para cuentas | URL del proyecto. El cliente la normaliza al origen, sin `/rest/v1/`. |
| `VITE_SUPABASE_ANON_KEY` | Sí, para cuentas | Clave pública/anon o publishable. Es pública por diseño. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | No | Alternativa si usas el nombre nuevo de Supabase y `VITE_SUPABASE_ANON_KEY` está vacía. |

No existe ninguna variable `VITE_*` con secretos: la interfaz no maneja
contraseñas, tokens privados, la clave de IA ni la `service_role`. Las variables
`VITE_SUPABASE_*` son públicas y quedan incluidas en el bundle; la protección
real son las políticas RLS. Todo lo que el mapa necesita (URL de teselas y
atribución) se entrega por `GET /api/config` y es público por diseño. La
configuración pública del chat solo indica si está habilitado, el nombre del
proveedor y el modelo; nunca la clave ni la URL interna del proveedor.

`VITE_*` se incorpora en tiempo de compilación: después de cambiarlas hay que
reiniciar Vite en desarrollo y volver a desplegar en Vercel. Nunca pongas
`SUPABASE_SERVICE_ROLE_KEY` en el frontend ni en una variable `VITE_*`; esa clave
omite RLS y esta aplicación no la necesita.

### Proveedores compatibles

El cliente usa `fetch` nativo contra el endpoint `/chat/completions`, sin SDK
adicional. Puedes cambiar de proveedor sin tocar código:

| Proveedor | `AI_BASE_URL` | Ejemplo de `AI_MODEL` |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Groq | `https://api.groq.com/openai/v1` | el modelo habilitado en tu cuenta |
| OpenRouter | `https://openrouter.ai/api/v1` | el modelo elegido |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.5-flash-lite` (verificado) o `gemini-3.5-flash`; consulta los modelos disponibles en tu cuenta |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Ollama local | `http://localhost:11434/v1` | `llama3.1` |

Para Ollama no hay una clave real, pero este servidor exige un valor no vacío en
`AI_API_KEY` para habilitar el chat; usa, por ejemplo, `AI_API_KEY=local`.
Consulta la disponibilidad, los límites y los precios de cada proveedor en su
documentación: cambian con el tiempo y no se replican aquí.

Con Gemini 3 conviene definir `AI_REASONING_EFFORT=low` y
`AI_MAX_OUTPUT_TOKENS=2000`: el razonamiento consume parte del presupuesto de
salida y puede agotar el JSON final si el límite es bajo. El cliente conserva
las firmas opacas que algunos proveedores adjuntan a las llamadas de
herramientas (por ejemplo, `thought_signature` de Gemini 3) y las devuelve en
el turno siguiente; no las interpreta ni las expone al navegador.

## Asistente con IA

### Flujo de un turno

1. El navegador envía `POST /api/chat` con el mensaje, un historial de texto
   acotado, un `sessionId` anónimo y, si existe, el token firmado del itinerario.
2. El servidor valida tamaños, roles, identificadores y token; aplica límites por
   IP, por sesión y de concurrencia.
3. El modelo recibe las instrucciones del sistema y las herramientas. Puede
   consultar OpenStreetMap antes de responder.
4. El servidor ejecuta cada herramienta con validación de argumentos, caché y
   límites propios. Los resultados son datos reales de OSM.
5. El modelo devuelve un JSON final con `message`, `recommendedPlaceIds`,
   `suggestions` e `itinerary`.
6. El servidor descarta cualquier lugar o parada que no exista en el catálogo de
   herramientas o en el itinerario firmado, calcula distancias, añade
   advertencias, firma el itinerario y devuelve la respuesta pública.
7. La interfaz muestra el mensaje, las tarjetas, el itinerario, el mapa y las
   sugerencias. Si el cambio de itinerario falla, conserva el plan anterior.

El servidor hace hasta 4 llamadas al proveedor por turno: 3 rondas con
herramientas y una respuesta final estructurada si hace falta. Si el modelo no
devuelve un JSON válido, se hace un último intento con `response_format:
json_object`. No se aceptan respuestas simuladas como sustituto de la IA.

### Herramientas disponibles

| Herramienta | Entrada | Uso |
| --- | --- | --- |
| `search_places` | `query?`, `category?`, `center?`, `radiusKm?`, `limit?` | Busca lugares reales en OSM. Devuelve IDs reales. |
| `get_place_details` | `placeId` | Obtiene sitio web, teléfono, horario y descripción si existen. |
| `locate_reference` | `query` | Convierte una ciudad o referencia en coordenadas. |
| `calculate_distances` | `placeIds[]` | Distancias en línea recta entre lugares conocidos. No calcula rutas. |

Las herramientas no exponen la clave de IA, URLs internas ni acceso a Internet
arbitrario. `calculate_distances` solo acepta IDs ya conocidos y devuelve
distancias haversine, no tiempos de conducción.

### Verificación y anti-invención

- Los IDs de lugares deben provenir de una herramienta o del itinerario firmado.
  Cualquier otro ID se descarta antes de responder.
- El servidor normaliza los lugares públicos y omite campos que OSM no ofrece
  (por ejemplo, calificaciones, reseñas, fotos o precios). No se rellenan con
  placeholders.
- Las distancias y advertencias las calcula el servidor. La interfaz indica que
  son **en línea recta**, no por carretera.
- Los tiempos de visita son estimaciones marcadas como tales (`visitEstimate`).
- Las fechas del itinerario solo se aceptan si la persona las mencionó en su
  mensaje actual; el servidor descarta cualquier otra fecha propuesta por el
  modelo. No se inventan fechas, horarios ni disponibilidad.
- El orden de las paradas es una sugerencia; no se presenta como ruta óptima.
- Las advertencias recuerdan confirmar horarios, precios, disponibilidad,
  clima, seguridad y cierres; no se consultan fuentes en tiempo real.
- Si el usuario pide un cambio y la respuesta parcial falla, el servidor puede
  devolver `itinerary: null`; la interfaz mantiene el plan anterior y lo explica.

### Personalización

El asistente puede personalizar por intereses, tiempo disponible, presupuesto
total o por persona, número de personas y punto de salida. Cuando falta un dato
esencial para un itinerario, debe preguntarlo de forma progresiva, sin formularios
largos. El presupuesto es una referencia declarada por el usuario: OSM no ofrece
precios verificados de entradas, comidas, transporte ni alojamiento.

### Límites y protección

| Límite | Valor |
| --- | --- |
| Mensaje de usuario | 800 caracteres |
| Historial | últimos 10 mensajes y 4000 caracteres (máximo 20 elementos recibidos) |
| Lugares recomendados | 6 |
| Paradas del itinerario | 6 |
| Herramientas por turno | 5 (configurable) |
| Búsquedas / ubicaciones por turno | 3 / 2 (configurables) |
| Llamadas al proveedor | 3 rondas + 1 finalización |
| Solicitudes por IP / sesión | 12 / 8 por minuto (configurables) |
| Concurrencia | 2 por instancia (configurable) |
| Tiempo del turno | 27 s por defecto (máximo 29 s) |
| Cuerpo HTTP | 48 KB |
| Token de itinerario | 12 h por defecto (máximo 7 días; hasta 24 000 caracteres) |

Además, el servidor valida el origen (`ALLOWED_ORIGIN`), redacta posibles claves
en los errores y en el texto del asistente, no registra prompts, mensajes ni
respuestas, y no envía la clave al navegador. La cancelación del navegador aborta
la llamada al proveedor cuando el entorno lo permite.

### Itinerario firmado

El itinerario estructurado se envía al navegador junto con
`itineraryToken`, un token opaco firmado con HMAC-SHA256. En el siguiente turno,
el navegador devuelve el token y el servidor lo verifica antes de usarlo como
contexto. Esto evita confiar en coordenadas, IDs o títulos enviados por el
cliente. El token caduca (12 h por defecto).

Define `CHAT_SIGNING_SECRET` en producción para que la firma sea estable entre
instancias. Si no se define, se deriva de `AI_API_KEY`; como último recurso se
usa un secreto aleatorio por proceso, y los itinerarios no sobreviven a un
reinicio o a otra instancia.

### Privacidad de la IA

Al usar el chat se envían al proveedor de IA el mensaje del usuario, el historial
reciente, un resumen del itinerario actual, las coordenadas de salida si el
usuario las proporciona y los resultados de las herramientas. No se envían
nombres, correos ni cuentas porque la aplicación no los solicita. La ubicación
GPS solo se obtiene tras pulsar «Buscar cerca de mí» y no se guarda.

El proveedor puede conservar datos según sus propias políticas y puede cobrar
por tokens. Revisa esas políticas antes de desplegar. En este repositorio no se
persisten conversaciones en el servidor: el historial vive en el estado del
navegador y el servidor lo recorta en cada solicitud. No introduzcas datos
personales sensibles en el chat.

## Cuentas e itinerarios guardados

### Rutas

| Ruta | Acceso | Uso |
| --- | --- | --- |
| `/cuenta` | Requiere sesión | Perfil, correo de solo lectura y cierre de sesión. |
| `/cuenta/iniciar-sesion` | Pública | Inicio de sesión y confirmación de correo. |
| `/cuenta/registro` | Pública | Alta con nombre visible, correo y contraseña. |
| `/cuenta/recuperar` | Pública | Solicitud de enlace de recuperación. |
| `/cuenta/restablecer` | Enlace válido | Nueva contraseña con la sesión de recuperación. |
| `/itinerarios` | Requiere sesión | Lista de itinerarios propios. |
| `/itinerarios/:id` | Requiere sesión y propiedad | Detalle, edición y borrado. |

La exploración, la búsqueda, el detalle de lugares y el chat siguen funcionando
sin cuenta. Al pulsar «Guardar itinerario» sin sesión, el plan permanece en el
estado del chat y la interfaz redirige al login con una ruta interna segura; al
volver, se puede guardar. Si se recarga la página, ese estado local del chat se
pierde.

### Autenticación

- **Registro:** el nombre visible se guarda en `raw_user_meta_data.display_name`
  y el trigger crea el perfil. La contraseña la gestiona Supabase Auth; la base
  de datos de la aplicación no almacena contraseñas ni hashes.
- **Confirmación de correo:** el enlace de Supabase redirige a
  `/cuenta/iniciar-sesion?confirmado=1`. Si la verificación es válida, Supabase
  inicia la sesión y la interfaz muestra «Tu cuenta está lista». Si el enlace
  caducó o ya se usó, Supabase añade un error al fragmento de la URL y la app
  muestra «No pudimos confirmar tu correo»; **no** presenta un éxito falso. Desde
  ahí se puede iniciar sesión o volver al registro.
- **Inicio y cierre de sesión:** se normaliza el correo, se validan los campos y
  se muestran mensajes seguros. Cerrar sesión no elimina los itinerarios.
- **Persistencia:** el cliente usa `persistSession`, `autoRefreshToken` y
  `detectSessionInUrl`, con la clave de almacenamiento `experiencia-sv-auth`. Al
  recargar o abrir otra pestaña, la sesión se restaura; si el token ya no es
  válido, las rutas protegidas vuelven al login.
- **Recuperación:** se envía un enlace a `/cuenta/restablecer`. Esa página exige
  una sesión de recuperación válida, valida la nueva contraseña y no acepta el
  formulario si el enlace falta, caducó o ya se usó.
- **Redirecciones:** `next` solo acepta rutas internas (`/...`) y descarta
  URLs externas, `//host`, barras invertidas, caracteres de control y valores
  demasiado largos. La ruta por defecto tras autenticarse es `/itinerarios`.

### Perfiles e itinerarios

`profiles` tiene una fila por usuario, con el mismo UUID que `auth.users.id`, un
nombre visible opcional y marcas de tiempo. No duplica el correo. `itineraries`
guarda el propietario (`user_id`), título, descripción, fecha de inicio,
duración, número de personas, presupuesto, moneda, preferencias y paradas como
`jsonb`.

Límites principales:

| Campo | Límite |
| --- | --- |
| Título | 1–120 caracteres |
| Descripción | 1–2000 caracteres |
| Fecha de inicio | 1900-01-01 a 2100-12-31 |
| Duración | 1–60 días |
| Personas | 1–50 |
| Presupuesto | 0–100 000 000; moneda ISO de tres letras |
| Paradas | 1–20; IDs con forma `osm-*` y sin duplicados |
| Notas / motivos | 1000 / 320 caracteres por parada |

El chat valida y firma el itinerario antes de enviarlo al navegador. Al guardar,
la app crea una **copia nueva** con los datos estructurados, no con la respuesta
conversacional. Si después se modifica el plan en el chat, el registro guardado
no se actualiza automáticamente: hay que guardar de nuevo, lo que crea otra
copia. En el editor, reordenar o cambiar paradas recalcula las distancias en
línea recta y conserva los identificadores reales de OpenStreetMap.

### RLS y aislamiento

Las políticas de `public.profiles` permiten leer, insertar y actualizar solo la
fila cuyo `id` coincide con `auth.uid()`. Las de `public.itineraries` permiten
seleccionar, insertar, actualizar y eliminar solo las filas cuyo `user_id`
coincide con `auth.uid()`. `anon` no tiene privilegios sobre estas tablas y
`authenticated` solo tiene los grants mínimos. Las consultas de la app también
filtran por propietario como defensa adicional; un itinerario ajeno se muestra
como no encontrado, sin revelar su contenido.

La prueba SQL `supabase/tests/phase5_rls.sql` crea dos usuarios de prueba dentro
de una transacción, comprueba lectura, escritura, borrado y suplantación entre
ambos y termina con `ROLLBACK`. Está pensada para PostgreSQL local, no para
producción.

### Privacidad de la cuenta

Supabase Auth almacena el correo y las credenciales de autenticación. La app
guarda el nombre visible, el perfil y los itinerarios que la persona decide
guardar. No se guardan conversaciones completas ni coordenadas GPS. Las
consultas a Supabase se hacen desde el navegador con la clave pública; RLS
limita cada fila al propietario. No se usa `service_role` para saltarse las
políticas ni se envían contraseñas al API propio.

## Fuentes de datos y cumplimiento

### Nominatim (texto, referencia y detalle)

- **Límite global de 1 solicitud por segundo.** El API serializa las llamadas
  con una cola y `NOMINATIM_MIN_INTERVAL_MS`.
- **Sin autocompletado.** La búsqueda se dispara al enviar el formulario, al
  elegir categoría o al fijar una referencia; nunca en cada tecla.
- **Caché** en memoria de 5 minutos para búsquedas, detalles y referencias.
- **User-Agent identificable** con `OSM_USER_AGENT`.
- **Atribución visible** «© OpenStreetMap contributors» con enlace a la página
  de derechos de autor.

### Overpass (categorías)

- Consultas por etiquetas reales de OSM (por ejemplo `natural=beach`).
- Máximo 2 consultas simultáneas y tiempo de espera de 20 s.
- Con una referencia y radio se usa `around`; sin referencia se usa el
  rectángulo que cubre El Salvador.
- El servidor público `overpass-api.de` puede saturarse. Si ocurre, configura
  `OVERPASS_URL` con otro espejo público (por ejemplo
  `https://overpass.kumi.systems/api/interpreter`) o con una instancia propia.
  Las consultas por categoría a todo el país son las más pesadas: si tardan,
  la interfaz sugiere acotar con una referencia y un radio.

### Teselas del mapa

- El **mini mapa de resultados** se carga cuando hay lugares con coordenadas y
  encuadra todos los marcadores, la referencia y el radio elegido.
- El **mapa del itinerario** reutiliza el mismo componente en variante compacta.
- En el detalle, Leaflet carga las teselas **solo cuando se pulsa «Ver mapa»**.
- La atribución la dibuja Leaflet y no se oculta.
- El servidor de teselas de OpenStreetMap es comunitario y sin SLA. Para
  producción con tráfico alto, configura `OSM_TILE_URL` con un proveedor
  propio o comercial y mantén la atribución correspondiente.

### Licencia de los datos

Los datos son © contribuyentes de OpenStreetMap, disponibles bajo la
[Open Database License (ODbL)](https://www.openstreetmap.org/copyright). La
atribución se muestra junto a los resultados, en el detalle, en el mapa y en el
itinerario del chat.

## API propia

| Método y ruta | Entrada | Salida |
| --- | --- | --- |
| `GET /api/config` | — | Proveedor, atribución, opciones de radio, datos públicos del mapa y estado del chat. |
| `POST /api/search` | `{ query?, category?, center?, radiusKm?, pageSize? }` | `{ places, center, radiusKm, source, dataSource, attribution, rankingNotice }`. |
| `GET /api/place?id=...` | `id` con forma `osm-node-123`, `osm-way-456` o `osm-relation-789`. | `{ place, source, attribution }` con etiquetas reales de OSM. |
| `POST /api/locate` | `{ query }` (mínimo 3 caracteres) | `{ location, label, address, source }`. |
| `POST /api/chat` | `{ message, history?, sessionId?, itineraryToken? }` | `{ message, places, suggestions, itinerary, itineraryToken, meta }`. |

Reglas de búsqueda:

- Solo texto → Nominatim (nombres, municipios, departamentos).
- Solo categoría → Overpass (todas las coincidencias dentro del área).
- Texto + categoría → Overpass con filtro de categoría y nombre.
- `radiusKm` requiere `center` y acepta `5`, `10`, `25` o `50`. El servidor
  vuelve a filtrar por distancia real (haversine) y ordena por cercanía.

Ejemplo de respuesta de `/api/chat`:

```json
{
  "message": "Encontré estos lugares en OpenStreetMap para tu plan.",
  "places": [
    {
      "id": "osm-node-123",
      "name": "Nombre real en OSM",
      "address": "Dirección disponible en OSM",
      "category": "Playa",
      "icon": "🏖️",
      "location": { "latitude": 13.493, "longitude": -89.383 },
      "distanceMeters": 1200,
      "osmUrl": "https://www.openstreetmap.org/node/123"
    }
  ],
  "suggestions": ["Agrega otra parada", "Hazlo más económico"],
  "itinerary": {
    "title": "Plan sugerido",
    "summary": "Resumen del plan",
    "date": null,
    "travelers": 2,
    "budget": { "amount": 60, "currency": "USD", "scope": "total" },
    "origin": { "label": "San Salvador", "latitude": 13.69, "longitude": -89.19 },
    "stops": [
      {
        "order": 1,
        "place": { "id": "osm-node-123", "name": "Nombre real en OSM" },
        "reason": "Motivo propuesto por el asistente",
        "visitMinutes": 90,
        "visitEstimate": true,
        "distanceFromOriginMeters": 32000,
        "distanceFromPreviousMeters": null
      }
    ],
    "warnings": ["Las distancias son en línea recta…"],
    "distanceMethod": "haversine",
    "attribution": "© OpenStreetMap contributors"
  },
  "itineraryToken": "payload.firma",
  "meta": {
    "source": "openstreetmap",
    "provider": "OpenAI",
    "dataSources": ["nominatim"],
    "placesFound": 1,
    "dataNotice": "Los lugares provienen de OpenStreetMap…"
  }
}
```

Los campos opcionales que no existen en OSM se omiten o quedan en `null`; no se
inventan. `places` y `itinerary` solo contienen lugares verificados por el
servidor.

## Categorías y etiquetas OSM

| Categoría | Filtros Overpass |
| --- | --- |
| Playas | `natural=beach` |
| Lagos y lagunas | `natural=water` + `water=lake`, y `water=lagoon` |
| Volcanes y montañas | `natural=volcano`, `natural=peak` |
| Parques y naturaleza | `leisure=park`, `leisure=nature_reserve`, `boundary=national_park` |
| Sitios históricos y culturales | `historic=*`, `tourism=museum` |
| Restaurantes | `amenity=restaurant` |
| Hoteles y alojamientos | `tourism=hotel`, `guest_house`, `hostel`, `apartment` |

El asistente también puede usar búsquedas de texto libre para intereses que no
coincidan exactamente con una categoría (fotografía, descanso, familia,
aventura, gastronomía, etc.) y combinar varias búsquedas.

## Búsqueda, radio y distancias

- Las distancias son **en línea recta** desde la referencia elegida; la
  interfaz lo indica y no son distancia por carretera.
- El orden depende de la fuente: Nominatim usa su relevancia; las búsquedas
  por categoría con referencia se ordenan por distancia. El detalle
  «¿Cómo se ordenan los resultados?» lo explica en la propia interfaz.
- En el chat, el servidor calcula las distancias del itinerario y las marca como
  haversine. No hay rutas, tiempos de conducción ni tráfico.
- La ubicación del usuario solo se solicita tras pulsar «Buscar cerca de mí»
  y no se guarda ni se incluye en la URL.

## Privacidad

- Las coordenadas personales se usan únicamente para la búsqueda en curso.
- No se registran cuerpos de solicitud ni coordenadas en los registros del
  servidor: solo se registran códigos y mensajes de error redactados.
- La clave de IA vive solo en el servidor. No se envía al navegador, no se
  incluye en `/api/config` y no se registra.
- El chat envía datos al proveedor de IA según se describe en
  «Privacidad de la IA». No hay persistencia de conversaciones en el servidor.
- El itinerario se transporta en un token firmado; el servidor no confía en
  coordenadas ni IDs enviados por el navegador.
- Las cuentas usan Supabase Auth. El correo y la contraseña se envían
  directamente a Supabase por HTTPS; la aplicación no ve ni guarda la
  contraseña, y las tablas `profiles` e `itineraries` no contienen credenciales.
- Los itinerarios solo se guardan si la persona pulsa «Guardar itinerario». No
  se guardan conversaciones completas ni el historial del chat.
- Las filas guardadas viven en PostgreSQL con RLS y solo son accesibles para su
  propietario. El navegador usa la clave pública; no se usa `service_role`.
- Los correos de confirmación y recuperación los envía Supabase (con su SMTP
  integrado o el que configures). El proveedor de correo puede conservar datos
  según sus políticas.

## Manejo de errores

| Código | Causa habitual | Qué hacer |
| --- | --- | --- |
| `INVALID_REQUEST` | Texto vacío, categoría desconocida o id inválido. | Corrige la entrada. |
| `RATE_LIMITED` | Ráfaga local desde la misma IP o sesión. | Espera unos segundos. |
| `UPSTREAM_RATE_LIMITED` | Nominatim/Overpass limitaron temporalmente. | Espera unos minutos. |
| `UPSTREAM_TIMEOUT` | El proveedor de mapas tardó demasiado. | Reintenta o acota con una referencia; en búsquedas por categoría el mensaje sugiere usar una ciudad o «Buscar cerca de mí». |
| `UPSTREAM_UNAVAILABLE` | Error temporal del proveedor o respuesta inválida. | Reintenta más tarde. |
| `FORBIDDEN` | El origen no está autorizado o el proveedor bloqueó la solicitud. | Revisa `ALLOWED_ORIGIN` y `OSM_USER_AGENT`. |
| `NETWORK_ERROR` | No hay conexión con el API o el proveedor. | Revisa la red. |
| `PLACE_NOT_FOUND` | El elemento ya no existe en OSM. | Vuelve a buscar. |
| `LOCATION_NOT_FOUND` | La referencia no se encontró en El Salvador. | Prueba otro municipio o departamento. |
| `AI_NOT_CONFIGURED` | Falta `AI_API_KEY` o el chat está deshabilitado. | Configura el proveedor en el servidor. |
| `AI_UNAVAILABLE` | El proveedor rechazó la solicitud, falló la red o devolvió un error. | Reintenta; revisa modelo, clave y saldo. |
| `AI_RATE_LIMITED` | El proveedor limitó la cuota temporalmente. | Espera y reintenta. |
| `AI_TIMEOUT` | El proveedor o el turno completo superaron el tiempo máximo. | Reintenta o acorta la petición. |
| `AI_BAD_RESPONSE` | El modelo no devolvió el formato esperado. | Reintenta; si persiste, cambia de modelo. |
| `CHAT_BUSY` | Se alcanzó la concurrencia máxima de la instancia. | Reintenta en unos segundos. |
| `INTERNAL` | Fallo inesperado del servidor. | Reintenta; revisa los registros. |

Errores de cuenta e itinerarios (se muestran en español, sin detalles internos):

| Situación | Causa habitual | Qué hacer |
| --- | --- | --- |
| `invalid_credentials` | Correo o contraseña incorrectos. | Revisa los datos; no se revela si el correo existe. |
| `email_not_confirmed` | La cuenta aún no confirmó el correo. | Abre el enlace del correo o solicita uno nuevo. |
| `otp_expired` / `access_denied` | Enlace de confirmación caducado o ya usado. | Inicia sesión o vuelve a registrarte para recibir otro. |
| `over_email_send_rate_limit` | Límite de correos de Supabase. | Espera o configura un SMTP propio. |
| `SESSION_EXPIRED` | El token de sesión venció o se revocó. | Inicia sesión de nuevo. |
| `FORBIDDEN` / error RLS | La política impide acceder a la fila. | Comprueba que la sesión sea la propietaria. |
| `NOT_FOUND` | El itinerario no existe o es de otra cuenta. | Vuelve a la lista; no se revela el contenido ajeno. |
| `VALIDATION_ERROR` | Los campos no cumplen los límites. | Corrige el formulario. |
| `NETWORK_ERROR` | No hay conexión con Supabase. | Revisa la red e intenta de nuevo. |
| `NOT_CONFIGURED` | Faltan las variables públicas de Supabase. | Configura `.env` y reinicia Vite. |

## Pruebas

`npm test` ejecuta la suite completa con respuestas simuladas de Nominatim,
Overpass y del proveedor de IA (marcadas como tales en los archivos de prueba).
Cubre:

- construcción de consultas y clasificación de errores del cliente OSM;
- validación de entradas y filtros de radio;
- mapeo de resultados sin campos inventados (sin fotos ni calificaciones);
- caché, límite por IP, origen permitido y rutas retiradas (`/api/photo`);
- categorías y etiquetas OSM;
- formato de distancias y enlaces a OpenStreetMap;
- configuración y cliente del proveedor de IA, incluyendo timeout, cuota,
  errores, esfuerzo de razonamiento y redacción de credenciales;
- conservación de firmas opacas del proveedor entre rondas de herramientas;
- validación de mensajes, historial, sesión y token de chat;
- herramientas controladas, catálogo de lugares, límites por turno,
  degradación de una búsqueda con categoría a texto si Overpass falla y corte
  de categorías del chat a 10 s sin reintentos;
- plazo duro del turno aunque el proveedor o una herramienta no respondan;
- construcción, filtrado y firma HMAC de itinerarios;
- endpoints `/api/chat` y `/api/config` con IA simulada;
- cliente frontend del chat y utilidades de formato;
- validación de correo, contraseña y nombre, redirecciones internas y detección
  de errores de confirmación en el fragmento de URL;
- llamadas del servicio de Auth (registro, login, logout, recuperación y
  actualización de contraseña) con un cliente simulado;
- repositorio de itinerarios: lista, alta, lectura, actualización y borrado
  filtrando por propietario, clasificación de errores de RLS/sesión/red y
  rechazo de IDs inválidos;
- validación y mapeo del itinerario del chat a la fila de PostgreSQL, límites,
  distancias y actualización de paradas;
- comprobaciones estáticas de la migración: RLS activo, políticas del
  propietario, grants mínimos, trigger de perfil, restricciones e índices;
- prueba de seguridad del código fuente y del bundle para evitar secretos.

Las pruebas **no** consultan servicios reales ni usan claves reales: son
deterministas y no consumen cuota comunitaria ni de IA. `npm run check:bundle`
revisa la compilación de producción en busca de la clave de IA y de la
`service_role`.

Verificación manual de esta entrega (octubre de 2026): además de la suite con
simulaciones, se probó el flujo completo con un proveedor de IA **real** (Gemini,
modelo `gemini-3.5-flash-lite`, endpoint compatible con OpenAI) y búsquedas
**reales** en Nominatim:

- «Busca Playa El Tunco y recomiéndame una visita» devolvió la ficha real
  `osm-relation-8387304`, con dirección de OSM y sin calificaciones, reseñas,
  fotos ni precios inventados.
- Un plan de un día desde San Salvador para 2 personas con 80 USD total devolvió
  dos playas reales (`osm-node-9357298883` y `osm-node-1547514350`), origen
  geolocalizado, distancias en línea recta, estimaciones marcadas, advertencias
  y token firmado.
- «Mantén el plan, pero quita la segunda parada» conservó la primera parada, el
  origen, las personas y el presupuesto.

En la prueba de navegador se detectó que el modelo podía proponer una fecha no
solicitada. Se añadió una validación de servidor que solo acepta fechas
mencionadas en el mensaje actual y se repitió el flujo: el plan quedó sin fecha,
sin datos inventados. También se comprobó en la interfaz la acción «Quitar
última», que conservó la primera parada, el origen, las personas y el
presupuesto, y volvió a mostrar el mapa y las advertencias.

Las consultas por categoría con Overpass no se pudieron validar contra el
servidor público en esta sesión porque devolvió 502/503/timeouts. Si Overpass
falla y la consulta incluye un nombre, la herramienta del chat reintenta por
texto con Nominatim. La suite automatizada sigue usando simulaciones y no
consume cuota.

Verificación manual de la Fase 5 (20 de octubre de 2026) contra el proyecto real
de Supabase y un buzón temporal:

- El registro creó la cuenta y envió el correo de confirmación. El enlace
  redirigió a `/cuenta/iniciar-sesion?confirmado=1`, Supabase inició la sesión y
  la interfaz mostró «Tu cuenta está lista». La pantalla «Continuar» llevaba a
  una ruta inexistente (`/itineraries`); se corrigió a `/itinerarios` y se añadió
  una prueba que comprueba que la ruta por defecto existe.
- Al reabrir el mismo enlace, Supabase devolvió `otp_expired`. Antes la app
  mostraba un éxito falso porque solo miraba `?confirmado=1`; ahora detecta
  `error_code` en el fragmento y muestra «No pudimos confirmar tu correo», tanto
  con sesión activa como cerrada.
- Se generó un itinerario real con Gemini y Nominatim usando tres lugares
  concretos, se guardó desde el chat y se comprobó el detalle. Después se editó
  el título, se reordenaron paradas, se quitó una y se añadió otra con búsqueda
  real en OSM; los cambios y las distancias se guardaron.
- Se verificaron lista, borrado con diálogo de confirmación, cierre de sesión,
  inicio de sesión posterior y restauración de la sesión tras recargar.
- Con una petición vaga de categoría, Overpass devolvió 503/timeout y el modelo
  agotó las rondas de herramientas; el API respondió `AI_BAD_RESPONSE` (502).
  Con nombres concretos y búsquedas por Nominatim el flujo funcionó. Es una
  limitación de disponibilidad de la fuente y del comportamiento del modelo, no
  un éxito simulado.
- No se pudo crear un segundo usuario para la prueba cruzada de RLS remota: el
  correo integrado de Supabase devolvió `429 over_email_send_rate_limit` al
  segundo registro. La prueba SQL de dos usuarios queda pendiente de ejecutarse
  contra PostgreSQL local; Docker Desktop no estaba en ejecución. Las tablas
  remotas sí respondieron a `anon` con `permission denied`, coherente con los
  grants y RLS.

## Despliegue en Vercel

1. Aplica la migración de la Fase 5 al proyecto de Supabase de producción
   (`supabase db push` o SQL Editor) antes de abrir el registro.
2. Importa el repositorio en Vercel; el proyecto detecta Vite y las funciones
   de `api/` automáticamente.
3. En Vercel, define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los
   valores públicos del proyecto. Se incorporan al bundle en el build; si los
   cambias, vuelve a desplegar.
4. Define `OSM_USER_AGENT` con un contacto real y, si aplica,
   `ALLOWED_ORIGIN`.
5. Define `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_PROVIDER_NAME` y un
   `CHAT_SIGNING_SECRET` estable (mínimo 16 caracteres).
6. No configures secretos con el prefijo `VITE_`: Vite los expondría al
   navegador. La clave de IA y la `service_role` solo pueden vivir en un backend
   de confianza; esta app no necesita la segunda.
7. En Supabase, actualiza **Authentication > URL Configuration** con el dominio
   de producción como Site URL y añade las Redirect URLs exactas:
   `https://tu-dominio/cuenta/iniciar-sesion` y
   `https://tu-dominio/cuenta/restablecer`. Si usas previews de Vercel, añade
   también sus dominios o un patrón controlado; no dejes redirects abiertos.
8. Configura un SMTP propio en Supabase si va a haber registro público. El
   correo integrado tiene un límite muy bajo y puede devolver
   `over_email_send_rate_limit`.
9. Verifica `GET /api/config` en el dominio desplegado: debe indicar
   `chat.enabled: true` sin mostrar la clave, y prueba registro, confirmación,
   login y guardado contra el proyecto real.
10. Prueba un turno real del chat y confirma el costo/uso en el panel de tu
    proveedor.

Notas:

- `vercel.json` fija `maxDuration: 30` para las funciones de `api/`: permite
  esperar a Overpass (20 s), al proveedor de IA (15 s por llamada) y devolver un
  error clasificado. El presupuesto total del turno de chat es 27 s por defecto.
- La caché, los límites por IP/sesión y la concurrencia viven en memoria: cada
  instancia de función tiene los suyos. No son límites globales.
- `CHAT_SIGNING_SECRET` debe ser el mismo en todas las instancias para que los
  itinerarios firmados sigan siendo válidos. Si se omite, se deriva de
  `AI_API_KEY`; rotar esa clave invalida los itinerarios abiertos.
- Si usas Ollama u otro modelo local, Vercel no puede alcanzar tu
  `localhost`; usa un proveedor accesible por HTTPS o un despliegue propio.
- Los costos de IA dependen del proveedor, modelo, tokens de entrada/salida y
  volumen. No hay un costo máximo absoluto garantizado por esta aplicación.
- Si una búsqueda por categoría en todo el país tarda demasiado, el usuario
  puede acotarla con «Buscar cerca de mí» o una ciudad de referencia.
- Para tráfico alto, cambia `OSM_TILE_URL` a un proveedor con SLA.

## Estructura del proyecto

```
api/               funciones serverless de Vercel (config, search, place, locate, chat)
server/            API: handlers, validación, errores, límites, caché,
                   cliente de Nominatim/Overpass, cliente de IA, herramientas,
                   validación del chat, prompt e itinerarios firmados
shared/            categorías, etiquetas OSM y límites/sugerencias del chat
supabase/          config.toml local, migraciones versionadas y prueba SQL de RLS
src/               interfaz React: páginas, componentes, hooks y servicios
  components/auth/        layouts, mensajes y protección de rutas
  components/chat/        botón, panel, tarjetas de lugares e itinerario
  components/itineraries/ tarjetas, vista y editor de paradas
  context/                sesión de Supabase Auth
  services/               cliente público, Auth, perfiles, itinerarios y chat
  utils/                  validaciones, rutas y redirecciones seguras
public/            archivos estáticos
```

## Accesibilidad y experiencia

- Formularios con etiquetas, estados `aria-live` y foco visible.
- El chat es un diálogo con trampa de foco, cierre con Escape y retorno del foco
  al botón flotante.
- **Enter envía** y **Shift+Enter** crea una línea nueva; también funciona el
  botón de envío y las sugerencias.
- Estados de carga con cancelación, error con reintento/descarte y opción de
  iniciar una conversación nueva.
- Mensajes de error y estados vacíos descriptivos, sin `window.alert`.
- Las tarjetas y el itinerario muestran solo datos reales; las estimaciones y
  distancias en línea recta están marcadas como tales.
- Leaflet y las teselas se descargan solo cuando hay un mapa que mostrar (mini
  mapa de resultados, detalle o itinerario); la atribución permanece visible.
- Diseño responsivo conservado de fases anteriores, incluido el mapa compacto
  del itinerario.

## Limitaciones conocidas y pendientes

- **Sin fotos ni calificaciones**: OpenStreetMap no las ofrece. Si se quieren
  añadir, habría que integrar una fuente con licencia compatible (Wikimedia
  Commons, Mapillary) con su propia atribución.
- **Horario sin interpretación**: se muestra el texto de la etiqueta
  `opening_hours` tal cual; no se calcula «abierto ahora».
- **Cobertura variable**: depende de la comunidad de OpenStreetMap.
- **Nominatim no es un buscador de POIs por categoría**: para eso están las
  categorías y Overpass.
- **Overpass público puede estar al límite de capacidad**: en esta red llegó a
  responder con 502 o a tardar más de 25 s. Las búsquedas por nombre siguen
  funcionando con Nominatim y el chat corta las búsquedas por categoría a 10 s:
  si fallan, no reintenta y pide un lugar concreto en vez de quedarse esperando.
  Para uso continuado, configura `OVERPASS_URL` con una instancia propia o de
  confianza. También se prioriza IPv4 para evitar rutas IPv6 colgadas en algunas
  redes.
- **IA real verificada con un proveedor y modelo concretos**: en esta entrega se
  probó Gemini con `gemini-3.5-flash-lite`; otros proveedores, modelos o cuentas
  pueden cambiar latencia, cuota y calidad. Los planes gratuitos suelen imponer
  límites por minuto o por día y pueden devolver `AI_RATE_LIMITED` o
  `AI_UNAVAILABLE`; no son fallos de la aplicación.
- **La IA puede equivocarse**: el servidor filtra IDs y valida el itinerario,
  pero el texto libre del asistente puede contener imprecisiones. Los avisos de
  la interfaz recuerdan confirmar horarios, precios, disponibilidad y condiciones.
- **Sin datos en tiempo real**: no se consultan clima, seguridad, cierres,
  eventos, tráfico ni disponibilidad.
- **Sin rutas por carretera**: solo distancias en línea recta; no hay tiempos de
  conducción ni orden óptimo.
- **Historial solo en el navegador**: recargar la página inicia una conversación
  nueva. El servidor no guarda conversaciones.
- **Tokens de itinerario**: caducan a las 12 h por defecto; tras ese tiempo el
  servidor ignora el plan anterior.
- **Límites en memoria**: IP, sesión y concurrencia no son globales entre
  instancias serverless.
- **Correo integrado de Supabase**: el plan gratuito limita los envíos (la
  configuración local documenta 2 por hora). Para registro público, confirmación
  y recuperación fiables, configura un SMTP propio. Mientras tanto, un segundo
  registro puede devolver `over_email_send_rate_limit`; no es un fallo de la UI.
- **Confirmación y redirects**: dependen de la configuración del panel de
  Supabase. Si el dominio no está en Site URL/Redirect URLs, el enlace puede
  volver a otra ruta. En local se puede usar Inbucket; en producción, SMTP real.
- **Prueba RLS remota entre dos usuarios**: pendiente en esta sesión porque el
  límite de correo impidió crear el segundo usuario. La prueba SQL incluida debe
  ejecutarse contra PostgreSQL local o un entorno de desarrollo con Docker.
- **Sin cambio de correo ni borrado de cuenta en la interfaz**: el correo es de
  solo lectura y la baja de cuenta se gestiona fuera de la app. Tampoco hay
  cambio de contraseña desde la cuenta (solo desde el flujo de recuperación).
- **Itinerario guardado como copia**: guardar de nuevo crea otra fila; no hay
  sincronización automática con cambios posteriores del chat ni edición
  colaborativa.
- Pendientes manuales: crear `.env` con contacto real, clave de IA y credenciales
  públicas de Supabase; aplicar la migración; configurar Site URL, redirects y
  SMTP en Supabase; elegir proveedor de teselas para producción; definir
  `CHAT_SIGNING_SECRET`; ejecutar la prueba RLS; publicar términos de uso y
  política de privacidad; y validar el despliegue con tráfico real.
