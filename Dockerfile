FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --no-audit --no-fund
COPY server server
COPY client client
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends restic ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/client/package.json client/package.json
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
COPY scripts/storage.cjs scripts/storage.cjs
RUN mkdir -p /app/data /app/backups /app/media && chown -R node:node /app
USER node
ENV TURSO_DATABASE_URL=file:/app/data/iphone-culture.db BACKUP_DIR=/app/backups MEDIA_DIR=/app/media RESTIC_CACHE_DIR=/app/backups/restic-cache
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/dist/index.js"]
