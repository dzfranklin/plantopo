# syntax=docker/dockerfile:1

# FROM rust:bookworm as buildRust
# WORKDIR /app

# COPY map_sources ./
# RUN cd ./map_sources && cargo run -- .

FROM golang:1.21.1-bookworm as buildGo
WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .

RUN cd ./api/sync_schema && go run ./gen
RUN go build -o ./out/server ./api/server

FROM debian:bookworm

COPY --from=buildGo /app/out/server /server

ENV PORT=8080
EXPOSE $PORT
CMD ["/server"]