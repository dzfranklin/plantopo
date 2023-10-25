# syntax=docker/dockerfile:1

FROM golang:1.21.1-bookworm as build
WORKDIR /build

COPY go.* ./
RUN go mod download

COPY matchmaker matchmaker
COPY api/v1 api/v1
RUN go build -o ./matchmaker/matchmaker -race ./matchmaker

FROM debian:bookworm
LABEL org.opencontainers.image.source="https://github.com/dzfranklin/plantopo"

RUN mkdir -p /app
COPY --from=build /build/matchmaker/matchmaker /app/matchmaker

ENV TZ=UTC
ENV APP_ENV=production

ENTRYPOINT ["/app/matchmaker"]
