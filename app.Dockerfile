# syntax=docker/dockerfile:1

FROM node:21.0.0-bookworm as build
LABEL org.opencontainers.image.source="https://github.com/dzfranklin/plantopo"
WORKDIR /build

COPY app/package.json app/package-lock.json ./
RUN npm ci

COPY app/ ./
RUN NEXT_TELEMETRY_DISABLED=0 npm run build
