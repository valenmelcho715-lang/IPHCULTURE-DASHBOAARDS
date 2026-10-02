# Historial, memoria y recuperación — iPhone Culture

## Estado de la entrega

Implementado y probado localmente. Ningún servidor, bucket ni cuenta de Meta fue contratado o conectado por esta entrega. No se enviaron datos de clientes a proveedores de almacenamiento durante las pruebas.

## Dónde queda cada dato

- Base SQLite/libSQL: clientes, canales, mensajes, oportunidades, notas, decisiones, cotizaciones, reservas, cobros, próximos contactos y permisos. En `compose.yaml`, volumen `culture_database` en `/app/data`.
- Archivos recibidos: volumen privado `culture_media` en `/app/media`. No se sirven como archivos públicos. Cada lectura exige sesión y acceso a la conversación. Fotografías, audios y videos compatibles se abren desde la bandeja; documentos se descargan.
- Copias locales: volumen `culture_backups` en `/app/backups`. Se conservan las ocho copias completas más recientes. Los adjuntos inmutables usan enlaces duros cuando comparten sistema de archivos; si están en otro volumen se copian. Dimensionar este espacio para hasta ocho copias de adjuntos además de las bases.
- Copias externas: repositorio Restic cifrado, preparado para un bucket S3 privado por HTTPS, en una cuenta propiedad del dueño. Requiere configurar endpoint, bucket, credenciales y contraseña independiente. Todavía no existe un destino externo configurado para este negocio.

El servidor ejecuta una copia al arrancar y luego cada 60 minutos por defecto. El intervalo se configura con `BACKUP_INTERVAL_MINUTES` (15–1440). Esto es una frecuencia programada, no una garantía de recuperación: hay que vigilar fallos y probar restauraciones. Un servidor perdido podría hacer perder los mensajes posteriores a la última copia externa completada.

No se replica aquí la infraestructura de alta disponibilidad. El despliegue preparado usa un solo proceso/instancia con sus volúmenes. No escalar creando réplicas independientes de SQLite.

## Qué queda recordado

La identidad verificada de la persona es independiente de sus canales y de las oportunidades de compra. Cada oportunidad mantiene su resultado, fechas, modelo, presupuesto declarado, resumen, puntaje, motivos y vendedor. El cobro total verificado cierra la venta. El silencio no se convierte en pérdida por sí solo.

Las nuevas intenciones explícitas de compra después de un cierre abren otra oportunidad. Un agradecimiento, consulta ambigua, garantía o reclamo conserva el resultado anterior y avisa al equipo. El vendedor puede abrir una nueva oportunidad con motivo cuando la intención no se reconoce automáticamente. La detección automática es conservadora; su calidad real requiere piloto.

La IA recibe un contexto acotado: datos de la oportunidad vigente, mensajes recientes, hasta ocho oportunidades anteriores y hasta ocho notas. El historial completo se conserva aparte y puede consultarse/exportarse. Un presupuesto, permiso o plazo de una compra anterior no se toma como vigente automáticamente. Los resúmenes generados por IA requieren evaluación de calidad; persistencia no equivale a infalibilidad.

Los historiales que ya existían en WhatsApp/Instagram no aparecen mágicamente al conectar. Hace falta comprobar qué importación permite el canal y disponer de una exportación autorizada si corresponde. Las tablas del sistema recibido se conservan; no se inventaron chats históricos a partir de ventas.

## Uso en la bandeja

- **Ficha e historial:** oportunidades previas, motivos de pérdida, canales vinculados y notas.
- **Cargar mensajes anteriores:** páginas de 50; la sincronización de nuevos mensajes también usa cursores y no necesita descargar todo el historial.
- **Agregar nota:** registra quién la escribió y cuándo.
- **Programar retoma:** fecha y motivo; al vencer genera un aviso interno una vez. No autoriza por sí sola un mensaje externo. Filtro **Retomar hoy**.
- **Archivar:** conserva la información y detiene seguimientos automáticos. Un nuevo mensaje devuelve el chat a la bandeja. No altera el resultado comercial.
- **Vincular otro canal:** solo administración, con el número del chat de destino y evidencia de identidad. Conserva ambos historiales, usa el vendedor del destino y respeta una baja en ambos canales. Rechaza identidades con clientes de ventas distintos y mezcla entre demostración y real. No se vincula por coincidencia de nombre.
- **Exportar historial:** administración obtiene NDJSON con ficha, canales, mensajes, oportunidades, notas y eventos. No es un sustituto de la copia completa con adjuntos. La exportación se pagina en el servidor.
- **Datos y copias:** cantidades, volumen de archivos, capacidad libre, errores de descarga y resultado de las copias.

## Archivos: límites y permisos

Preparada recepción por referencias oficiales de WhatsApp e Instagram. Descarga mediante proceso en segundo plano, máximo 25 MB por archivo y cuota inicial de 20 GB. Descarga habilitada mediante `ALLOW_MEDIA_DOWNLOADS=true`, con credenciales reales disponibles. Hay validación de origen, HTTPS, redirecciones, tamaño y hash cuando Meta lo proporciona. En pruebas se usaron respuestas simuladas; se debe probar cada canal conectado, incluidos tipos MIME y vencimiento de URLs de Instagram.

No hay transcripción ni análisis automático de fotos: los adjuntos derivan a una persona. Tampoco hay envío de archivos por el vendedor en esta versión. El almacenamiento y visor de archivos entrantes sí están implementados. Los archivos no son escaneados por antivirus; no tratar descargas como contenido confiable.

Historial sin eliminación automática. Archivar no borra. No se implementó una política legal de conservación ni se promete conservar datos para siempre. Antes de producción acordar conservación/exportación/eliminación y revisar volumen real. Las copias externas no se purgan automáticamente; configurar su retención de forma deliberada, sin borrar el último respaldo válido.

## Configuración y puesta en marcha

1. Elegir servidor y destino externo bajo cuentas del dueño. Habilitar cifrado de discos en el proveedor y bucket privado; conservar la contraseña Restic fuera del servidor.
2. Crear `.env` a partir de `.env.example`, con secretos introducidos directamente en el servidor. Mantener `ALLOW_LIVE_MESSAGES=false` durante la instalación. Para `RESTIC_PASSWORD_FILE`, montar explícitamente el archivo secreto; el Compose base no inventa su ruta ni su contenido.
3. Construir con `docker compose build`. Usar los volúmenes nombrados: recrear el contenedor conserva datos; **`docker compose down -v` elimina volúmenes y no debe usarse como actualización**.
4. Migrar mediante copia consistente y validar en staging. No arrancar una base de ejemplo sobre los datos existentes. Copiar la base al volumen `/app/data` con el servicio detenido. Colocar HTTPS delante del puerto publicado en localhost.
5. Inicializar el repositorio externo una vez desde el contenedor: `node scripts/storage.cjs external-init`. No reinicializar ni cambiar contraseñas a ciegas.
6. Ejecutar `node scripts/storage.cjs backup`, comprobar el estado en el panel y ejecutar `node scripts/storage.cjs external-check` para revisar el repositorio.
7. Hacer una recuperación de prueba antes de activar canales reales. La configuración de atención automática en producción exige persistencia declarada y una copia externa completada. La declaración de persistencia no sustituye verificar los montajes reales.

Docker/Compose están preparados, pero no se ejecutaron en este entorno (sin Docker). Restic 0.18.0 sí fue descargado del repositorio oficial, comprobado contra SHA256SUMS y probado con un repositorio cifrado temporal local. El destino S3 real está pendiente de conexión.

## Recuperación sin sobrescribir producción

1. Detener el servicio afectado o preparar otro servidor. Mantener los envíos externos apagados.
2. Descargar una copia externa: `node scripts/storage.cjs external-restore SNAPSHOT_ID /ruta/nueva/descarga`. El comando requiere un destino inexistente. Las carpetas conservan la estructura de rutas de la copia; localizar `manifest.json`.
3. Verificar: `node scripts/storage.cjs verify /ruta/al/snapshot`.
4. Recuperar: `node scripts/storage.cjs restore /ruta/al/snapshot /ruta/nueva/recuperada`.
5. La recuperación verifica la base y cada adjunto, pausa la automatización y deja envíos pendientes/en curso como **inciertos**. No reenvía a ciegas mensajes que Meta podría haber entregado después de la copia. Conserva el hash del origen y registra un nuevo manifiesto de recuperación.
6. Revisar los datos en staging. Copiar la base recuperada y su carpeta `media` a los volúmenes correspondientes con el servicio detenido. Verificar los envíos inciertos con Meta antes de cualquier reenvío; revisar oportunidades y cobros realizados después del backup.
7. Verificar nueva copia externa y recién entonces habilitar la atención. No automatizar el reemplazo de la base activa.

Los comprobantes fiscales/legales emitidos por otro sistema deben reconciliarse; restaurar una base no revierte pagos reales ni operaciones bancarias.

## Verificación realizada

Ver `PRUEBAS_BACKEND.txt`, `REVISION_UI.json` y `VERIFICACION_ALMACENAMIENTO.json`. Las pruebas usan bases temporales y proveedores simulados. La prueba cifrada usa Restic real, con contraseña ficticia y repositorio local separado, sin servicios externos.

Referencias de implementación:
- https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html
- https://restic.readthedocs.io/en/stable/050_restore.html
- https://www.postman.com/meta/whatsapp-business-platform/request/fpj02x0/retrieve-media-url
