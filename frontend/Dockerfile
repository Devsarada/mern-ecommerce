# syntax=docker/dockerfile:1
# =============================================================
# Frontend (React + Vite) - production Dockerfile
# Build context: frontend/ folder
#   docker build -t mern-frontend:local ./frontend
# =============================================================

# ---------- Stage 1: build (React -> static files in /app/dist) ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ---------- Stage 2: runtime (Nginx, non-root, port 8080) ----------
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

LABEL org.opencontainers.image.title="mern-frontend" \
      org.opencontainers.image.description="MERN e-commerce frontend (React build served by Nginx)" \
      org.opencontainers.image.source="https://github.com/burakorkmez/mern-ecommerce"

# Defaults; Compose / Kubernetes mein badal sakte hain
ENV BACKEND_HOST=backend:5000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1