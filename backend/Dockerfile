# syntax=docker/dockerfile:1

FROM golang:1.22 AS build

WORKDIR /app

RUN apt update && apt install -y libproj-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . ./

RUN GOOS=linux go build -o /api ./cmd/api

FROM ubuntu:focal AS release

WORKDIR /

RUN apt update && apt install -y proj-data libproj-dev proj-bin

COPY --from=build /api /api

USER nonroot:nonroot

ENTRYPOINT ["/api"]
