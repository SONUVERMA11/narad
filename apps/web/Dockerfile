# Narad web app — static build served by nginx. Build arg sets the signaling host.
FROM node:22-alpine AS build
ARG VITE_SIGNALING_URL=wss://signaling.narad.local/ws
ENV VITE_SIGNALING_URL=$VITE_SIGNALING_URL
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @narad/web... --prod=false
COPY packages/core packages/core
COPY apps/web apps/web
RUN pnpm --filter @narad/web build

FROM nginx:1.27-alpine
COPY infra/selfhost/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
