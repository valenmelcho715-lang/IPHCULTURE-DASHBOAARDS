# Instalación propuesta en Render

Estado: archivo de despliegue preparado; no se creó un servicio ni se contrató capacidad. La cuenta, facturación y credenciales deben pertenecer al dueño. Confirmar precio vigente en la pantalla de creación y ajustar el plan antes de aplicar el Blueprint.

Se propone Render porque la web pública indicada ya usa un dominio onrender.com. Esto no demuestra que tengamos acceso a esa cuenta. El servicio nuevo se llama `iphoneculture-atencion`; comprobar que ese nombre esté libre antes de aplicarlo. No aplicar este archivo a un servicio existente sin revisar su configuración y respaldo.

## Distribución concreta de los datos

- Disco persistente de 30 GB montado en `/app/data`.
- Base: `/app/data/iphone-culture.db`.
- Archivos de clientes: `/app/data/media` (cuota inicial 10 GB).
- Copias consistentes locales: `/app/data/backups`.
- Caché de respaldo: `/app/data/restic-cache`.
- Copia cifrada externa: bucket privado S3 por HTTPS, pendiente de conexión.

En este perfil todas las rutas quedan bajo un único disco persistente. Las copias de adjuntos pueden usar enlaces duros dentro del mismo disco para evitar repetir sus bytes. Las copias de la base y el caché sí consumen espacio adicional: monitorear el panel. Un disco local y sus copias locales no sustituyen un respaldo externo.

Plan propuesto: 1 CPU, 2 GB RAM, una instancia. No se comprobó rendimiento real ni se garantiza capacidad de pico. El servicio utiliza SQLite, por lo que no se deben crear réplicas independientes. Con un disco persistente las actualizaciones pueden tener interrupción; mantener una ventana de mantenimiento y verificar la cola después de cada despliegue.

## Orden de puesta en marcha

1. Entrar en la cuenta Render que elegirá el dueño. Vincular un repositorio privado con el código de esta entrega. No subir `.env`, bases, adjuntos o backups al repositorio.
2. Revisar `render.yaml`, nombre del servicio, plan, región y costo. Crear el servicio desde el Blueprint. La clave de sesión se genera en Render; no se incluye en el ZIP.
3. Verificar lectura y escritura del disco por el usuario `node`, en especial después del primer montaje. No abrir permisos de archivos a todo el mundo para resolver problemas de acceso.
4. Migrar una copia consistente de la base con el servicio detenido o antes de su arranque definitivo. El archivo inicial de la demo nunca se usa como base de producción. Validar recuentos e integridad antes de reemplazar la base inicial vacía.
   Seguir el procedimiento reproducible de `MIGRACION.md`.
5. Si se inicia una base nueva, configurar temporalmente `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` desde el panel privado del servicio. Eliminar esas variables después de crear el administrador. Si se migra la base existente, no crear usuarios duplicados; revisar el acceso administrador con el dueño.
6. Configurar el repositorio externo y su contraseña en el entorno seguro de Render. Introducir `RESTIC_REPOSITORY`, `RESTIC_PASSWORD` (o archivo secreto), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y región según el proveedor. Guardar la contraseña de cifrado también fuera del servidor.
7. En la consola del servicio, inicializar el repositorio una sola vez y ejecutar el respaldo y la recuperación de prueba conforme a `ALMACENAMIENTO.md`. Confirmar que el panel muestre una copia externa completada.
8. Introducir la clave de IA y realizar pruebas de conversaciones sin enviar mensajes a clientes. El costo de API es separado del alojamiento.
9. Conectar Meta, probar webhooks y recepción/salida con contactos de prueba autorizados. Habilitar descarga de archivos para comprobar fotos, audio y documentos.
10. Habilitar atención real solo después de revisar las reglas comerciales y el resultado del piloto. `ALLOW_LIVE_MESSAGES` viene en `false`.

Antes del piloto ejecutar `npm run build`, `npm test`, `npm run test:ui` y `npm run preflight`. El último comando debe fallar mientras falte cualquier configuración obligatoria; no debe neutralizarse para conseguir un resultado verde.
Justo antes de habilitar entregas reales, ejecutar `npm run preflight:live`; no usar ese modo durante staging.

Este archivo no contiene claves de Meta ni IA y no solicita completar esas cuentas para poder desplegar el servidor inicialmente.

## Qué falta aportar

- Acceso a la cuenta Render que se utilizará y a un repositorio privado para alojar el código.
- Cuenta y bucket para el respaldo externo.
- Credenciales de IA y Meta mediante entrada segura en el servidor.
- Confirmación del segundo vendedor, dirección y condiciones comerciales pendientes.

No pegar contraseñas o claves en documentos, repositorios ni capturas. La interfaz de la aplicación nunca devuelve secretos de configuración al navegador.

Referencias oficiales consultadas:
- https://render.com/docs/blueprint-spec
- https://render.com/docs/disks
