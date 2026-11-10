# syntax=docker/dockerfile:1
# =============================================================
# Backend (Node.js + Express) - production Dockerfile
# Build context: REPO ROOT (kyunki backend ki dependencies root package.json mein hain)
#   docker build -f backend/Dockerfile -t mern-backend:local .
# =============================================================

# ---------- Stage 1: deps (sirf production dependencies) ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---------- Stage 2: test (CI mein: docker build --target test) ----------
FROM node:22-alpine AS test
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY backend ./backend
RUN npm test

# ---------- Stage 3: runtime (final, chhoti, non-root image) ----------
FROM node:22-alpine AS runtime

LABEL org.opencontainers.image.title="mern-backend" \
      org.opencontainers.image.description="MERN e-commerce backend (Express API)" \
      org.opencontainers.image.source="https://github.com/Devsarada/mern-ecommerce"

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

# Code root ka rahega (read-only), app "node" user se chalegi
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY backend/server.js backend/app.js ./backend/
COPY backend/controllers ./backend/controllers
COPY backend/lib ./backend/lib
COPY backend/middleware ./backend/middleware
COPY backend/models ./backend/models
COPY backend/routes ./backend/routes

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "backend/server.js"]