#!/usr/bin/env bash
exec crlfify-stdio cargo run --package pt_sync_engine -- "$@"
