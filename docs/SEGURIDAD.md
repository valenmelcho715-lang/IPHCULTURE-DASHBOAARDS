# Seguridad y rotación pendiente

La rama `codex/atencion-integrada` no contiene claves reales. El sistema exige un `JWT_SECRET` de al menos 32 caracteres en producción, limita intentos repetidos de inicio de sesión, valida la firma de Meta y entrega encabezados contra carga de contenido, iframes y permisos innecesarios.

## Credencial histórica de Turso

Existe una credencial histórica expuesta en versiones anteriores del repositorio. Debe considerarse comprometida. Para evitar una interrupción en la aplicación vigente, la secuencia correcta es:

1. Crear una credencial nueva en Turso.
2. Guardarla como variable privada en el servicio vigente de Render.
3. desplegar y verificar acceso, escritura y `/api/health`.
4. Revocar la credencial anterior.
5. Revisar registros de acceso y rotar cualquier credencial relacionada si se detecta actividad desconocida.

No se debe borrar o reescribir el historial Git sin coordinarlo: esa operación modifica clones y ramas de otras personas. La revocación es la protección efectiva; limpiar el historial puede realizarse después como tarea separada.

## Condiciones antes del piloto

- `npm run preflight` termina correctamente.
- `ALLOW_LIVE_MESSAGES=false` y la automatización permanece desactivada desde el panel.
- Existe una copia externa cifrada y se comprobó su recuperación.
- Las credenciales se cargaron en Render, no en GitHub ni en archivos compartidos.
- El piloto utiliza contactos autorizados y no datos de clientes ajenos a la prueba.
