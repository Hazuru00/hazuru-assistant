FROM node:20-alpine

RUN apk add --no-cache fontconfig font-dejavu

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p logs uploads uploads/fonts backups && chown -R node:node logs uploads backups

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/status || exit 1

CMD ["node", "src/index.js"]
