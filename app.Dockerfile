# syntax=docker/dockerfile:1

FROM node:21.0.0-bookworm as build
LABEL org.opencontainers.image.source="https://github.com/dzfranklin/plantopo"
WORKDIR /build
ARG VER

COPY app/package.json app/package-lock.json ./
RUN npm ci

COPY app/ ./

# Attribution
RUN npx generate-license-file --input package.json --output /tmp/app-third-party-licenses.txt
COPY ./attribution.txt /tmp/attribution.txt
RUN cat /tmp/attribution.txt /tmp/app-third-party-licenses.txt > ./public/third-party-attribution.txt

ENV NEXT_PUBLIC_PT_VER=$VER
RUN NEXT_TELEMETRY_DISABLED=0 npm run build
