#syntax=docker/dockerfile:1

FROM node:24-slim AS base
WORKDIR /app
# Base for production and test images. Does not contain built assets

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends unzip && \
    rm -rf /var/lib/apt/lists/*

FROM node:24 AS builder
WORKDIR /build

ADD "https://github.com/dzfranklin/plantopo/releases/download/fonts/Source_Sans_3.zip" fonts.zip
RUN unzip fonts.zip -d Source_Sans_3 && mkdir -p ./fonts && mv Source_Sans_3/static/*.ttf ./fonts/

ENV CI=true

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json    ./packages/api/
COPY packages/web/package.json    ./packages/web/

# Install and copy server production dependencies
RUN NODE_ENV=production npm ci -w @pt/api && \
    mkdir -p /app && cp -R node_modules /app/node_modules && rm -r /app/node_modules/@pt/*

# Install all dependencies
RUN NODE_ENV= npm ci

COPY --link tsconfig.base.json ./

COPY --link packages/shared/ ./packages/shared/
RUN npm run build -w @pt/shared \
    && cp -r ./packages/shared /app/node_modules/@pt/

COPY --link packages/api ./packages/api/
RUN npm run build -w @pt/api \
    && cp -r ./packages/api/dist /app/

COPY --link packages/web ./packages/web/
ARG COMMIT_HASH=unknown
RUN <<EOF
    build_output=$(VITE_COMMIT_HASH="$COMMIT_HASH" NO_COLOR=true npm run build -w @pt/web 2>&1)
    status=$?
    echo "$build_output"
    [ $status -eq 0 ] || exit $status

    mv ./packages/web/dist /app/static

    msg="$(echo "$build_output" | grep -v '^\s*>\s' | grep '.')"
    printf "### Web build output\n\`\`\`\n%s\n\`\`\`" "$msg" >>/build-summary.md
EOF

COPY --link drizzle/ /app/drizzle/

FROM base AS test
WORKDIR /test
# Image for running tests in CI. No built assets.
# Usage: mount /packages at /test/packages and run

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postgresql-common ca-certificates && \
    /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postgresql-18-postgis-3 redis-server && \
    rm -rf /var/lib/apt/lists/*

COPY <<EOF /etc/postgresql/18/main/pg_hba.conf
local all all trust
host all all 0.0.0.0/0 trust
host all all ::0/0 trust
EOF

COPY <<EOF /etc/redis/redis.conf
bind 0.0.0.0
protected-mode no
daemonize yes
EOF

COPY --link --from=builder /build/fonts/ /fonts/
COPY --link --chmod=+x scripts/test-entrypoint.sh /
COPY --link package.json package-lock.json tsconfig.base.json vitest.config.ts ./
COPY --link --from=builder /build/node_modules ./node_modules/
COPY --link --from=builder /app/drizzle ./drizzle/
COPY --link --from=builder /build-summary.md /build-summary.md

ENV CI=true FONTS_DIR=/fonts
ENTRYPOINT ["/test-entrypoint.sh"]
CMD ["npm", "test", "--", "--run"]

FROM base AS production
WORKDIR /app

COPY --link --chmod=+x entrypoint.sh ./
COPY --link --chmod=+x scripts/run-task /usr/local/bin/run-task
COPY --link --from=builder /build/fonts/ /fonts/
COPY --from=builder /app/ ./

ENV WEB_DIST=/app/static FONTS_DIR=/fonts NODE_ENV=production
EXPOSE 3030
ENTRYPOINT ["./entrypoint.sh"]
