#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$(dirname "$SCRIPT_DIR")")
cd "$PROJECT_ROOT"

: "${CRM_NETWORK_TEST_MARKER:?请设置 CRM_NETWORK_TEST_MARKER}"
python scripts/manage.py network-session-flow --profile test
