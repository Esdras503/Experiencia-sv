# Manual de usuario — Experiencia SV

**Versión:** 1.1 · Fase 6  
**Fecha:** 26 de octubre de 2026  
**Sitio:** <https://experiencia-sv-eight.vercel.app>

Experiencia SV es una aplicación web para descubrir lugares de El Salvador con
datos abiertos de **OpenStreetMap** y un **asistente de viajes con IA**. Puedes
explorar, buscar y conversar sin crear una cuenta. La cuenta solo es necesaria
para guardar y administrar itinerarios. La página **Planes** explica los precios
y límites; el pago todavía no está habilitado en esta versión.

> OpenStreetMap es una fuente colaborativa: la información puede estar
> incompleta o desactualizada. La aplicación no inventa lugares, fotos,
> calificaciones, precios ni horarios.

## Inicio rápido

1. Escribe un lugar en **«¿A dónde quieres ir?»** y pulsa **Buscar**.
2. Abre una tarjeta con **Ver detalle** para consultar la información y el mapa.
3. Pulsa el botón **✳** para pedir recomendaciones o un itinerario al asistente.
4. Si quieres conservar el plan, crea una cuenta o inicia sesión.
5. Pulsa **Guardar itinerario** en el chat.
6. Entra a **Mis itinerarios** para abrirlo, editarlo o eliminarlo.

---

## Índice

1. [Antes de empezar](#1-antes-de-empezar)
2. [La pantalla de inicio](#2-la-pantalla-de-inicio)
3. [Buscar y explorar lugares](#3-buscar-y-explorar-lugares)
4. [Ver la ficha de un lugar](#4-ver-la-ficha-de-un-lugar)
5. [Usar el asistente de viajes](#5-usar-el-asistente-de-viajes)
6. [Crear una cuenta e iniciar sesión](#6-crear-una-cuenta-e-iniciar-sesión)
7. [Tu cuenta](#7-tu-cuenta)
8. [Guardar y administrar itinerarios](#8-guardar-y-administrar-itinerarios)
9. [Planes, límites y pago](#9-planes-límites-y-pago)
10. [Datos, límites y recomendaciones](#10-datos-límites-y-recomendaciones)
11. [Problemas frecuentes](#11-problemas-frecuentes)
12. [Privacidad y seguridad](#12-privacidad-y-seguridad)
13. [Preguntas frecuentes](#13-preguntas-frecuentes)
14. [Glosario](#14-glosario)
15. [Anexo para administradores](#15-anexo-para-administradores)

---

## 1. Antes de empezar

### Qué necesitas

- Un navegador actualizado: Chrome, Edge, Firefox o Safari.
- Conexión a Internet.
- No hace falta instalar ninguna aplicación.
- La cuenta es **opcional** para explorar y usar el chat.
- La ubicación del dispositivo solo se solicita si pulsas **«Buscar cerca de mí»**.

### Qué puedes hacer sin cuenta

- Buscar lugares por nombre, municipio, departamento o categoría.
- Consultar la ficha de un lugar y su mapa.
- Hablar con el asistente y pedir recomendaciones o un itinerario.
- Ver las paradas, distancias y estimaciones del itinerario sugerido.
- Consultar precios, límites y condiciones en **Planes**.

### Qué necesitas una cuenta para hacer

- Guardar un itinerario del chat.
- Volver a abrir tus itinerarios guardados.
- Editar, reordenar, ampliar o eliminar un itinerario.
- Cambiar tu nombre visible.

---

## 2. La pantalla de inicio

La cabecera tiene estos accesos:

- **Inicio:** vuelve al comienzo de la página.
- **Categorías:** baja a la sección para elegir un tipo de lugar.
- **Destinos:** baja a la zona de búsqueda y resultados.
- **Planes:** abre `/planes` con precios, límites y el pase de 7 días.
- **Iniciar sesión** o **Mi cuenta:** abre el acceso a tu cuenta.
- **Explorar lugares:** lleva a la sección de búsqueda.

En la página principal encontrarás:

1. El buscador **«¿A dónde quieres ir?»**.
2. Las categorías de lugares.
3. La zona de resultados y el mapa.
4. El botón flotante del asistente, abajo a la derecha, con el símbolo **✳**.

La web se adapta a teléfonos, tabletas y computadoras. El botón del asistente
sigue disponible mientras navegas por las distintas secciones.

---

## 3. Buscar y explorar lugares

### 3.1 Buscar por texto

1. Escribe en **«¿A dónde quieres ir?»** un nombre, municipio o departamento.
   Ejemplos: `Playa El Tunco`, `Suchitoto`, `San Salvador`, `Ruta de las Flores`.
2. Pulsa **Buscar** o presiona **Enter**.
3. Espera mientras se consulta OpenStreetMap.
4. Abre un resultado con **Ver detalle**.

Puedes borrar el texto con el botón **×** del buscador.

### 3.2 Buscar por categoría

En **«¿Qué te gustaría descubrir?»** puedes elegir:

- Todos
- Playas
- Lagos y lagunas
- Volcanes y montañas
- Parques y naturaleza
- Sitios históricos y culturales
- Restaurantes
- Hoteles y alojamientos

Puedes combinar una categoría con una búsqueda de texto. Por ejemplo, escribe
`Santa Ana` y elige **Restaurantes** para buscar restaurantes en esa zona.

### 3.3 Buscar cerca de una ubicación

La sección **Radio** permite limitar los resultados a **5, 10, 25 o 50 km**.
Primero debes indicar una referencia:

- **Buscar cerca de mí:** solicita permiso al navegador para usar tu ubicación.
  Si lo rechazas, puedes usar una ciudad.
- **Usar ciudad:** escribe una ciudad o municipio con al menos 3 caracteres y
  pulsa **Usar ciudad**.
- **Quitar ubicación:** elimina la referencia y el límite por radio.

La ubicación se usa solo para esa búsqueda y no se guarda. Las distancias que
muestra la aplicación son **en línea recta**, no por carretera.

### 3.4 Leer los resultados

Cada tarjeta puede mostrar el nombre, la categoría, la dirección y la distancia
cuando hay una referencia. Desde la tarjeta puedes abrir **Ver detalle**.

El **Mapa de resultados** muestra marcadores de los lugares encontrados. Pulsa un
marcador para ver el nombre y el enlace **Ver detalle**.

El enlace **«¿Cómo se ordenan los resultados?»** explica el criterio usado. El
orden no es una calificación de calidad: no hay reseñas ni puntuaciones.

Si no aparece nada, prueba a:

- usar un término más general;
- quitar la categoría;
- ampliar el radio;
- elegir otra ciudad de referencia;
- pulsar **Limpiar búsqueda y filtros**.

---

## 4. Ver la ficha de un lugar

La ficha muestra los datos disponibles en OpenStreetMap:

- nombre y categoría;
- dirección;
- sitio web, teléfono y horario, si están publicados;
- descripción, si existe;
- mapa del lugar.

Acciones disponibles:

- **Abrir en OpenStreetMap:** abre la ficha original en una pestaña nueva.
- **Volver a resultados:** regresa a la búsqueda anterior.
- **Ir al inicio:** vuelve a la página principal.
- **Ver mapa:** carga el mapa solo cuando lo pides. Si las teselas no cargan,
  puedes reintentar o abrir el lugar directamente en OpenStreetMap.

Si OpenStreetMap no tiene sitio web, teléfono u horario, la aplicación lo indica
expresamente. No se rellenan esos campos con datos inventados.

> El horario publicado en OpenStreetMap puede no estar actualizado. Confírmalo
> antes de viajar.

---

## 5. Usar el asistente de viajes

### 5.1 Abrir y cerrar

Pulsa el botón flotante **✳** o **«Hablar con el asistente»**. El panel se abre a
la derecha.

- **×** o **Esc:** cierra el asistente.
- **↺:** inicia una conversación nueva y borra el plan que estuviera en pantalla.
- **Cancelar:** detiene una respuesta que se está generando.

### 5.2 Escribir un mensaje

1. Escribe en **«Escribe tu consulta…»**.
2. Pulsa **Enter** para enviar.
3. Usa **Shift + Enter** si quieres escribir varias líneas.
4. También puedes pulsar el botón de flecha **↑**.

Cada mensaje puede tener hasta **800 caracteres**. Mientras el asistente trabaja
verás **«Buscando en OpenStreetMap y preparando la respuesta…»**.

Puedes empezar con las sugerencias que aparecen en el panel:

- «Recomiéndame playas para visitar»
- «Planea un viaje de un día»
- «Busco lugares económicos para una familia»
- «Quiero conocer sitios históricos de El Salvador»

### 5.3 Pedir un buen itinerario

Cuantos más datos des, mejor será la propuesta. Incluye, cuando puedas:

- lugares o zonas que te interesan;
- cuántos días o cuánto tiempo tienes;
- número de personas;
- presupuesto aproximado y si es total o por persona;
- punto de salida;
- ritmo o intereses: naturaleza, historia, playa, comida, familia, etc.

Ejemplos:

```text
Planea un día en San Salvador para dos personas. Queremos historia,
caminar y comer, saliendo del Centro Histórico.
```

```text
Busca playas cerca de La Libertad para una familia con niños.
Tenemos un día y un presupuesto de $80 en total.
```

```text
Quiero un recorrido de dos días por Ruta de las Flores, saliendo de
Santa Ana, con lugares reales y poco desplazamiento.
```

### 5.4 Leer una respuesta

El asistente puede responder con:

- una recomendación con tarjetas de lugares;
- un **Itinerario sugerido** con paradas ordenadas;
- un mapa compacto del recorrido;
- distancias en línea recta;
- estimaciones de visita marcadas como estimaciones;
- un apartado **«Datos a confirmar»**.

En cada tarjeta o parada encontrarás **Ver detalle** y, cuando exista,
**OpenStreetMap**.

### 5.5 Modificar un itinerario en el chat

Debajo del itinerario sugerido hay atajos:

- **Agregar parada**
- **Quitar última**
- **Reordenar**
- **Más económico**

También puedes escribir el cambio que quieras: «quita la última parada», «añade
un museo», «hazlo más barato» o «ordénalo para caminar menos».

El servidor valida que las paradas sean lugares reales de OpenStreetMap. Si el
modelo propone un lugar que no existe en los resultados, se descarta.

### 5.6 Guardar el itinerario desde el chat

Con la sesión iniciada verás **Guardar itinerario**. Al pulsarlo:

1. Se guarda una **copia nueva** en tu cuenta.
2. Aparece **«Itinerario guardado en tu cuenta.»**
3. Puedes abrirlo con **Ver itinerario guardado →**.

Sin sesión verás **Iniciar sesión para guardar**. Al iniciar sesión y volver,
podrás reabrir el asistente y guardar el plan. Si recargas la página o cierras el
navegador antes de guardarlo, el plan se pierde.

> Guardar crea una copia. Si después cambias el plan en el chat, el itinerario
> guardado **no se actualiza solo**. Debes guardarlo de nuevo, lo que crea otra
> copia, o editar la copia guardada desde **Mis itinerarios**.

### 5.7 Si el asistente falla

Puedes encontrar:

- **«El asistente de IA no está configurado en este entorno»:** el
  administrador debe configurar la clave del proveedor de IA.
- **«No se pudo obtener respuesta»**, un tiempo de espera o un error 502:
  vuelve a intentarlo, reformula la petición o prueba con nombres concretos de
  lugares.
- **«No se pudo buscar en OpenStreetMap»:** el servicio público puede estar
  temporalmente saturado. Espera y reintenta.

El asistente no reserva alojamientos, no compra entradas y no confirma precios,
horarios ni disponibilidad. Verifica esos datos antes de viajar.

---

## 6. Crear una cuenta e iniciar sesión

### 6.1 Crear una cuenta

1. Pulsa **Iniciar sesión** en la cabecera.
2. En la pantalla de acceso, pulsa **Crea una gratis**.
3. Completa:
   - **Nombre para mostrar:** entre 2 y 80 caracteres.
   - **Correo electrónico.**
   - **Contraseña:** entre 8 y 72 caracteres.
   - **Repite la contraseña.**
4. Pulsa **Crear mi cuenta**.
5. Si aparece **«Confirma tu cuenta»**, revisa tu correo y la carpeta de spam.
   Debes abrir el enlace antes de iniciar sesión.

El nombre visible es solo para tu cuenta; no se publica en los lugares.

### 6.2 Confirmar el correo

El enlace del correo hace lo siguiente:

- **Enlace válido:** Supabase confirma la cuenta. Si además inicia tu sesión
  automáticamente, verás **«Tu cuenta está lista»** y podrás pulsar
  **Continuar**. Si no se inicia sola, verás el aviso de correo confirmado y el
  formulario para entrar con tu contraseña.
- **Enlace caducado o ya usado:** muestra **«No pudimos confirmar tu correo»**.
  Los enlaces son de un solo uso. Puedes iniciar sesión si la cuenta ya está
  confirmada o volver a registrarte para recibir otro enlace.
- **Enlace abierto con una sesión activa:** indica que el enlace ya no es válido,
  pero te permite continuar con la sesión actual.

Si no llega el correo, revisa spam. Si el administrador usa el correo integrado de
Supabase, puede haber un límite temporal de envíos; espera unos minutos o pide
que se configure un SMTP propio.

### 6.3 Iniciar sesión

1. Pulsa **Iniciar sesión**.
2. Escribe tu correo y contraseña.
3. Pulsa **Iniciar sesión**.
4. Si la cuenta es válida, irás a **Mis itinerarios**.

Mensajes habituales:

- **«Correo o contraseña incorrectos»:** revisa los datos o usa la recuperación.
- **«Debes confirmar tu correo antes de iniciar sesión»:** abre el enlace del
  correo de confirmación.
- **«Demasiados intentos seguidos»:** espera unos minutos.
- **«No se pudo conectar con el servicio de cuentas»:** revisa tu conexión.

### 6.4 Recuperar la contraseña

1. En el login, pulsa **¿Olvidaste tu contraseña?**
2. Escribe el correo de tu cuenta.
3. Pulsa **Enviar enlace de recuperación**.
4. Abre el enlace del correo. Te llevará a **Crea una contraseña nueva**.
5. Escribe la nueva contraseña y repítela.
6. Pulsa **Guardar contraseña**.

El enlace de recuperación caduca y solo se puede usar una vez. Si ya no es
válido, solicita otro. La recuperación por correo necesita que el envío de
correos esté configurado en el servicio de cuentas.

### 6.5 Cerrar sesión

Ve a **Mi cuenta** y pulsa **Cerrar sesión**. Tus itinerarios seguirán guardados.
En un dispositivo compartido, cierra la sesión al terminar.

La sesión se recuerda en el navegador. La sesión de `localhost` y la del sitio
publicado son independientes: aunque hayas iniciado sesión en local, debes
iniciarla de nuevo en el dominio de producción.

---

## 7. Tu cuenta

En **Mi cuenta** puedes:

- ver tu correo, que es de solo lectura;
- cambiar tu **Nombre para mostrar** y pulsar **Guardar cambios**;
- consultar **Miembro desde**;
- ver tu **plan actual**, las consultas de IA usadas y las restantes;
- consultar cuántos itinerarios tienes guardados y la vigencia del plan o pase;
- entrar a **Ver mis itinerarios guardados**;
- comparar planes o volver a **Planes**;
- cerrar la sesión.

El correo se gestiona en Supabase Auth y no se cambia desde esta pantalla. La
aplicación tampoco elimina cuentas desde la interfaz; si necesitas darte de baja,
contacta al administrador.

> Si el administrador todavía no activó los cupos, la tarjeta **Tu plan** puede
> indicar que los límites no están activos. Es una configuración del entorno, no
> un fallo de tu cuenta.

---

## 8. Guardar y administrar itinerarios

### 8.1 Llegar a tus itinerarios

Puedes entrar desde:

- **Mi cuenta → Ver mis itinerarios guardados**;
- el enlace **Ver itinerario guardado** después de guardar en el chat;
- la ruta `/itinerarios` si tienes la sesión iniciada.

### 8.2 Lista de itinerarios

Cada tarjeta muestra:

- título y fecha de actualización;
- descripción, si existe;
- número de paradas;
- fecha de inicio, duración, personas, presupuesto y punto de salida, cuando
  estén indicados.

Pulsa **Ver y editar itinerario** para abrirlo.

Si no tienes ninguno, verás **«Todavía no has guardado ningún itinerario»** con
accesos para hablar con el asistente o explorar lugares.

### 8.3 Abrir el detalle

El detalle muestra el título, las fechas de creación y actualización, el mapa, las
paradas, las distancias en línea recta, las estimaciones y los datos a confirmar.

Acciones:

- **Editar itinerario**
- **Exportar PDF:** abre el diálogo de impresión del navegador. Elige
  **Guardar como PDF** para conservar una copia. También puedes imprimir una
  página que no sea un itinerario: la opción es una ayuda de formato, no una
  protección de contenido.
- **Eliminar**

Si el itinerario no existe o pertenece a otra cuenta, verás **«Itinerario no
disponible»**. La aplicación no muestra el contenido de itinerarios ajenos.

### 8.4 Editar los datos del plan

Pulsa **Editar itinerario** y modifica lo que necesites:

- **Título:** hasta 120 caracteres.
- **Descripción:** hasta 2000 caracteres.
- **Fecha de inicio:** entre 1900 y 2100.
- **Duración (días):** de 1 a 60.
- **Número de personas:** de 1 a 50.
- **Presupuesto:** importe declarado, no un precio verificado.
- **Moneda:** código de tres letras, por ejemplo `USD`.
- **Alcance del presupuesto:** total del viaje o por persona.
- **Notas y preferencias:** hasta 1000 caracteres. Solo las ve tu cuenta.

Los campos vacíos se guardan como no indicados. La edición no inventa precios,
horarios ni disponibilidad.

### 8.5 Reordenar paradas

En cada parada usa:

- **↑ Subir**
- **↓ Bajar**

El orden se guarda tal como lo dejes. Las distancias se recalculan en línea recta.

### 8.6 Añadir una parada

1. En **Añadir una parada**, escribe al menos 2 caracteres.
2. Pulsa **Buscar**.
3. Revisa los resultados reales de OpenStreetMap.
4. Pulsa **Añadir** en el lugar correcto.

La parada se añade al final. Si el lugar ya está en el plan, el botón muestra
**Ya añadido**. El itinerario guardado admite hasta **20 paradas**.

### 8.7 Quitar o actualizar una parada

- **Quitar:** elimina la parada. No se puede quitar si solo queda una.
- **Actualizar datos:** vuelve a consultar OpenStreetMap y actualiza la
  información disponible de esa parada. Si la consulta falla, se conserva lo que
  ya estaba guardado.

### 8.8 Guardar o cancelar la edición

- **Guardar cambios:** guarda el título, los datos y las paradas.
- **Cancelar edición:** descarta los cambios de esta edición.

Si el guardado falla, el plan sigue en pantalla y puedes reintentar. Cuando se
guarda correctamente aparece **«Los cambios se guardaron correctamente.»**

### 8.9 Eliminar un itinerario

1. Abre el itinerario.
2. Pulsa **Eliminar**.
3. Confirma con **Sí, eliminar**.

La acción no se puede deshacer. El itinerario desaparece de tu cuenta y vuelves a
la lista.

---

## 9. Planes, límites y pago

### 9.1 Ver los planes

Pulsa **Planes** en la cabecera o abre la ruta `/planes`. Verás:

| Plan | Precio | Consultas de IA | Itinerarios guardados |
|---|---|---|---|
| Explorador | $0.00 | 10 al mes | 2 |
| Experiencia Pro | $7.99 al mes | 200 al mes | Sin límite del plan |
| Experiencia Élite | $14.99 al mes | 600 al mes | Sin límite del plan |
| Pase turístico | $3.99 por 7 días | 50 durante el pase | Sin límite del plan |

El plan **Explorador** sigue visible y disponible; no desaparece al destacar Pro.
La comparativa muestra también funciones como la exportación a PDF y la
planificación para grupos. Algunas funciones dependen de la información
disponible y no prometen reservas ni disponibilidad en tiempo real.

### 9.2 Consultas de IA e itinerarios

- Cada mensaje al asistente consume **una consulta de IA** cuando la respuesta se
  completa. Si el proveedor falla, la consulta se libera.
- Las búsquedas normales de lugares, los filtros y el mapa **no** consumen
  consultas de IA.
- En **Explorador** puedes guardar hasta **2 itinerarios**. El límite se aplica
  en el servidor; si lo alcanzas, el chat muestra **Ver planes y límites**.
- Pro y Élite no tienen un límite propio de itinerarios guardados en el plan.
- El pase de 7 días incluye 50 consultas durante su vigencia.
- En **modo demostración** no se aplican cuotas de plan ni el límite de 2
  itinerarios. El chat conserva los límites técnicos contra abuso y los errores
  del proveedor de IA.

Puedes consultar tu consumo en **Mi cuenta → Tu plan** y en la barra superior del
chat. Cuando se agota el cupo, el asistente deja de procesar consultas nuevas
hasta que se renueve el período o cambies de plan; la búsqueda y el mapa siguen
funcionando.

### 9.3 Pase turístico de 7 días

El pase es una alternativa para un viaje puntual, sin suscripción mensual. La
vigencia de **7 días empieza cuando se confirma el pago**, no al abrir la página
ni al pulsar el botón. Incluye 50 consultas de IA durante esos 7 días y no
incluye entradas, transporte, alojamiento ni actividades pagadas. En modo
demostración el pase no se compra ni se activa: sus funciones ya están
disponibles sin costo.

### 9.4 Estado del pago

En esta versión **el pago todavía no está habilitado**:

- los botones de Pro, Élite y pase abren la página de contratación;
- esa página explica las condiciones, pero no pide datos de tarjeta;
- el servidor no crea cobros, suscripciones ni pases;
- **no se ha realizado ningún cargo** y no se activa ningún plan.
- en modo demostración, la página de contratación explica que no hay pago y
  ofrece usar todas las funciones gratuitamente.

Cuando se conecte una pasarela real, el pago se verificará en el servidor y el
plan solo se activará con la confirmación. No compartas datos de tarjeta por
mensajes ni por canales informales.

### 9.5 Modo demostración o feria

Durante una feria, la persona organizadora puede activar el **modo
demostración**. Lo reconocerás por un aviso en la parte superior:

> Modo demostración: todas las funciones están habilitadas gratuitamente.

En este modo:

- los planes siguen visibles con sus nombres, precios, características y
  beneficios, pero se muestran como referencia;
- no se pide tarjeta, no se procesa ningún pago y no se activa una suscripción ni
  un pase;
- el asistente no aplica las cuotas mensuales del plan; los límites técnicos
  contra abuso y los errores del proveedor de IA siguen activos;
- puedes guardar itinerarios sin el máximo de 2 del plan Explorador;
- la exportación a PDF está disponible;
- al desactivar la demostración, los límites comerciales vuelven a aplicarse.

El modo demostración no crea funciones de negocios ni permite ver datos de otra
cuenta. Las cuentas, los itinerarios y RLS siguen funcionando igual.

### 9.6 Reservas, disponibilidad y soporte

Los planes **no incluyen reservas**, entradas, transporte, alojamiento ni
disponibilidad en tiempo real mientras no exista una integración verificada. El
soporte prioritario solo se ofrece si hay un canal de soporte activo; actualmente
no se promete atención prioritaria.

---

## 10. Datos, límites y recomendaciones

### Datos de OpenStreetMap

- Los lugares, direcciones, sitios web, teléfonos y horarios provienen de
  OpenStreetMap.
- No hay fotos, reseñas, calificaciones ni precios verificados.
- La información puede estar incompleta o desactualizada.
- La aplicación muestra la atribución **© OpenStreetMap contributors**.
- Los enlaces a sitios externos tienen sus propias políticas.

### Distancias y tiempos

- Las distancias son **en línea recta**, no por carretera ni por senderos.
- El orden de las paradas es una **sugerencia**; no es una ruta óptima.
- Los tiempos de visita son estimaciones, no horarios confirmados.
- Confirma transporte, accesos, clima, seguridad, cierres y horarios antes de
  salir.

### Límites del asistente y de los itinerarios

- El chat puede proponer hasta **6 paradas** por itinerario.
- El editor de itinerarios guardados permite hasta **20 paradas**.
- Cada mensaje del chat admite hasta **800 caracteres**.
- El chat conserva un historial reciente en el navegador; no guarda la
  conversación en el servidor.
- Las consultas de IA y el límite de itinerarios dependen del plan; consulta
  **Planes** y **Mi cuenta → Tu plan**. En modo demostración no se aplican esas
  cuotas de plan.
- El asistente puede fallar si el proveedor de IA o OpenStreetMap no están
  disponibles. La aplicación no rellena los huecos con datos inventados.

### Presupuesto

El presupuesto es una referencia que tú declaras. No es una cotización ni un
precio garantizado. La versión actual no procesa el cobro de los planes ni
reservas: la pasarela de pago no está conectada y no se activa ningún plan desde
la interfaz.

---

## 11. Problemas frecuentes

| Problema | Qué significa | Qué hacer |
|---|---|---|
| «No pudimos completar la búsqueda» | OpenStreetMap no respondió o la consulta falló. | Pulsa **Reintentar**, simplifica el texto o cambia la referencia. |
| «Sin resultados» | No hay lugares de OSM para esos filtros. | Prueba otra categoría, amplía el radio o limpia los filtros. |
| El mapa no carga | Las teselas o Leaflet no están disponibles. | Reintenta, revisa la conexión o usa **Abrir en OpenStreetMap**. |
| «El asistente de IA no está configurado» | El servidor no tiene proveedor de IA configurado. | Es una tarea del administrador. La búsqueda sigue funcionando. |
| El chat tarda o devuelve error 502 | El proveedor de IA u OSM están saturados. | Pulsa **Reintentar** o pide lugares concretos. |
| El chat no devuelve itinerario | No encontró lugares reales suficientes. | Indica nombres, zona, días y presupuesto con más detalle. |
| No puedo guardar | No hay sesión o la sesión expiró. | Inicia sesión y vuelve a intentarlo; el plan sigue en el chat. |
| «Correo o contraseña incorrectos» | Los datos no coinciden. | Revisa el correo y la contraseña o usa la recuperación. |
| «Debes confirmar tu correo» | La cuenta aún no está confirmada. | Abre el enlace del correo; revisa spam. |
| «El enlace ha caducado o ya se utilizó» | El enlace es de un solo uso. | Inicia sesión o solicita uno nuevo. |
| «Demasiados intentos seguidos» | Límite temporal de correos o intentos. | Espera unos minutos. |
| «Tu sesión expiró» | El token dejó de ser válido. | Inicia sesión de nuevo. |
| «No tienes permiso» o «Itinerario no disponible» | El plan no existe o es de otra cuenta. | Vuelve a **Mis itinerarios** con tu cuenta. |
| «Las cuentas todavía no están configuradas» | Falta configurar Supabase en el sitio. | Es una tarea del administrador. |
| No llega el correo de confirmación | Puede haber límite de envío o ir a spam. | Revisa spam, espera o pide configurar un SMTP propio. |

---

## 12. Privacidad y seguridad

- **Exploración:** no necesitas cuenta para buscar lugares ni conversar.
- **Cuenta:** el correo y la contraseña se gestionan a través de Supabase Auth.
  La aplicación no almacena tu contraseña en sus tablas.
- **Perfil:** el nombre visible y los itinerarios guardados se asocian a tu
  cuenta.
- **Aislamiento:** las políticas de seguridad de la base de datos impiden que
  otra cuenta lea o modifique tus itinerarios.
- **Chat:** el mensaje, el historial reciente, el resumen del itinerario y los
  resultados de búsqueda se envían al proveedor de IA para generar la respuesta.
  No se envía tu correo ni tu nombre visibles al asistente. No se guardan
  conversaciones completas en el servidor.
- **Ubicación:** solo se usa cuando pulsas **Buscar cerca de mí**; no se guarda.
  Si usas una ciudad como referencia, se usa el nombre y sus coordenadas para
  acotar la búsqueda.
- **Sesión:** el navegador recuerda la sesión para que no tengas que iniciar
  sesión en cada visita. En un dispositivo compartido, pulsa **Cerrar sesión**.
- **Cupo sin cuenta:** si usas el chat sin iniciar sesión, el servidor guarda una
  cookie HttpOnly firmada y un hash para contar consultas. No usa tu IP ni tus
  coordenadas como identidad del cupo. Puedes borrar las cookies del navegador,
  pero el cupo del período seguirá asociado al identificador anterior.
- **Enlaces externos:** OpenStreetMap y los sitios web de los lugares tienen sus
  propias políticas de privacidad.

---

## 13. Preguntas frecuentes

**¿Necesito una cuenta para usar el chat?**  
No. La cuenta solo es necesaria para guardar y administrar itinerarios.

**¿Puedo usar la aplicación en el teléfono?**  
Sí, la interfaz es responsiva. El asistente se abre como un panel flotante.

**¿Por qué no veo fotos ni estrellas?**  
OpenStreetMap no proporciona fotos ni calificaciones. La aplicación no las
inventa.

**¿Puedo reservar o pagar desde aquí?**  
No. Solo se muestran lugares y se generan sugerencias de itinerario. La página
**Planes** muestra precios y condiciones, pero la pasarela de pago todavía no está
conectada: no se cobra ni se activa ningún plan.

**¿Qué incluye el plan gratuito?**  
Explorador cuesta $0.00 e incluye 10 consultas de IA al mes y hasta 2
itinerarios guardados. La búsqueda, el mapa y el chat siguen disponibles.

**¿Qué pasa si llego al límite de IA?**  
El asistente no procesa consultas nuevas hasta que se renueve el período o
cambies de plan. La búsqueda de lugares y el mapa no se bloquean. En el chat
verás **Ver planes**.

**¿El pase de 7 días empieza al abrir la página?**  
No. Solo empieza cuando se confirma un pago real. Abrir la página o pulsar el
botón no activa el pase ni inicia la cuenta atrás.

**¿Las distancias son por carretera?**  
No. Son distancias en línea recta. Para transporte y rutas reales, consulta un
mapa de navegación.

**¿El chat actualiza mi itinerario guardado?**  
No. Guardar crea una copia. Si cambias el plan en el chat, guarda otra copia o
edita la copia existente.

**¿Puedo compartir un itinerario?**  
La versión actual no tiene un enlace público para compartir. El itinerario es
privado de tu cuenta.

**¿Puedo cambiar mi correo o borrar mi cuenta?**  
No desde la interfaz. El correo es de solo lectura; para la baja, contacta al
administrador.

**¿Funciona sin Internet?**  
No. La búsqueda, los mapas y el chat necesitan conexión.

**¿Por qué un lugar no aparece?**  
Puede no estar registrado en OpenStreetMap o no coincidir con la categoría. Puedes
buscarlo por nombre o abrir OpenStreetMap para comprobar su ficha.

---

## 14. Glosario

- **OpenStreetMap (OSM):** mapa colaborativo y abierto que aporta los lugares y
  datos geográficos.
- **Itinerario:** plan de viaje con una o más paradas ordenadas.
- **Parada:** lugar real de OpenStreetMap incluido en un itinerario.
- **Referencia:** punto de partida usado para calcular distancias y limitar el
  radio de búsqueda.
- **Radio:** distancia máxima en línea recta desde la referencia.
- **Línea recta:** distancia directa entre dos coordenadas, sin seguir calles.
- **Asistente:** chat con IA que busca lugares y propone planes.
- **Cuenta:** identidad creada con correo y contraseña para guardar datos.
- **RLS:** reglas de la base de datos que limitan cada fila a su propietario.

---

## 15. Anexo para administradores

Esta sección es solo para quien despliega y mantiene el sitio. El manual de
usuario no requiere estos pasos.

### Comprobaciones rápidas en producción

1. **Chat desactivado:** `GET /api/config` devuelve `chat.enabled: false`.
   Revisa que `AI_API_KEY` exista en el entorno **Production** de Vercel y vuelve
   a desplegar. Las variables de Vercel no cambian un deployment ya publicado.
2. **Cuentas desactivadas:** la pantalla de login muestra «Las cuentas todavía no
   están configuradas». Faltan `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` en el build. Añádelas y vuelve a desplegar sin caché.
3. **Chat con 403:** revisa `ALLOWED_ORIGIN`; debe coincidir exactamente con el
   origen de producción, sin barra final, o quedar vacío.
4. **Confirmación o recuperación con enlace incorrecto:** en Supabase, configura
   **Site URL** y **Redirect URLs** con el dominio real:
   `https://tu-dominio/cuenta/iniciar-sesion` y
   `https://tu-dominio/cuenta/restablecer`.
5. **Correos limitados:** configura un SMTP propio en Supabase para el registro
   público. El correo integrado tiene límites bajos.
6. **Planes sin cupos:** si `/planes` indica que los límites no están activos o
   `GET /api/config` devuelve `billing.enabled: false`, define
   `SUPABASE_SERVICE_ROLE_KEY` y `BILLING_ANONYMOUS_SECRET` en Vercel
   **Production**, aplica la migración de Fase 6 y vuelve a desplegar. El chat
   seguirá funcionando sin cupos mientras falte esa configuración.
7. **Pago deshabilitado:** `/planes/contratar` debe indicar que no hay cobro.
   `POST /api/billing/checkout` devuelve `PAYMENTS_NOT_CONFIGURED`. No conectes
   una pasarela sin webhooks firmados, verificación del importe en servidor e
   idempotencia.
8. **Migraciones y RLS:** aplica las migraciones de Fase 5 y Fase 6 de
   `supabase/migrations/` y ejecuta las pruebas de aislamiento
   `phase5_rls.sql` y `phase6_plans_rls.sql` en un entorno local o de desarrollo.
   Nunca uses `service_role` en el navegador ni en una variable `VITE_*`.

Para la configuración técnica completa, consulta el `README.md` del proyecto.

---

**Fin del manual.**
