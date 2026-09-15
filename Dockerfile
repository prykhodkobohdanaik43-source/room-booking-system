FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY src/backend/package.json src/backend/
COPY src/frontend/package.json src/frontend/
RUN npm ci --omit=dev

COPY src ./src
EXPOSE 3000
CMD ["npm", "start"]
