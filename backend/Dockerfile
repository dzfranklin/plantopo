# syntax=docker/dockerfile:1

FROM golang:1.23 AS build

ARG TIPPECANOE_VERSION=2.62.0

WORKDIR /app

RUN apt update && apt install -y --no-install-recommends \
    ca-certificates \
    proj-data libproj-dev proj-bin libgdal-dev gdal-bin && \
    rm -rf /var/lib/apt/lists/*

RUN curl -L --fail "https://github.com/felt/tippecanoe/archive/refs/tags/$TIPPECANOE_VERSION.tar.gz" -o tippecanoe.tar.gz && \
    tar -xzvf tippecanoe.tar.gz && \
    cd "tippecanoe-$TIPPECANOE_VERSION" && \
    make -j && \
    make install && \
    cd ../ && \
    rm -r tippecanoe.tar.gz "tippecanoe-$TIPPECANOE_VERSION"

COPY go.mod go.sum ./
RUN go mod download

COPY . ./

RUN GOOS=linux go build ./cmd/api

ENTRYPOINT ["/app/api"]
