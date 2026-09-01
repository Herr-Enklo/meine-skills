#!/bin/sh
# Führt den automatischen Durchlauf aus. Benötigt node, http-server und playwright (global).
cd "$(dirname "$0")"
NODE_PATH="${NODE_PATH:-$(npm root -g)}" SCRATCH="${SCRATCH:-/tmp}" node test/run.mjs "$@"
