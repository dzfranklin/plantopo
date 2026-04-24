FROM node:24 AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json    ./packages/api/
COPY packages/web/package.json    ./packages/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY esbuild.config.mjs ./

ARG COMMIT_HASH=unknown
ENV VITE_COMMIT_HASH=$COMMIT_HASH
RUN npm -w packages/web run build
RUN node esbuild.config.mjs

FROM node:24 AS production
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json    ./packages/api/
COPY packages/web/package.json    ./packages/web/
RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist/index.js ./packages/shared/dist/index.js
COPY --from=builder /app/server.js      ./server.js
COPY --from=builder /app/server.js.map  ./server.js.map
COPY --from=builder /app/migrate.js     ./migrate.js
COPY --from=builder /app/migrate.js.map ./migrate.js.map
COPY --from=builder /app/run-task.js     ./run-task.js
COPY --from=builder /app/run-task.js.map ./run-task.js.map
RUN printf '#!/bin/sh\nexec node --enable-source-maps /app/run-task.js "$@"\n' \
    > /usr/local/bin/run-task && chmod +x /usr/local/bin/run-task
COPY --from=builder /app/packages/web/dist/ ./static/
COPY drizzle/ ./drizzle/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENV WEB_DIST=/app/static
ENV NODE_ENV=production
EXPOSE 3030
CMD ["./entrypoint.sh"]
