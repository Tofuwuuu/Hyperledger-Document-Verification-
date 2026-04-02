FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js ./

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm","start"]

