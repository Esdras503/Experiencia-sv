# Presupuestos estimados (Fase 8)

Este documento describe el presupuesto inteligente de Experiencia SV: qué se
calcula, con qué fórmulas, dónde se guarda, cómo se actualizan los precios y qué
pruebas se ejecutaron. La regla principal es simple: **la IA redacta el viaje; el
backend calcula el dinero**.

## 1. Alcance y principios

- Todos los importes se calculan en el servidor con aritmética entera en centavos.
- El navegador puede enviar personas, días, transporte, comida y hospedaje, pero
  **no puede enviar precios**: los precios enviados por el cliente se descartan.
- Los precios verificados solo salen del catálogo administrativo de entradas.
  Todo lo demás se marca como estimado o sin verificar.
- El presupuesto calculado es independiente del campo `budget` del itinerario.
  Ese campo sigue siendo el **límite declarado por la persona** y no se
  sobrescribe.
- Se usa OpenStreetMap. OSRM es opcional: si no está disponible, la distancia se
  estima en línea recta con un factor de carretera y se marca la limitación.
- Una estimación no es una cotización, no confirma disponibilidad y no inventa
  horarios, reseñas, fotos ni precios de proveedores.

## 2. Datos que se recopilan

El chat y el panel piden o infieren:

| Dato | Uso |
| --- | --- |
| Personas y niños | Reparto de costos compartidos y tarifas adulto/infantil. |
| Fecha y días | Duración, alimentación y noches. |
| Destinos y coordenadas | Distancia, ruta, entradas y actividades. |
| Transporte | Vehículo particular o transporte público. |
| Comida | Económica, estándar o premium. |
| Hospedaje | Incluir o no, noches y nivel. |
| Límite máximo | Comparación con el rango estimado; no es un precio. |

Si faltan datos críticos, el chat los pregunta o usa valores explícitamente
configurables. Si faltan coordenadas, el cálculo sigue y muestra una advertencia;
no se inventa una ubicación. Si falta el precio de una entrada, se muestra
**«Precio no verificado»** y un rango, nunca se asume que la entrada es gratis.

## 3. Fórmulas y valores por defecto

Los valores iniciales viven en `shared/budget.js` y deben coincidir con la
migración `20261117000000_phase8_budget_estimates.sql`.

### 3.1 Ruta y distancia

- OSRM devuelve distancia y duración reales de la ruta, incluyendo el regreso al
  origen cuando el itinerario define uno.
- Si OSRM falla, se usa la suma de distancias Haversine. La distancia estimada se
  multiplica por `roadFactor` (por defecto `1.25`).
- La duración de respaldo usa `averageSpeedKmh` (por defecto `45 km/h`).
- Los resultados de OSRM se guardan en caché para no repetir llamadas.

### 3.2 Transporte particular

```text
litros            = (distancia_km × consumo_l/100km) / 100
combustible       = litros × precio_por_litro × (1 + margen_seguridad/100)
transporte        = combustible + estacionamiento_por_día × días
                    + peajes_por_día × días
```

Valores iniciales: `$1.05/L`, `8.5 L/100 km`, margen `10%`, parqueo `$3/día`,
peajes `$0/día`. **El combustible nunca se presenta como el costo total del
transporte**: se suman parqueo y peajes, y se muestra el detalle.

### 3.3 Transporte público

```text
costo_tramo_persona = max(tarifa_mínima_por_tramo,
                          round(distancia_tramo_km × tarifa_por_km))
transporte          = suma(costo_tramo_persona) × personas
```

Valores iniciales: `$0.04/km/persona` y mínimo `$0.30` por tramo. Las tarifas son
editables y el resultado se marca como aproximado.

### 3.4 Alimentación

```text
comida = (desayuno + almuerzo + cena + refrigerio) × personas × días
```

Hay tres niveles con precios administrables. Valores iniciales por persona y día:

| Nivel | Desayuno | Almuerzo | Cena | Refrigerio | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Económico | $2.50 | $4.00 | $3.50 | $1.50 | $11.50 |
| Estándar | $4.00 | $7.00 | $6.00 | $2.00 | $19.00 |
| Premium | $7.00 | $14.00 | $12.00 | $3.00 | $36.00 |

No se usan precios de restaurantes específicos.

### 3.5 Entradas y actividades

- El catálogo guarda precio adulto, infantil, grupal, actividad, moneda, fuente,
  fecha de verificación y estado (`verified`, `estimated`, `unverified`).
- `verified` exige fuente y fecha; el precio verificado se usa sin rango.
- `estimated` usa el precio del catálogo con el rango configurado.
- Sin precio o sin registro se usa el rango configurable por persona y parada
  (`$0–$10` por defecto) y se muestra `Precio no verificado` con advertencia.
- Si hay tarifa grupal aplicable, se usa una sola vez para el grupo.
- Si no hay tarifa infantil, se usa la adulta y se deja una nota.
- Las actividades suman un fondo configurable (`$5/persona/día` por defecto) más
  los precios de actividad del catálogo.

### 3.6 Hospedaje

```text
hospedaje = tarifa_por_persona_noche × personas × noches
```

Solo se calcula si se activa hospedaje y hay noches. Valores iniciales por persona
y noche: económico `$18`, estándar `$35`, premium `$70`. No se inventa
disponibilidad ni se presentan tarifas confirmadas.

### 3.7 Extras, rango y reparto

```text
extras        = subtotal × porcentaje_extras / 100
total         = subtotal + extras
por_persona   = round(total / personas)
por_día       = round(total / días)
```

Por defecto: extras `10%` y rango de estimación `±10%`. Los costos compartidos
—transporte, parqueo y peajes— se calculan una sola vez para el grupo y luego se
incluyen en el total antes de dividir; no se duplican por persona. Los costos
verificados no se inflan con el rango.

## 4. Verificación y transparencia

Cada categoría incluye `verification` (`verified`, `estimated`, `unverified` o
`mixed`), fuente y notas. La respuesta también incluye:

- `totals`: total, por persona y por día, en mínimo y máximo.
- `breakdown`: desglose por transporte, alimentación, entradas, actividades,
  hospedaje y extras.
- `route`: distancia, duración, fuente (`osrm`, `haversine-estimate` o `none`) y
  tramos.
- `verification`: cuántas entradas están verificadas, estimadas o sin verificar.
- `budgetComparison`: comparación con el límite declarado.
- `assumptions` y `warnings`: supuestos explícitos, coordenadas faltantes,
  precios sin verificar, respaldo de ruta y cruces del límite.
- `entranceItems`: detalle por parada, con fuente y fecha si existen.

Solo las entradas del catálogo con estado `verified` y fecha se marcan como
verificadas. Las demás categorías, incluidas las tarifas de referencia
administrables, se presentan como estimadas.

## 5. API

Todas las rutas viven bajo `/api` y usan el token de sesión en
`Authorization: Bearer <access_token>` cuando se requiere propietario.

| Método | Ruta | Uso |
| --- | --- | --- |
| `POST` | `/api/budget/calculate` | Calcula y opcionalmente guarda. Acepta `persist: false`. |
| `GET` | `/api/budget/history?itineraryId=&limit=` | Historial del propietario autenticado. |
| `GET` | `/api/admin/budget` | Configuración y catálogo completo (admin). |
| `PUT` | `/api/admin/budget/settings` | Actualiza tarifas globales (admin). |
| `POST` | `/api/admin/budget/entrances` | Crea o actualiza una entrada (admin). |
| `DELETE` | `/api/admin/budget/entrances` | Elimina una entrada por `id` (admin). |

`POST /api/budget/calculate` valida el itinerario y las opciones, rechaza precios
enviados por el cliente, reutiliza la distancia y guarda un historial solo cuando
`persist` es verdadero y hay almacenamiento configurado. La UI del chat usa
`persist: false`; una recalculación explícita en un itinerario guardado persiste
cuando la persona está autenticada.

## 6. Base de datos

Migración: `supabase/migrations/20261117000000_phase8_budget_estimates.sql`.

| Tabla | Contenido | Acceso |
| --- | --- | --- |
| `budget_settings` | Una sola fila con combustible, consumo, margen, parqueo, peajes, transporte público, velocidad, factor de carretera, comidas, hospedaje, actividades, extras y rango. | Solo `service_role`. RLS activo, sin permisos de cliente. |
| `budget_entrance_prices` | Catálogo de entradas y actividades con precios adulto/infantil/grupal/actividad, moneda, fuente, fecha y estado. | Solo `service_role`. RLS activo, sin permisos de cliente. |
| `budget_estimates` | Cabecera del cálculo: propietario, itinerario opcional, título, personas, días, opciones, totales, distancia, ruta, supuestos, advertencias y copia de tarifas. | El propietario autenticado solo puede leer sus filas. El backend escribe con `service_role`. |
| `budget_estimate_items` | Desglose por categoría asociado a una estimación. | El propietario solo puede leer los elementos de sus estimaciones. El backend escribe con `service_role`. |

La migración incluye restricciones de importes no negativos, coherencia de
mínimo/máximo, personas y días, índices para historial y catálogo, triggers de
`updated_at`, permisos explícitos para `service_role` y políticas RLS de solo
lectura para el propietario. `itinerary_id` es nullable y usa
`on delete set null` para conservar el historial si se elimina el itinerario.
Los importes se guardan en centavos enteros y `pricing_snapshot` conserva las
tarifas usadas en el momento del cálculo.

## 7. Administración y actualización de precios

1. Aplicar la migración de Fase 8 en Supabase.
2. Configurar `SUPABASE_SERVICE_ROLE_KEY` solo en el backend.
3. Definir `ADMIN_EMAILS` y/o `ADMIN_USER_IDS` (lista separada por comas).
4. Iniciar sesión con una cuenta incluida en la lista.
5. Abrir `/admin/presupuestos` directamente. La ruta está protegida por
   `RequireAuth` y por la lista de administradores del servidor; no se enlaza en
   la navegación pública.
6. Editar tarifas globales o entradas y guardar. La caché de tarifas se invalida
   al guardar.
7. Para marcar una entrada como verificada, indicar fuente y fecha de
   verificación. Sin ambos datos, el backend rechaza el estado `verified`.
8. Revisar el cambio en un cálculo de prueba. Después del TTL
   (`BUDGET_PRICING_TTL_MS`, 5 minutos por defecto) las instancias que no hayan
   recibido la invalidación también recargan la configuración.

Sin `SUPABASE_SERVICE_ROLE_KEY`, la administración responde
`BUDGET_NOT_CONFIGURED` y no se guarda historial. El cálculo público sigue
funcionando con los valores de referencia de `shared/budget.js` y lo indica con
`pricingSource: "defaults"` y `storage: "none"`.

## 8. Integración con la IA y la interfaz

- La IA genera el itinerario y puede ajustar paradas, transporte, comida,
  hospedaje y el límite declarado.
- El prompt prohíbe expresamente calcular o inventar precios y emitir
  `budgetEstimate`; el servidor calcula después de construir o modificar el plan.
- El itinerario firmado guarda un resumen compacto para dar contexto al siguiente
  turno. La estimación completa se devuelve aparte.
- Si el cálculo falla o supera el tiempo reservado, el chat responde igualmente y
  agrega `budgetWarning`; nunca se pierde la respuesta por un presupuesto.
- El panel muestra total, por persona, por día, desglose, gráfico de distribución,
  insignias verificado/estimado/sin verificar, distancia, tiempo, controles de
  personas/transporte/comida/hospedaje, advertencias, supuestos y comparación.
- En el itinerario guardado se calcula automáticamente y se puede descargar en PDF
  mediante la impresión del navegador (`Descargar PDF`).
- El chat permite pedir «más económico», cambiar transporte o comida y ajustar el
  límite; el backend vuelve a calcular y compara contra el nuevo límite.

## 9. Variables de entorno

| Variable | Uso | Valor sugerido |
| --- | --- | --- |
| `OSRM_URL` | Servidor OSRM opcional. | `https://router.project-osrm.org` |
| `OSRM_TIMEOUT_MS` | Tiempo máximo de OSRM. | `5000` |
| `OSRM_CACHE_TTL_MS` | TTL de rutas en caché. | `1800000` |
| `OSRM_USER_AGENT` | Identificación ante OSRM; si falta se usa `OSM_USER_AGENT`. | Contacto real |
| `ADMIN_EMAILS` | Correos autorizados para administrar tarifas. | Lista separada por comas |
| `ADMIN_USER_IDS` | UUIDs de `auth.users` autorizados. | Lista separada por comas |
| `BUDGET_PRICING_TTL_MS` | TTL de tarifas en caché (30 s–1 h). | `300000` |
| `CHAT_BUDGET_TIMEOUT_MS` | Tiempo reservado al presupuesto dentro del chat (1–6 s). | `4000` |
| `BUDGET_RATE_LIMIT_PER_MINUTE` | Límite de cálculos por IP. | `30` |
| `BUDGET_ADMIN_RATE_LIMIT_PER_MINUTE` | Límite de administración por IP. | `20` |

También se requieren `SUPABASE_URL`/`VITE_SUPABASE_URL`,
`SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` para cuentas, administración y persistencia. La
`service_role` es secreta y nunca debe usar el prefijo `VITE_` ni llegar al
navegador.

## 10. Archivos principales

Nuevos:

- `shared/budget.js`: etiquetas, valores por defecto y resumen compacto.
- `server/budget/estimator.js`: cálculo determinista.
- `server/budget/validation.js`: validación de itinerario, opciones y admin.
- `server/budget/routeService.js`: cliente OSRM opcional, caché y respaldo.
- `server/budget/repository.js`: Supabase, autorización y persistencia.
- `server/budget/budgetService.js`: orquestación y caché de tarifas.
- `server/budget/*.test.js`: pruebas del backend.
- `server/budgetHandlers.test.js`: pruebas de rutas HTTP y errores.
- `src/services/budgetService.js`: cliente del API.
- `src/components/budget/BudgetPanel.jsx`: panel reutilizable y responsivo.
- `src/pages/BudgetAdminPage.jsx`: administración de tarifas y catálogo.
- `api/budget/calculate.js`, `api/budget/history.js`: entradas serverless.
- `api/admin/budget/index.js`, `api/admin/budget/settings.js`,
  `api/admin/budget/entrances.js`: entradas serverless de administración.
- `supabase/migrations/20261117000000_phase8_budget_estimates.sql`: esquema.
- `supabase/phase8-migration.test.js`: comprobaciones estáticas de la migración.
- `supabase/tests/phase8_budget_rls.sql`: prueba SQL de dos usuarios y RLS.

Modificados:

- `server/handlers.js`: rutas, límites, `/api/config` e inyección del servicio.
- `server/chatService.js`: presupuesto después del itinerario, timeout y aviso.
- `server/chatItinerary.js`: `durationDays`, `budgetOptions` y resumen firmado.
- `server/chatPrompt.js`: reglas para no inventar precios y ajustar preferencias.
- `server/errors.js`: códigos `BUDGET_NOT_CONFIGURED`, `BUDGET_UNAVAILABLE` y
  `ADMIN_FORBIDDEN`.
- `src/components/chat/ChatWidget.jsx`, `ChatPanel.jsx`, `ChatItinerary.jsx`:
  estado, paso de la estimación y panel.
- `src/components/itineraries/ItineraryView.jsx`: cálculo automático y PDF.
- `src/pages/ItineraryDetailPage.jsx`: acción de impresión.
- `src/services/itineraryPayload.js`: persistencia de `budgetOptions`.
- `src/App.jsx`, `src/utils/routes.js`: ruta protegida de administración.
- `src/App.css`: estilos responsivos, panel, admin e impresión.
- `.env.example`: variables de la Fase 8.
- `README.md`: enlace y resumen de la Fase 8.

Pruebas modificadas o añadidas:

- `server/chatHandlers.test.js`, `server/chatItinerary.test.js` y
  `server/chatService.test.js`: presupuesto en el chat, recálculo tras cambiar
  personas/límite/transporte/comida y tolerancia a fallos.
- `src/services/itineraryPayload.test.js` y `src/utils/routes.test.js`:
  restauración de opciones y ruta de administración.

## 11. Pruebas y resultados

Automatizadas:

- `npm test`: **304 pruebas, 304 aprobadas, 0 fallidas**.
- Cobertura específica de presupuesto: 1 persona/1 día, 4 personas/1 día, 3 días
  con hospedaje, vehículo particular, transporte público, entradas verificadas,
  entradas sin precio, cambio de presupuesto máximo, recálculo tras cambiar
  personas, respaldo Haversine, falta de coordenadas, persistencia, ownership,
  fallos de almacenamiento, rutas HTTP, migración y RLS estática.
- Chat: cálculo del presupuesto tras generar/modificar el itinerario, recálculo
  tras cambiar personas, límite, transporte y comida, y fallo del cálculo sin
  perder la respuesta.
- `npm run lint`: sin errores.
- `npm run build`: compilación correcta.
- `npm run check:bundle`: sin secretos de servidor en el bundle.

QA manual en navegador local:

- Chat real con Gemini + OpenStreetMap: itinerario de un día para 2 personas,
  presupuesto `$68.09–$127.23`, desglose y advertencias visibles.
- Seguimiento «Hazlo más económico» con transporte público y comida económica:
  bajó a `$47.00–$101.45` y mantuvo las dos paradas.
- Itinerario guardado: cálculo automático, recálculo de 2 a 4 personas
  (`$28.90–$57.33` por persona), ruta OSRM, mapa Leaflet y botón PDF.
- `/admin/presupuestos` sin `service_role`: muestra error controlado
  `BUDGET_NOT_CONFIGURED`, sin filtrar datos ni romper la sesión.
- Login, mapas de OpenStreetMap y chat existentes siguieron funcionando.

Limitaciones de esta ejecución:

- La migración de Fase 8 aún no se aplicó a la base remota y no hay PostgreSQL ni
  Docker local; la prueba SQL de RLS quedó preparada, pero no se ejecutó contra
  una base real.
- No hay `SUPABASE_SERVICE_ROLE_KEY` local, por lo que la administración real, el
  historial persistido y los precios verificados de Supabase no se pudieron
  verificar de extremo a extremo en este entorno.
- El «PDF» usa la impresión del navegador; no se genera un archivo PDF en el
  servidor.

## 12. Puesta en marcha

1. Aplicar la migración con Supabase CLI o el editor SQL.
2. Configurar las variables de entorno del backend y redesplegar sin caché.
3. Iniciar sesión con una cuenta de `ADMIN_EMAILS`/`ADMIN_USER_IDS` y abrir
   `/admin/presupuestos`.
4. Revisar tarifas, fuentes y fechas; guardar.
5. Calcular un itinerario de prueba y confirmar que las entradas verificadas
   muestran la insignia correspondiente.
6. Si se usa Vercel, recordar que las variables públicas de Vite se incorporan en
   el build: cambiar `VITE_DEMO_MODE`/`DEMO_MODE` exige un redespliegue sin caché.
