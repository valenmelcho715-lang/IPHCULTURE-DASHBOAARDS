# Migración verificable de la base vigente

El objetivo es incorporar Atención IA sin perder ni reescribir usuarios, stock, catálogo, ventas, turnos, leads u otros datos existentes. La extracción y la migración se prueban siempre sobre copias; nunca sobre la base activa.

## Ensayo previo

1. Crear una credencial temporal de solo el alcance necesario para leer la base libSQL/Turso vigente. Guardarla fuera de Git.
2. Definir `SOURCE_DATABASE_URL` y `SOURCE_AUTH_TOKEN` en `.env.local`.
3. Elegir una ruta privada que todavía no exista y ejecutar:

   ```sh
   npm run migration:export -- /ruta/privada/iphone-culture-export.db
   npm run migration:check -- /ruta/privada/iphone-culture-export.db
   ```

4. Revisar el informe `iphone-culture-export.db.json` y `artifacts/migration.json`. Deben indicar integridad `ok`, los recuentos esperados, archivos fuente intactos y todas las filas heredadas sin cambios.
5. Arrancar staging con esa copia, `ALLOW_LIVE_MESSAGES=false` y Atención IA desactivada. Comprobar acceso de administración, stock, ventas, turnos, catálogo y vendedores.

El exportador copia tablas, vistas, índices, disparadores, texto Unicode y BLOB. Escribe primero un archivo parcial con permisos privados, comprueba claves foráneas e integridad y recién después lo renombra al destino final. Nunca reemplaza un archivo existente ni muestra las credenciales.

## Corte definitivo

1. Anunciar una ventana breve sin escrituras en el sistema anterior.
2. Crear una exportación nueva; no reutilizar la copia del ensayo.
3. Repetir `migration:check` y comparar los recuentos con el panel anterior.
4. Guardar una copia cifrada independiente antes de iniciar la nueva versión.
5. Montar la base verificada en el volumen persistente con la automatización y los envíos reales desactivados.
6. Validar con administración y luego retirar el modo sin escrituras.

Si cualquier recuento difiere o la integridad no es `ok`, se cancela el corte y se conserva el sistema anterior sin modificaciones.
