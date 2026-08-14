# Dockerfile para iPhone Culture Dashboard
# Single-stage build: todo en una imagen para evitar problemas con better-sqlite3

FROM node:22

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Crear directorio para SQLite persistente
RUN mkdir -p /app/data

# Variables de entorno
ENV PORT=3001
ENV NODE_ENV=production
ENV DB_PATH=/app/data/iphone-culture.db

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
