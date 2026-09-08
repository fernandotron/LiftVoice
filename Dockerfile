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
ENV DEEPGRAM_API_KEY=1f057415ec50bb496a86ec8d8bc9e4f627a57f7d
ENV PREFERRED_ENGINE=auto

# Copy built frontend assets
COPY --from=builder /app/client/dist ./client/dist

# Copy server modules and source code
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY server ./server
COPY package.json ./

EXPOSE 3001

CMD ["node", "server/src/index.js"]
