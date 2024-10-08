#!/usr/bin/env bash
set -euox pipefail

# Install tools

KERNEL=$(uname -s)
ARCH=$(uname -m)
if [ "$KERNEL" != "Linux" ] && [ "$KERNEL" != "Darwin" ] ; then
  echo "KERNEL/Architecture not supported: ${KERNEL}/${ARCH}."
  exit 1
fi
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ] && [ "$ARCH" != "x86_64" ] ; then
  echo "KERNEL/Architecture not supported: ${KERNEL}/${ARCH}"
  exit 1
fi
if [ "$ARCH" = "x86_64" ] ; then
  ARCH="amd64"
fi
if [ "$ARCH" = "aarch64" ] ; then
  ARCH="arm64"
fi

OS="darwin"
if [ "$KERNEL" = "Linux" ]; then
  OS="linux"
  if [ -f /etc/os-release ]; then
    # extract the value for KEY named "NAME"
    DISTRO=$(sed -n -e 's/^NAME="\?\([^"]*\)"\?$/\1/p' /etc/os-release)
    if [ "$DISTRO" = "Alpine Linux" ]; then
      OS="alpine"
    fi
  fi
fi

tools_dir=$(mktemp -d)

staticcheck_url="https://github.com/dominikh/go-tools/releases/latest/download/staticcheck_${OS}_${ARCH}.tar.gz"
curl --proto '=https' --tlsv1.2 -sLSf "$staticcheck_url" -o "$tools_dir/staticcheck.tar.gz"
tar -xvzf $tools_dir/staticcheck.tar.gz --strip-components=1 -C "$tools_dir" staticcheck/staticcheck

tern_url=$(curl --proto '=https' --tlsv1.2 -sLSf 'https://api.github.com/repos/jackc/tern/releases' | \
  jq -r '.[0].assets | .[] | .browser_download_url' | \
  grep "${OS}_${ARCH}")
curl --proto '=https' --tlsv1.2 -sLSf "$tern_url" -o "$tools_dir/tern.tar.gz"
tar -xvzf $tools_dir/tern.tar.gz -C "$tools_dir"

pushd app && npm ci --include=dev && popd

# Run checks

PATH="$tools_dir:$PATH" ./scripts/check-all.sh
