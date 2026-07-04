#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/root/hermes-agent}"
RUNTIME_VENV="${RUNTIME_VENV:-/opt/hermes-runtime/.venv}"
RUNTIME_USER="${RUNTIME_USER:-hermes}"
RUNTIME_GROUP="${RUNTIME_GROUP:-hermes}"
PYTHON_BIN="$RUNTIME_VENV/bin/python"
SERVICES=(hermes-gateway.service hermes-dashboard.service)
SMOKE_URLS=(
  "http://100.107.234.45:9119/"
  "http://100.107.234.45:8642/health"
)

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root; systemd restart and ownership guards need root"
[[ -d "$REPO_ROOT" ]] || die "repo not found: $REPO_ROOT"
[[ -x "$PYTHON_BIN" ]] || die "runtime python not found: $PYTHON_BIN"
id "$RUNTIME_USER" >/dev/null 2>&1 || die "runtime user not found: $RUNTIME_USER"

cd "$REPO_ROOT"

log "repo state"
git branch --show-current
git rev-parse --short HEAD
git status --short

log "desktop build"
npm --workspace apps/desktop run build

log "pre-install ownership guard"
chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$RUNTIME_VENV"

log "install hermes-agent into runtime venv as $RUNTIME_USER"
runuser -u "$RUNTIME_USER" -- "$PYTHON_BIN" -m pip install "$REPO_ROOT"

log "post-install permission guard"
chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$RUNTIME_VENV"
if [[ -d "$RUNTIME_VENV/lib/python3.12/site-packages/hermes_cli" ]]; then
  find "$RUNTIME_VENV/lib/python3.12/site-packages/hermes_cli" -type d -exec chmod 755 {} +
  find "$RUNTIME_VENV/lib/python3.12/site-packages/hermes_cli" -type f -exec chmod 644 {} +
fi

log "import smoke as $RUNTIME_USER"
runuser -u "$RUNTIME_USER" -- "$PYTHON_BIN" - <<'PY'
import hermes_cli.main
print(hermes_cli.main.__file__)
PY

log "restart services"
systemctl restart "${SERVICES[@]}"
sleep 8

log "service status"
systemctl is-active "${SERVICES[@]}"

log "http smoke"
runuser -u "$RUNTIME_USER" -- "$PYTHON_BIN" - <<'PY'
import urllib.request

urls = [
    "http://100.107.234.45:9119/",
    "http://100.107.234.45:8642/health",
]

for url in urls:
    try:
        response = urllib.request.urlopen(url, timeout=5)
        print(f"{url} -> {response.status}")
    except Exception as exc:
        print(f"{url} -> {type(exc).__name__}: {exc}")
        raise
PY

log "done"

