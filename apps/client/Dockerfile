# syntax=docker/dockerfile:1
FROM node:20-bookworm AS base
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
RUN npm ci

FROM base AS build
COPY . .
ARG VITE_SERVER_HTTP_URL=http://localhost:2567
ARG VITE_SERVER_WS_URL=ws://localhost:2567
ENV VITE_SERVER_HTTP_URL=$VITE_SERVER_HTTP_URL
ENV VITE_SERVER_WS_URL=$VITE_SERVER_WS_URL
RUN npm run build:shared
RUN npm run build -w apps/client

FROM nginx:1.27-alpine AS runtime
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/client/dist /usr/share/nginx/html
EXPOSE 80
