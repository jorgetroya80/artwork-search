# syntax=docker/dockerfile:1

# Keep in sync with .nvmrc
FROM --platform=$BUILDPLATFORM node:24.18.0-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Theme name from src/themes; the build fails on an unknown one
ARG VITE_THEME=gallery
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.30.5-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
