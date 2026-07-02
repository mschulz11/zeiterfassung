# syntax=docker/dockerfile:1.7
# Multi-Stage Dockerfile für die Zeiterfassung-PWA.
# Targets:
#   dev  – Live-Reload-Dev-Server (npm run dev, Port 5173)
#   build – nur Build-Artefakte (dist/)
#   prod  – fertiger nginx-Container (Port 80)
#
# Bauen:
#   docker build --target prod -t zeiterfassung:latest .
# Bauen Dev:
#   docker build --target dev -t zeiterfassung:dev .

ARG NODE_VERSION=22

# ---------------- base ----------------
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV NPM_CONFIG_LOGLEVEL=warn \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# ---------------- dev ----------------
FROM base AS dev
ENV NODE_ENV=development
# Wir installieren deps einmalig ins Image — der Source-Code wird vom
# Compose-Volume gemounted und beim Speichern automatisch neu geladen.
COPY package.json package-lock.json ./
RUN npm install
EXPOSE 5173
# --host sorgt dafür, dass Vite von außerhalb des Containers erreichbar ist.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---------------- build ----------------
FROM base AS build
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------------- prod ----------------
FROM nginx:1.27-alpine AS prod
LABEL org.opencontainers.image.title="Zeiterfassung" \
      org.opencontainers.image.description="Persönliche Zeiterfassung PWA" \
      org.opencontainers.image.licenses="MIT"

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Tiny healthcheck – nginx reicht aus, der Service Worker & PWA-Shell
# werden clientseitig getestet.
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
