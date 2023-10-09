# syntax=docker/dockerfile:1

FROM golang:1.21.1-bookworm as build
WORKDIR /build

COPY go.* ./
RUN go mod download

COPY api_server api_server
COPY api/v1 api/v1
COPY api/sync_schema api/sync_schema
COPY db db
RUN go build -race -o api_server/api_server ./api_server

FROM debian:bookworm
RUN mkdir -p /app
COPY --from=build /build/api_server/api_server /app/api_server
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

ENV TZ=UTC
ENV APP_ENV=production

ENTRYPOINT ["/app/api_server"]