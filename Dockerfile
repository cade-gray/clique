# syntax=docker/dockerfile:1

# Clique is one Express process that serves both the API and the built dist/, so the image
# runs Node rather than nginx. Three stages keep the build tools and dev dependencies out of
# the final image. This file is only for the Droplet deploy; IIS hosting still uses web.config.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js index.html ./
COPY src ./src
RUN npm run build

# Production dependencies only (Express and yaml), installed from the same lockfile.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
# The board is a volume mounted here. Create it owned by node so the app can write on first
# start; the example data in the repo is deliberately not copied into the image, so a deploy
# can never overwrite the real board.
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
