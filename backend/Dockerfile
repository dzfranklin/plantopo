# syntax=docker/dockerfile:1

FROM golang:1.22 AS build

WORKDIR /app

RUN apt update && apt install -y --no-install-recommends \
    ca-certificates \
    proj-data libproj-dev proj-bin && \
    rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY . ./

RUN GOOS=linux go build ./cmd/api

ENTRYPOINT ["/app/api"]
