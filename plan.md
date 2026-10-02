# PLAN — iPhone Culture Dashboard (10/10)

Objetivo: construir el dashboard completo según `SPEC.md`, funcional de punta a punta, con estética moderna dark/neon.

## Stage 0 — Scaffold (Orquestador, hecho)
- Monorepo npm workspaces: `server/` (Express + TS + @libsql/client, SQLite local si no hay Turso) y `client/` (Vite + React + TS + Tailwind).
- Contratos compartidos escritos por el orquestador: `db.ts` (schema + seeds), `auth.ts` (JWT), `index.ts`, `lib/api.ts`, `lib/auth.tsx`, `App.tsx` (router completo), `components/ui.tsx` (design system), stubs de todas las rutas/páginas → el proyecto compila antes del swarm.

## Stage 1 — Swarm de 10 agentes (paralelo, scopes sin conflicto)
| # | Agente | Archivos propios |
|---|--------|------------------|
| 1 | Backend_Auth_Admin | routes/auth.ts, routes/push.ts, routes/admin.ts |
| 2 | Backend_Ventas_Facturas | routes/ventas.ts, routes/facturas.ts |
| 3 | Backend_Turnos | routes/turnos.ts |
| 4 | Backend_Catalogo_Stock_Cuotero | routes/catalogo.ts, routes/stock.ts, routes/cuotero.ts |
| 5 | Backend_Extras | routes/noticias.ts, routes/mensajes.ts, routes/leads.ts, routes/extras.ts |
| 6 | Frontend_Login_Layout | pages/Login.tsx, components/Layout.tsx |
| 7 | Frontend_Dashboard | pages/Dashboard.tsx |
| 8 | Frontend_Ventas_Facturas | pages/Ventas.tsx, pages/Facturas.tsx, lib/facturaPdf.ts, pages/ComprobantePublico.tsx |
| 9 | Frontend_Turnos_Leads | pages/Turnos.tsx, pages/Leads.tsx |
| 10 | Frontend_Cuotero_Catalogo_Stock_Admin | pages/Cuotero.tsx, pages/Catalogo.tsx, pages/Stock.tsx, pages/Admin.tsx |

Reglas: cada agente solo toca sus archivos; prohibido modificar package.json, db.ts, auth.ts, App.tsx, ui.tsx, index.ts, api.ts.

## Stage 2 — Integración y verificación (Orquestador)
- `npm run build` completo (server + client), levantar server, smoke-test de endpoints clave con curl.
- Reanudar agentes que fallen; fixes mecánicos propios si es menor.

## Stage 3 — Verificación visual (kimi-webbridge)
- Abrir la app en el browser real, login como admin y closer, screenshots, chequeo de estética.

## Entregable
- App corriendo local (Express sirve API + build de React), lista para deploy Railway.
