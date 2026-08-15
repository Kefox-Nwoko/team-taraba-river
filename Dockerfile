FROM node:20-slim AS base
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/server.ts /app/server.ts
COPY --from=builder /app/server/ /app/server/
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig.json ./

RUN npm ci --omit=dev

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
