#!/usr/bin/env sh
set -eu

python "$(dirname "$0")/audit_data.py" "$@"
