# syntax=docker/dockerfile:1
FROM node:20-bookworm AS base
WORKDIR /repo

# Copy only manifests first so `npm ci` is cached unless a dependency changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
RUN npm ci

FROM base AS build
COPY . .
RUN npx prisma generate --schema database/prisma/schema.prisma
RUN npm run build:shared
RUN npm run build -w apps/server

FROM node:20-bookworm-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/server/dist ./apps/server/dist
COPY --from=build /repo/apps/server/package.json ./apps/server/package.json
COPY --from=build /repo/database ./database

EXPOSE 2567
CMD ["node", "apps/server/dist/index.js"]
