FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
COPY curl2vRO.js ./
COPY server.js ./
COPY public ./public

RUN npm install

EXPOSE 3000

CMD ["node", "server.js"]