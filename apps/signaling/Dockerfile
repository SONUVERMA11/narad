# Narad signaling (Akash) — Node runtime. ~₹400/mo VPS or any container host.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/signaling/package.json apps/signaling/
RUN pnpm install --frozen-lockfile --filter @narad/signaling... --prod=false
COPY packages/core packages/core
COPY apps/signaling apps/signaling
RUN pnpm --filter @narad/signaling build

FROM node:22-alpine
WORKDIR /app/apps/signaling
ENV NODE_ENV=production NARAD_PORT=8794
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/signaling/node_modules ./node_modules
COPY --from=build /app/apps/signaling/dist ./dist
COPY --from=build /app/apps/signaling/package.json ./
EXPOSE 8794
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8794/health || exit 1
CMD ["node", "dist/node.js"]
