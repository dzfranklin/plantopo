# syntax=docker/dockerfile:1

FROM golang:1.21.1-bookworm as build
WORKDIR /build

COPY go.* ./
RUN go mod download

COPY sync_backend sync_backend
COPY api/v1 api/v1
COPY api/sync_schema api/sync_schema
COPY db db
RUN go build -o ./sync_backend/sync_backend -race ./sync_backend

FROM debian:bookworm
RUN mkdir -p /app
COPY --from=build /build/sync_backend/sync_backend /app/sync_backend

ENV TZ=UTC
ENV APP_ENV=production

ENTRYPOINT ["/app/sync_backend"]