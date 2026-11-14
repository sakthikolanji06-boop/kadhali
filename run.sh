#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
args=("$@")
if [ $# -ge 1 ] && [[ "$1" =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then
  args=(--host "$1" "${@:2}")
fi
exec python3 server.py "${args[@]}"
