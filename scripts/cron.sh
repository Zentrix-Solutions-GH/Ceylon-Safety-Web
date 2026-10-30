#!/usr/bin/env bash
# scripts/cron.sh — calls /api/cron/<job> with the cron secret.
# The secret is read from a file with tight permissions, never passed on the
# command line.  See infrastructure design section 9 (cron.sh, Path A).
#
# Usage:
#   bash scripts/cron.sh <job-name>
#
# Setup (once, on the server):
#   echo "your-cron-secret" > ~/.cron-secret
#   chmod 600 ~/.cron-secret
#
# cPanel cron entry example (every 5 minutes):
#   */5 * * * * /bin/bash /home/<user>/app/scripts/cron.sh test

set -euo pipefail

JOB="${1:?Usage: cron.sh <job-name>}"

# Read secret from file with tight permissions; never from the cron line itself.
SECRET_FILE="${CRON_SECRET_FILE:-$HOME/.cron-secret}"
if [ ! -f "$SECRET_FILE" ]; then
  echo "[cron.sh] ERROR: secret file not found: $SECRET_FILE" >&2
  exit 1
fi
CRON_SECRET="$(cat "$SECRET_FILE")"

APP_URL="${APP_URL:?APP_URL must be set (e.g. https://ceylonsafety.com for production or the staging URL)}"

curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "x-cron-secret: ${CRON_SECRET}" \
  "${APP_URL}/api/cron/${JOB}"
