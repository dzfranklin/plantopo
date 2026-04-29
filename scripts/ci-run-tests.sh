#!/bin/bash
set -euox pipefail

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]] && [[ ! -f "$GITHUB_STEP_SUMMARY" ]]; then
  touch "$GITHUB_STEP_SUMMARY"
fi

set | grep GITHUB >/tmp/github-env.txt

docker run --rm \
  --env-file /tmp/github-env.txt \
  --mount type=bind,source="$(pwd)"/packages,target=/test/packages \
  --mount type=bind,source="$GITHUB_STEP_SUMMARY",target="$GITHUB_STEP_SUMMARY" \
  plantopo-test
