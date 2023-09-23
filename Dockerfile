# syntax=docker/dockerfile:1

FROM golang:1.21.1-bookworm as buildGo
WORKDIR /build

COPY go.* ./
RUN go mod download

COPY sources ./sources
COPY api ./api

RUN go run ./sources
RUN go run ./api/sync_schema/generator

RUN go build -o ./out/server ./api/server

FROM node:bookworm as buildNode
WORKDIR /build

COPY --from=buildGo /build/sources/out/mapSources.json \
  ./app/src/gen/mapSources.json
COPY --from=buildGo /build/api/sync_schema/out/schema.ts \
  ./app/src/gen/sync_schema.ts

RUN mkdir -p ./app
COPY ./app/package*.json ./app
RUN cd ./app && npm ci
COPY ./app ./app
RUN cd ./app && NEXT_TELEMETRY_DISABLED=0 npm run build

FROM debian:bookworm

COPY --from=buildGo /build/out/server /server
COPY --from=buildGo /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=buildNode /build/app/out /build/app

ENV PORT=8080
EXPOSE $PORT
CMD ["/server"]
