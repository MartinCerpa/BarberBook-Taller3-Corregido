FROM node:24-alpine

WORKDIR /app/backend
COPY package.json package-lock.json ./
RUN SCARF_ANALYTICS=false npm ci --omit=dev && npm cache clean --force
COPY src ./src

USER node
EXPOSE 3003
CMD ["node", "src/server.js"]
