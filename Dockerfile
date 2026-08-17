FROM node:22-slim

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV CI=1
ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --ignore-scripts=false

COPY . .

RUN npm run build

EXPOSE 10000

CMD ["node", "dist/server.cjs"]
