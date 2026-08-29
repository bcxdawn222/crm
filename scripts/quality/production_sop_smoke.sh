#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
python scripts/manage.py production-sop-smoke --profile stable
