#!/usr/bin/env bash
exec crlfify-stdio cargo run --package plantopo_sync_engine -- "$@"
