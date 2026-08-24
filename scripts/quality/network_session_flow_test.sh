#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$(dirname "$SCRIPT_DIR")")
cd "$PROJECT_ROOT"

if [ -z "${CRM_NETWORK_TEST_MARKER:-}" ] && [ -z "${CRM_SESSION_EXPIRY_WAIT_SECONDS:-}" ]; then
  echo "请设置 CRM_NETWORK_TEST_MARKER 或 CRM_SESSION_EXPIRY_WAIT_SECONDS" >&2
  exit 2
fi
python scripts/manage.py network-session-flow --profile test
