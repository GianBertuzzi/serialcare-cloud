FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm install --global npm@11.18.0 \
  && npm ci --omit=dev \
  && npm cache clean --force

COPY --chown=node:node src ./src

USER node

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3004/health', response => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/apps/inventarioDocumentos.server.js"]