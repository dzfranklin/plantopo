#!/usr/bin/env bash

set -uo pipefail

inArg="$1"
outArg="$2"

scratch=$(mktemp -d)
trap '{ rm -rf -- "$scratch"; }' EXIT

pushd() {
    command pushd "$@" > /dev/null || exit 1
}

popd() {
    command popd > /dev/null || exit 1
}

log() {
  echo "$@" 1>&2;
}

function processFile() {
  if [[ -z "$1" ]]; then
    log "Missing inputFile"
    return 1
  fi
  inputFile=$(realpath "$1")

  filename=$(basename -- "$inputFile")
  ext="${filename##*.}"

  if [[ "$ext" = "gz" ]]; then
    innerFilename="${filename%.*}"
    innerFile="$scratch"/"$innerFilename"
    gunzip <"$inputFile" >"$innerFile" || return 1

    processFile "$innerFile"
    return
  fi

  pushd app || exit 1
  npx tsx features/tracks/upload/parseTrackFileCmd.ts "$inputFile"
  status="$?"
  popd || exit 1
  return "$status"
}

: > "$outArg"

failures=0
if [[ -d "$inArg" ]]; then
  for f in "$inArg"/*; do
    if [[ "$f" != *.gpx && "$f" != *.gpx.gz ]]; then
      continue
    fi

    hash=$(md5sum "$f" | awk '{ print $1 }')
    processFile "$f" >"$scratch/$hash.stdout" 2>"$scratch/$hash.stderr"
    if ! processFile "$f" >"$scratch/$hash.stdout" 2>"$scratch/$hash.stderr"; then
      log "Processing $f failed"
      cat "$scratch/$hash.stderr" >&2
      ((failures+=1))
    else
      echo "Processed $f"
      jq -c '.[]' <"$scratch/$hash.stdout" >>"$outArg"
    fi
  done
else
  processFile "$1" >"$outArg"
fi

if [[ "$failures" == 0 ]]; then
  log "Success!"
else
  log "$failures failures"
fi
