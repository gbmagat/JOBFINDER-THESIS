#!/usr/bin/env bash
set -Eeuo pipefail
api_pid=""
web_pid=""

# Keep the API loopback-only, with one unprivileged same-origin web endpoint.
# Both processes stop when either fails; Docker must not report a half-live app.
stop_children() {
  trap - TERM INT
  if [[ -n "$web_pid" ]]; then kill -QUIT "$web_pid" 2>/dev/null || true; fi
  if [[ -n "$api_pid" ]]; then kill -TERM "$api_pid" 2>/dev/null || true; fi
  if [[ -n "$web_pid" ]]; then wait "$web_pid" 2>/dev/null || true; fi
  if [[ -n "$api_pid" ]]; then wait "$api_pid" 2>/dev/null || true; fi
}
trap 'stop_children; exit 143' TERM
trap 'stop_children; exit 130' INT
mkdir -p /tmp/jobfinder-client /tmp/jobfinder-proxy
node /app/docker/api.mjs &
api_pid=$!
nginx -c /app/docker/nginx.conf -g 'daemon off;' &
web_pid=$!
set +e
wait -n "$api_pid" "$web_pid"
status=$?
stop_children
if [[ "$status" -eq 0 ]]; then status=1; fi
exit "$status"
