# Construir desde la raíz del repositorio, no desde servidor/:
#   docker build -f servidor/Dockerfile -t sereno-servidor .
#
# El servidor importa el dominio de la app por el alias @/* → ../src/*, así
# que `src/` tiene que estar en el contexto de construcción.

FROM node:24-slim AS construccion
WORKDIR /app
COPY package.json package-lock.json ./
COPY src ./src
COPY servidor/package.json servidor/package-lock.json ./servidor/
RUN npm ci --prefix servidor
COPY servidor ./servidor
RUN npm --prefix servidor run build

FROM node:24-slim AS ejecucion
WORKDIR /app
ENV NODE_ENV=production
# `tsup` deja las dependencias fuera del bundle a propósito —empaquetarlas
# rompería los módulos con cargas dinámicas—, así que la imagen las necesita.
# Solo las de producción: ni Vitest ni el compilador.
COPY servidor/package.json servidor/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Y lo compilado, con las migraciones que corren al arrancar.
COPY --from=construccion /app/servidor/dist ./dist
COPY --from=construccion /app/servidor/drizzle ./drizzle
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
