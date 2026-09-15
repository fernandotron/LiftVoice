# 🎙️ LiftVoice - Production Multi-stage Dockerfile for Railway / Cloud
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Build Client (Vite + React)
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client ./client
RUN cd client && npm run build

# 2. Install Server Dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# 3. Lean Runtime Container
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DEEPGRAM_API_KEY=""
ENV PREFERRED_ENGINE=auto

# Copy built frontend assets
COPY --chown=node:node --from=builder /app/client/dist ./client/dist

# Copy server modules and source code
COPY --chown=node:node --from=builder /app/server/node_modules ./server/node_modules
COPY --chown=node:node server ./server
COPY --chown=node:node package.json ./

# Pre-crear directorio de persistencia para userManager.js y asignar permisos a node
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data

# Cambiar a usuario no privilegiado antes de ejecutar el servidor
USER node

EXPOSE 3001

CMD ["node", "server/src/index.js"]
