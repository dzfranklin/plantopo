# syntax=docker/dockerfile:1

FROM golang:1.23 AS build

RUN apt update && apt install -y --no-install-recommends \
    ca-certificates libvips-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . ./

RUN GOOS=linux go build -o "/staticmap" ./

FROM golang:1.23 AS main

RUN apt update && apt install -y --no-install-recommends \
    ca-certificates libvips-dev && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /staticmap /staticmap

ENTRYPOINT ["/staticmap"]
