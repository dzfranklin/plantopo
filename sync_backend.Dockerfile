# syntax=docker/dockerfile:1

FROM golang:1.21.1-bookworm as build
WORKDIR /build
ARG APP_ENV

COPY go.* ./
RUN go mod download

COPY sync_backend sync_backend
COPY api/v1 api/v1
COPY api/sync_schema api/sync_schema
COPY db db
RUN go build -o ./sync_backend/sync_backend -race ./sync_backend

FROM debian:bookworm
LABEL org.opencontainers.image.source="https://github.com/dzfranklin/plantopo"

RUN mkdir -p /app
COPY --from=build /build/sync_backend/sync_backend /app/sync_backend

ENV TZ=UTC
ENV APP_ENV=$APP_ENV

ENTRYPOINT ["/app/sync_backend"]
