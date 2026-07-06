#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/root/hermes-agent}"
RUNTIME_VENV="${RUNTIME_VENV:-/opt/hermes-runtime/.venv}"
RUNTIME_USER="${RUNTIME_USER:-hermes}"
RUNTIME_GROUP="${RUNTIME_GROUP:-hermes}"
PYTHON_BIN="$RUNTIME_VENV/bin/python"
RUNTIME_EXTRA_PACKAGES="${RUNTIME_EXTRA_PACKAGES:-aiohttp}"
TAILNET_IP="${TAILNET_IP:-100.107.234.45}"
GATEWAY_PORT="${GATEWAY_PORT:-8642}"
DASHBOARD_PORT="${DASHBOARD_PORT:-9119}"
SERVICES=(hermes-gateway.service hermes-dashboard.service)
SMOKE_URLS=(
  "http://$TAILNET_IP:$DASHBOARD_PORT/"
  "http://$TAILNET_IP:$GATEWAY_PORT/health"
)
ENV_FILE="${ENV_FILE:-/etc/hermes/hermes.env}"
RUNTIME_HOME="${RUNTIME_HOME:-/var/lib/hermes}"
HERMES_HOME="${HERMES_HOME:-$RUNTIME_HOME/.hermes}"
LOG_DIR="${LOG_DIR:-/var/log/hermes}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'EOF'
Usage: sudo scripts/deploy-hermes-runtime.sh [options]

Deploy the current repo commit into the packaged Hermes runtime venv, restart
systemd services, and smoke-test dashboard + gateway.

Options:
  --help                Show this help.

Environment overrides:
  REPO_ROOT=/root/hermes-agent
  RUNTIME_VENV=/opt/hermes-runtime/.venv
  RUNTIME_USER=hermes
  TAILNET_IP=100.107.234.45
  GATEWAY_PORT=8642
  DASHBOARD_PORT=9119
  ENV_FILE=/etc/hermes/hermes.env
  RUNTIME_HOME=/var/lib/hermes
  HERMES_HOME=/var/lib/hermes/.hermes
  RUNTIME_EXTRA_PACKAGES="aiohttp"
EOF
}

write_systemd_units() {
  cat >/etc/systemd/system/hermes-gateway.service <<EOF
[Unit]
Description=Hermes Agent Gateway - Messaging Platform Integration
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=$RUNTIME_USER
Group=$RUNTIME_GROUP
WorkingDirectory=$HERMES_HOME
EnvironmentFile=$ENV_FILE
ExecStart=$RUNTIME_VENV/bin/python -m hermes_cli.main gateway run
Restart=always
RestartSec=5
RestartForceExitStatus=75
KillMode=mixed
KillSignal=SIGTERM
ExecReload=/bin/kill -USR1 \$MAINPID
ExecStopPost=-$RUNTIME_VENV/bin/python -m gateway.cgroup_cleanup
TimeoutStopSec=210
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

  cat >/etc/systemd/system/hermes-dashboard.service <<EOF
[Unit]
Description=Hermes Agent web dashboard
After=network-online.target hermes-gateway.service
Wants=network-online.target

[Service]
Type=simple
User=$RUNTIME_USER
Group=$RUNTIME_GROUP
WorkingDirectory=$RUNTIME_HOME
EnvironmentFile=$ENV_FILE
ExecStart=$RUNTIME_VENV/bin/hermes dashboard --host $TAILNET_IP --port $DASHBOARD_PORT --no-open --skip-build
Restart=always
RestartSec=5
StandardOutput=append:$LOG_DIR/dashboard.log
StandardError=append:$LOG_DIR/dashboard.log

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[[ $EUID -eq 0 ]] || die "run as root; systemd restart and ownership guards need root"
[[ -d "$REPO_ROOT" ]] || die "repo not found: $REPO_ROOT"
[[ -x "$PYTHON_BIN" ]] || die "runtime python not found: $PYTHON_BIN (install the packaged runtime first)"
id "$RUNTIME_USER" >/dev/null 2>&1 || die "runtime user not found: $RUNTIME_USER"
[[ -f "$ENV_FILE" ]] || die "runtime env file not found: $ENV_FILE"

cd "$REPO_ROOT"

log "repo state"
BRANCH="$(git branch --show-current)"
START_HEAD="$(git rev-parse HEAD)"
printf 'branch=%s\n' "$BRANCH"
printf 'head=%s\n' "$START_HEAD"
git status --short
[[ -z "$(git status --porcelain)" ]] || die "repo has uncommitted changes; commit/push outside this deploy script first"

log "pre-install ownership guard"
chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$RUNTIME_VENV"

log "install hermes-agent into runtime venv"
umask 022
"$PYTHON_BIN" -m pip install --upgrade --force-reinstall "$REPO_ROOT"
if [[ -n "$RUNTIME_EXTRA_PACKAGES" ]]; then
  "$PYTHON_BIN" -m pip install --upgrade $RUNTIME_EXTRA_PACKAGES
fi

log "post-install permission guard"
chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$RUNTIME_VENV"
SITE_PACKAGES="$($PYTHON_BIN - <<'PY'
import site
print(site.getsitepackages()[0])
PY
)"
if [[ -d "$SITE_PACKAGES" ]]; then
  find "$SITE_PACKAGES" -type d -exec chmod a+rx {} +
  find "$SITE_PACKAGES" -type f -exec chmod a+r {} +
  find "$SITE_PACKAGES" -type f -name '*.so' -exec chmod a+rx {} +
fi
if [[ -d "$RUNTIME_VENV/bin" ]]; then
  find "$RUNTIME_VENV/bin" -type f -exec chmod a+rx {} +
fi

log "import smoke as $RUNTIME_USER"
runuser -u "$RUNTIME_USER" -- "$PYTHON_BIN" - <<'PY'
import hermes_cli.main
print(hermes_cli.main.__file__)
PY

log "runtime version"
"$RUNTIME_VENV/bin/hermes" --version | head -12

log "systemd unit guard"
write_systemd_units

log "restart services"
systemctl restart "${SERVICES[@]}"
sleep 8

log "service status"
systemctl is-active "${SERVICES[@]}"

log "http smoke"
SMOKE_DASHBOARD_URL="${SMOKE_URLS[0]}" SMOKE_GATEWAY_URL="${SMOKE_URLS[1]}" \
runuser -u "$RUNTIME_USER" -- "$PYTHON_BIN" - <<'PY'
import os
import urllib.request

urls = [
    (os.environ["SMOKE_DASHBOARD_URL"], {200, 302, 401}),
    (os.environ["SMOKE_GATEWAY_URL"], {200}),
]

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = urllib.request.build_opener(NoRedirect)

for url, ok_statuses in urls:
    try:
        response = opener.open(url, timeout=5)
        print(f"{url} -> {response.status}")
        if response.status not in ok_statuses:
            raise SystemExit(f"unexpected status for {url}: {response.status}")
    except urllib.error.HTTPError as exc:
        print(f"{url} -> {exc.code}")
        if exc.code not in ok_statuses:
            raise
    except Exception as exc:
        print(f"{url} -> {type(exc).__name__}: {exc}")
        raise
PY

log "done"
printf 'deployed_commit=%s\n' "$(git rev-parse HEAD)"
