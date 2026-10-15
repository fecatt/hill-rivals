FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY dist ./dist
COPY server ./server
COPY test ./test
COPY scripts ./scripts
RUN npm run build
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]
ENV ROOM_STORE_FILE=/app/data/rooms.json
USER node
ENV HOST=0.0.0.0 PORT=3107 NODE_ENV=production TRUST_PROXY=1
EXPOSE 3107
CMD ["node", "server/index.js"]
