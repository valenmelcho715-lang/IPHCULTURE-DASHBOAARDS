# iPhone Culture Dashboard

Panel interno de iPhone Culture con el dashboard comercial existente y el módulo de **Atención IA** integrado en `/atencion`.

La automatización se entrega en modo seguro: puede recibir, clasificar y preparar respuestas durante el piloto, pero no envía mensajes reales mientras `ALLOW_LIVE_MESSAGES=false`. No habilitar ese interruptor hasta completar el preflight de producción, probar los webhooks con contactos autorizados y verificar una restauración del respaldo externo.

## Funciones principales

- Dashboard operativo para stock, ventas, clientes, facturas, leads, turnos, postventa y otros flujos existentes.
- Bandeja unificada de WhatsApp e Instagram con asignación, notas, recordatorios, oportunidades y archivo.
- Borradores asistidos por IA con pausa automática cuando responde una persona.
- Control de acceso con roles, sesiones JWT y limitación de intentos de inicio de sesión.
- Base SQLite/libSQL, adjuntos privados y copias cifradas con Restic.
- Migración verificable de la base vigente sin modificar el origen.
- Health check real, cierre ordenado y chequeos previos al piloto y a la activación en vivo.

## Desarrollo local

Requiere Node.js 20 o posterior y npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

No guardar claves reales en archivos versionados. Para una demostración aislada con datos ficticios:

```bash
npm run demo
```

## Verificación

```bash
npm run lint
npm run build
npm test
npm run test:ui
npm audit
```

Antes de un piloto:

```bash
npm run preflight
```

Justo antes de habilitar entregas reales:

```bash
npm run preflight:live
```

El segundo comando exige deliberadamente `ALLOW_LIVE_MESSAGES=true`; no debe usarse para staging ni alterarse para forzar un resultado verde.

## Configuración

`.env.example` documenta todas las variables sin incluir secretos. Las esenciales en producción son:

- `JWT_SECRET`: valor aleatorio de al menos 32 caracteres.
- `TURSO_DATABASE_URL`: base migrada o archivo persistente.
- `OPENAI_API_KEY`: clave del proyecto del propietario.
- Credenciales de Meta para WhatsApp e Instagram.
- `MEDIA_DIR` y `BACKUP_DIR` en almacenamiento persistente.
- Credenciales de un repositorio Restic externo y privado.
- `ALLOW_LIVE_MESSAGES=false` durante instalación y piloto.

## Despliegue y datos

`render.yaml` es un perfil para crear **un servicio nuevo y pago** con disco persistente. No actualiza por sí solo el dashboard que ya existe y no debe aplicarse nuevamente sin revisar nombre, precio, región y destino. Un servicio duplicado no es necesario para probar el código local.

La puesta en producción requiere decidir expresamente si se actualizará el servicio vigente o si se contratará uno nuevo. En ambos casos hay que respaldar y migrar la base actual; la base de demostración nunca reemplaza datos reales.

Guías operativas:

- [Instalación en Render](docs/INSTALACION_RENDER.md)
- [Migración segura](docs/MIGRACION.md)
- [Almacenamiento, respaldo y recuperación](docs/ALMACENAMIENTO.md)
- [Seguridad y rotación de credenciales](docs/SEGURIDAD.md)
- [Voz y respuestas de Atención IA](docs/RESPUESTAS_IA.md)

## Estado de activación

El código está preparado y probado, pero la activación real queda bloqueada hasta contar con credenciales seguras de OpenAI y Meta, acceso autorizado a la base vigente, un destino externo de respaldos y las reglas comerciales confirmadas. La producción actual no se modifica desde esta rama y los mensajes reales permanecen deshabilitados.
