# iPhone Culture · Atención IA

Extensión del sistema existente de iPhone Culture (React, Express y SQLite). Reúne atención, calificación, reparto entre closers, cotizaciones, canjes, reservas, turnos y seguimiento dentro del mismo sistema.

## Estado de esta entrega

El código funciona en pruebas locales con datos ficticios. **Todavía no está instalado en la computadora del negocio ni conectado a WhatsApp, Instagram u OpenAI.** No se enviaron mensajes a clientes ni se modificó la base original. La conexión real requiere credenciales, permisos de Meta y una dirección HTTPS estable.

La demostración interpreta mensajes mediante reglas sencillas. Sirve para recorrer pantallas y operaciones; no demuestra la calidad del modelo de IA en conversaciones reales. Las pruebas de Meta usan solicitudes simuladas.

Se aprobaron 55 pruebas funcionales y el recorrido de interfaz en escritorio y móvil. La migración conservó sin cambios los datos de las 23 tablas anteriores de la copia recibida. Ver `docs/VERIFICACION_ALMACENAMIENTO.json`, `docs/ALMACENAMIENTO.md` y `GUIA.html`.

## Qué incorpora

- Bandeja de WhatsApp e Instagram con responsable, historial, estado automático/humano y motivos de prioridad.
- Clasificación estructurada por IA: intención, producto buscado, presupuesto explícito, forma de pago, plazo, canje y consentimiento. La prioridad es un puntaje explicable, no una probabilidad de compra.
- Respuestas comerciales calculadas con Stock y las reglas del negocio. No se permite que el modelo invente precios, disponibilidad, descuentos ni pagos.
- Reparto equilibrado entre los closers seleccionados; preserva al responsable en consultas posteriores. Si falta un equipo elegible, deja la conversación para atención humana.
- Descuento automático configurable por compra; beneficio para clientes anteriores únicamente después de verificar su ficha.
- Cotizaciones con vencimiento, pesos/USD, cuotas, estado y batería cuando el stock los informa. Los canjes requieren datos y pueden quedar sujetos a revisión física.
- Reservas por el 30%, vigencia de siete días y bloqueo de disponibilidad solamente después de que el administrador confirma el ingreso de dinero. Control transaccional para evitar reservar dos veces la última unidad.
- Cierre cobrado confirmado por administrador, descuento del stock y registro de la operación en Ventas/Facturas del sistema. El registro interno no es una integración de facturación fiscal.
- Turnos de quince minutos dentro del horario del negocio.
- Derivación por señas, pagos, reclamos, garantías, fallas, adjuntos que no puede interpretar o errores del servicio. El resto de la atención puede funcionar automáticamente, sin aprobar cada respuesta.
- Seguimientos con consentimiento, límites por canal, baja inmediata y hasta cinco intentos. No promete poder enviar cualquier mensaje fuera de la ventana de Meta.
- Indicadores de conversaciones, cierre cobrado, pérdidas, recuperables, reparto y consumo estimado de IA.
- Permisos de costos, ganancias y configuración financiera reservados al administrador; registro de acciones, mensajes y estados de envío.

## Probar sin cuentas reales

Requiere Node.js 22.16 o posterior y npm.

```sh
npm ci
npm run demo
```

En Mac también se incluye `INICIAR-DEMO.command`: abre la prueba en el puerto 8181 y el archivo con sus accesos, sin ocupar el puerto habitual del sistema. Su comportamiento completo debe comprobarse en la Mac; acá se verificó la aplicación en Linux.

Con `npm run demo`, abrir `http://127.0.0.1:8080/atencion`. El usuario y la contraseña aleatoria de demostración se guardan en `.demo/acceso.txt`. Se crean productos y conversaciones ficticios en una base independiente `.demo/demo.db`.

Dentro de Atención IA, activar **Ver conversaciones de prueba** y usar **Probar conversación**. En un chat de prueba se puede continuar como cliente simulado o responder como vendedor. Ninguno de esos mensajes se envía a Meta.

No usar `.demo/demo.db` como base del negocio. Para reiniciar la demostración, detener el servidor y eliminar únicamente la carpeta `.demo`.

## Verificación reproducible

```sh
npm run build
npm test
npm run doctor
```

Las pruebas funcionales usan una base temporal y usuarios ficticios, con la red externa bloqueada. `npm run doctor` solo informa qué variables están configuradas, sin mostrar claves ni llamar a proveedores. Cubren permisos, fórmulas, stock, reservas simultáneas, deduplicación, reparto de 500 contactos, turnos, bajas, ventanas de envío, seguimientos y recuperación ante errores. La prueba de 500 contactos comprueba el reparto en la base local; no mide 500 conversaciones simultáneas con los proveedores reales.

`tests/ui.cjs` verifica la interfaz con Playwright sobre la demostración. Es opcional y requiere Playwright y Chromium instalados; admite `PLAYWRIGHT_MODULE_PATH`, `CHROME_BIN` y `DEMO_URL`.

## Incorporar a la instalación existente

1. Conservar una copia completa del código y un respaldo consistente de SQLite. Si hay archivos WAL/SHM, usar la API de backup de SQLite o detener correctamente la aplicación antes de copiar; una copia aislada del archivo principal puede perder operaciones recientes.
2. Probar esta versión sobre una copia de la base. Las migraciones agregan tablas y columnas; no fusionan clientes por nombre, no borran conversaciones y no convierten automáticamente ventas históricas en ventas cobradas.
3. Copiar `.env.example` a `.env.local` y completar las variables por un medio seguro. No subir claves al repositorio ni pegarlas en conversaciones.
4. Configurar `TURSO_DATABASE_URL` con la ruta de la base de trabajo y `BACKUP_DIR` con una ubicación persistente. Mantener copias fuera del servidor además del respaldo local.
5. Conservar los usuarios actuales. `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` son solo para una instalación nueva sin usuarios; en una migración deben quedar vacíos.
6. Ejecutar `npm ci`, `npm run build` y `npm start`. En producción se exige `JWT_SECRET` aleatorio de al menos 32 caracteres. El servidor escucha en localhost salvo configuración explícita de `HOST`.
7. Configurar un dominio HTTPS y un proxy/servicio permanente. Un enlace temporal de ngrok puede servir para una prueba, pero no garantiza continuidad operativa.
8. Verificar cuentas, pruebas y presupuesto antes de habilitar respuestas externas.

Se incluye un `Dockerfile` preparado para compilación y ejecución con Node 22. La imagen y el despliegue deben validarse en el servidor elegido, con volúmenes persistentes para datos y respaldos.

## Conectar los servicios reales

### OpenAI

Completar con el propietario el flujo seguro de creación de una clave nueva y confirmar primero dónde se guarda. El programa la lee de `OPENAI_API_KEY`; no incluye una clave real. El modelo es configurable mediante `OPENAI_MODEL` y inicialmente está preparado para `gpt-4.1-mini` con salida estructurada.

Configurar las tarifas del modelo en Atención IA. El límite inicial de IA es USD 100 mensuales y usa una estimación de consumo. No incluye cargos de WhatsApp, hosting u otros servicios; no constituye una garantía de que el costo total quede debajo de USD 300. Antes de cambiar el modelo, actualizar sus tarifas y probar su calidad.

### WhatsApp e Instagram

Usar las APIs oficiales de Meta. Configurar identificadores de cuenta, secretos, tokens y una versión vigente de Graph API en las variables de entorno. No usar automatización de WhatsApp Web ni contraseñas de Instagram para enviar mensajes.

Callback de verificación y eventos:

```text
https://TU-DOMINIO/api/integrations/meta
```

El conector de Instagram está preparado para Instagram API con Instagram Login; se deben comprobar los permisos y la modalidad de cuenta en la aplicación de Meta. Para el número que ya usa WhatsApp Business, verificar la elegibilidad y el procedimiento de coexistencia/migración antes de intervenir en la cuenta.

El servidor verifica la firma de los eventos, el identificador de la cuenta y los mensajes duplicados. Conserva una cola de salida. Si un envío queda en estado incierto por un corte, requiere revisión para evitar duplicarlo. Las respuestas humanas deben hacerse desde la bandeja mientras se prueba el traspaso de control con los canales reales.

Para habilitar envíos se necesitan ambas condiciones: `ALLOW_LIVE_MESSAGES=true` en el servidor y automatización habilitada en Atención IA. Los chats de prueba siempre quedan aislados.

### Seguimientos

Por defecto se programan a las 48, 96, 168, 240 y 336 horas del último mensaje recibido. Para WhatsApp fuera de la ventana de atención se exige consentimiento explícito y una plantilla aprobada configurada. Esta primera versión admite una plantilla de seguimiento sin variables. Una respuesta del cliente cancela el ciclo anterior; la baja detiene los envíos.

Si el servidor se recupera después de un corte, conserva una separación entre los intentos: no envía juntos los seguimientos atrasados.

Instagram no tiene seguimiento automático fuera de su ventana permitida. No se utiliza una excepción destinada a atención humana para hacer promociones automáticas.

## Decisiones comerciales pendientes

- **Dirección:** está vacía hasta que se confirme la ubicación exacta del local. El asistente conoce Neuquén capital y los horarios, pero deriva la consulta de dirección cuando falta ese dato.
- **Canje Android:** se conserva inicialmente el descuento fijo de USD 215 que aparece en el código actual. El material anterior indicaba USD 65. Está configurable y requiere confirmar cuál corresponde.
- **Cliente anterior:** inicialmente los USD 30 reemplazan al descuento general de USD 20. Se puede habilitar la acumulación; no se decidió automáticamente conceder USD 50.
- **Cancelaciones y devoluciones:** no se cobra automáticamente la retención del 15% ni se procesa un reintegro. Requiere revisión humana y definición de condiciones aplicables.
- **Identidad de clientes:** las fichas antiguas sin teléfono/Instagram necesitan vinculación verificada. No se asume que dos nombres iguales son la misma persona.
- **Historial:** las ventas y los leads antiguos permanecen en sus módulos. Los indicadores nuevos de cierre cobrado se basan en oportunidades del módulo de atención, con pago confirmado por administrador.

## Límites que requieren una etapa posterior

La instalación prevista usa un proceso del servidor, con cuatro conversaciones de IA en paralelo y escrituras de SQLite ordenadas. Los envíos en curso pueden terminar aunque una persona tome el chat; las respuestas todavía en cola se detienen. No se promete disponibilidad ininterrumpida ni alta disponibilidad sin probar la infraestructura.

Los audios, imágenes y documentos entrantes tienen almacenamiento privado y visor autenticado; se derivan a una persona para su interpretación; no hay transcripción automática ni análisis de capturas de comprobantes. Nunca se interpreta un comprobante como prueba suficiente de acreditación.

La migración se puede repetir sobre una copia temporal con `python3 scripts/check-migration.py /ruta/a/iphone-culture.db`, después de compilar el servidor. Requiere Python 3.

La calidad de la calificación debe evaluarse con conversaciones reales anonimizadas y con el modelo conectado. La instalación real necesita comprobar permisos de Meta, webhooks, entrega, coexistencia del número, límites de cuenta y recuperación ante cortes. No se afirma que esas verificaciones se hayan completado con las cuentas del negocio.

## Funciones recuperadas del prototipo anterior

Se incorporaron las partes útiles del antiguo proyecto Django sin trasladar su dependencia operativa de Notion ni sus respuestas en inglés:

- **Audios:** pueden transcribirse manualmente desde la conversación. Con `AUTO_TRANSCRIBE_AUDIO=true`, un audio se guarda primero, se transcribe y recién entonces entra a la interpretación comercial. Si falla, se deriva al equipo. El modelo se configura con `OPENAI_TRANSCRIPTION_MODEL`; la función queda apagada por defecto.
- **Fotos de equipos:** Stock admite una URL HTTPS pública por unidad. También reutiliza una imagen del Catálogo cuando el modelo coincide exactamente. La foto solo se prepara si el cliente pide expresamente una foto o imagen y existe una única coincidencia de stock.
- **Alertas de alta intención:** si una oportunidad con puntaje alto queda sin respuesta después del último mensaje del equipo, se crea un aviso interno a la hora, a las 12 horas y a las 24 horas. Cada aviso es idempotente y nunca escribe automáticamente al cliente.
- **Seguridad preservada:** las simulaciones no pueden enviar fotos; los envíos reales siguen requiriendo `ALLOW_LIVE_MESSAGES=true`, la automatización activa y una ventana válida de Meta.

No se trasladó el almacenamiento de clientes y mensajes en Notion ni la integración incompleta de Mercado Pago. El sistema actual ya resuelve mejor los turnos, cuotas, canjes, seguimiento, control humano, idempotencia y trazabilidad.

## Referencias técnicas

- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api
- https://whatsappbusiness.com/policy/

Las páginas de Meta no estuvieron disponibles íntegramente durante la construcción. El contrato preparado se prueba localmente y debe contrastarse con la configuración y versión vigentes de la aplicación antes de conectar cuentas reales.

## Historial y almacenamiento persistente

La ampliación incluye ficha de cliente, oportunidades históricas, notas, retomas, archivo reversible, vinculación verificada de canales, mensajes paginados, archivos entrantes privados y copias completas restaurables. Leer `docs/ALMACENAMIENTO.md` antes de desplegar. El panel **Datos y copias** muestra el estado real; código preparado no equivale a un bucket o servidor conectado.

Usar `compose.yaml` para conservar base, adjuntos y copias en volúmenes independientes. No borrar esos volúmenes al actualizar. La copia externa se configura con Restic y un bucket S3 privado por HTTPS. Hay controles de integridad y recuperación en carpeta nueva, con automatización pausada tras restaurar.

Prueba opcional cifrada: definir `RESTIC_TEST_BIN` con la ruta de un binario Restic confiable y ejecutar `npm test`; la suite crea un repositorio temporal local y no usa cuentas externas. La prueba de interfaz se ejecuta con `node scripts/review-ui.cjs` y requiere Playwright/Chromium (variables opcionales `PLAYWRIGHT_MODULE` y `CHROMIUM_PATH`).
