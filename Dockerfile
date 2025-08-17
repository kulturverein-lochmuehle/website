# BASE -----------------------------------------------------------------------------------------------
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# BUILDER --------------------------------------------------------------------------------------------
# Rebuild the source code only when needed
FROM base AS build
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
# to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
COPY . /usr/src
WORKDIR /usr/src
ENV CI=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Build all packages
RUN pnpm run -r build
RUN pnpm deploy --filter=@kvlm/ui --prod /prod/demo
RUN pnpm deploy --filter=@kvlm/website --prod /prod/website

# RUNNER UI DEMO -------------------------------------------------------------------------------------
FROM nginx:1.26-alpine-slim AS demo
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /prod/demo/dist /usr/share/nginx/html/demo
CMD ["nginx", "-g", "daemon off;"]

# RUNNER WEBSITE -------------------------------------------------------------------------------------
# Production image, copy all the files and run next
FROM base AS website
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=build /prod/website /app
WORKDIR /app
EXPOSE 8080
ENV PORT=8080
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["npm", "run", "start"]
