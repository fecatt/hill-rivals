FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY dist ./dist
COPY server ./server
USER node
ENV HOST=0.0.0.0 PORT=3107 NODE_ENV=production
EXPOSE 3107
CMD ["node", "server/index.js"]
