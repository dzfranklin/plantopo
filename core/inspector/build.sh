#!/usr/bin/env bash

script_dir=$(dirname -- "$(readlink -f -- "$0")")
build_dir="$script_dir/../build/"

mkdir -p "$build_dir" || exit 1
pushd "$script_dir/../build/" || exit 1

cmake ../ && make

popd || exit 1
