#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
exec python "$ROOT_DIR/scripts/quality/security_flow_test.py" "$@"
