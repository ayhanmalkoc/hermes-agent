#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/root/hermes-agent}"
RUNTIME_DIR="${RUNTIME_DIR:-/usr/local/lib/hermes-agent}"
RUNTIME_VENV="${RUNTIME_VENV:-$RUNTIME_DIR/venv}"
RUNTIME_USER="${RUNTIME_USER:-hermes}"
RUNTIME_GROUP="${RUNTIME_GROUP:-hermes}"
RUNTIME_HOME="${RUNTIME_HOME:-/var/lib/hermes}"
HERMES_HOME="${HERMES_HOME:-$RUNTIME_HOME/.hermes}"
LOG_DIR="${LOG_DIR:-/var/log/hermes}"
TAILNET_IP="${TAILNET_IP:-100.107.234.45}"
GATEWAY_PORT="${GATEWAY_PORT:-8642}"
DASHBOARD_PORT="${DASHBOARD_PORT:-9119}"
PYTHON_BIN="$RUNTIME_VENV/bin/python"
HERMES_BIN="$RUNTIME_VENV/bin/hermes"
UV_BIN="${UV_BIN:-$(command -v uv || true)}"
SERVICES=(hermes-gateway.service hermes-dashboard.service)
SMOKE_URLS=(
  "http://$TAILNET_IP:$DASHBOARD_PORT/"
  "http://$TAILNET_IP:$GATEWAY_PORT/health"
)

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'USAGE'
Usage: sudo scripts/deploy-hermes-runtime.sh [options]

Deploy the current repo commit into the official Hermes runtime layout,
restart systemd services, and smoke-test dashboard + gateway.

Options:
  --help                Show this help.

Environment overrides:
  REPO_ROOT=/root/hermes-agent
  RUNTIME_DIR=/usr/local/lib/hermes-agent
  RUNTIME_VENV=/usr/local/lib/hermes-agent/venv
  RUNTIME_USER=hermes
  RUNTIME_HOME=/var/lib/hermes
  HERMES_HOME=/var/lib/hermes/.hermes
  TAILNET_IP=100.107.234.45
  GATEWAY_PORT=8642
  DASHBOARD_PORT=9119
USAGE
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

write_systemd_units() {
  cat >/etc/systemd/system/hermes-gateway.service <<EOF_UNIT
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
Environment=HOME=$RUNTIME_HOME
Environment=USER=$RUNTIME_USER
Environment=LOGNAME=$RUNTIME_USER
Environment=PATH=$RUNTIME_VENV/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=VIRTUAL_ENV=$RUNTIME_VENV
Environment=HERMES_HOME=$HERMES_HOME
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
EOF_UNIT

  cat >/etc/systemd/system/hermes-dashboard.service <<EOF_UNIT
[Unit]
Description=Hermes Agent web dashboard
After=network-online.target hermes-gateway.service
Wants=network-online.target

[Service]
Type=simple
User=$RUNTIME_USER
Group=$RUNTIME_GROUP
WorkingDirectory=$RUNTIME_HOME
Environment=HOME=$RUNTIME_HOME
Environment=USER=$RUNTIME_USER
Environment=LOGNAME=$RUNTIME_USER
Environment=PATH=$RUNTIME_VENV/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=VIRTUAL_ENV=$RUNTIME_VENV
Environment=HERMES_HOME=$HERMES_HOME
ExecStart=$RUNTIME_VENV/bin/hermes dashboard --host $TAILNET_IP --port $DASHBOARD_PORT --no-open --skip-build
Restart=always
RestartSec=5
StandardOutput=append:$LOG_DIR/dashboard.log
StandardError=append:$LOG_DIR/dashboard.log

[Install]
WantedBy=multi-user.target
EOF_UNIT

  systemctl daemon-reload
}

permission_guard() {
  chown -R root:root "$RUNTIME_DIR"
  find "$RUNTIME_DIR" -type d -exec chmod a+rx {} +
  find "$RUNTIME_DIR" -type f -exec chmod a+r {} +
  find "$RUNTIME_VENV/bin" -type f -exec chmod a+rx {} +
  find "$RUNTIME_DIR" -type f -name '*.so' -exec chmod a+rx {} +
  chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$RUNTIME_HOME" "$LOG_DIR"
}

[[ $EUID -eq 0 ]] || die "run as root; systemd restart and runtime ownership need root"
[[ -d "$REPO_ROOT" ]] || die "repo not found: $REPO_ROOT"
[[ -d "$RUNTIME_DIR/.git" ]] || die "runtime git checkout not found: $RUNTIME_DIR"
[[ -x "$PYTHON_BIN" ]] || die "runtime python not found: $PYTHON_BIN (bootstrap runtime first)"
id "$RUNTIME_USER" >/dev/null 2>&1 || die "runtime user not found: $RUNTIME_USER"
[[ -d "$HERMES_HOME" ]] || die "HERMES_HOME not found: $HERMES_HOME"

cd "$REPO_ROOT"
log "repo state"
BRANCH="$(git branch --show-current)"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-${BRANCH:-studio}}"
START_HEAD="$(git rev-parse HEAD)"
printf 'branch=%s\n' "$BRANCH"
printf 'deploy_branch=%s\n' "$DEPLOY_BRANCH"
printf 'head=%s\n' "$START_HEAD"
git status --short
[[ -z "$(git status --porcelain)" ]] || die "repo has uncommitted changes; commit/push outside this deploy script first"

log "update runtime checkout"
cd "$RUNTIME_DIR"
git fetch origin "$DEPLOY_BRANCH"
git checkout --detach "$START_HEAD"

log "install hermes-agent into official venv"
if [[ -n "$UV_BIN" ]]; then
  "$UV_BIN" pip install --python "$PYTHON_BIN" -e '.[all]'
else
  "$PYTHON_BIN" -m pip install -e '.[all]'
fi

log "build dashboard web assets"
npm install --workspace web
npm run build -w web

log "permission guard"
permission_guard

log "command shim"
cat >/usr/local/bin/hermes <<EOF_SHIM
#!/usr/bin/env bash
unset PYTHONPATH
unset PYTHONHOME
export HERMES_HOME="$HERMES_HOME"
export HOME="$RUNTIME_HOME"
exec "$HERMES_BIN" "\$@"
EOF_SHIM
chmod 0755 /usr/local/bin/hermes

log "import smoke as $RUNTIME_USER"
runuser -u "$RUNTIME_USER" -- env HOME="$RUNTIME_HOME" HERMES_HOME="$HERMES_HOME" "$PYTHON_BIN" - <<'PY'
import hermes_cli.main
print(hermes_cli.main.__file__)
PY

log "runtime version"
runuser -u "$RUNTIME_USER" -- env HOME="$RUNTIME_HOME" HERMES_HOME="$HERMES_HOME" "$HERMES_BIN" --version | head -12

log "systemd unit guard"
write_systemd_units
systemctl enable "${SERVICES[@]}" >/dev/null

log "restart services"
systemctl restart "${SERVICES[@]}"
sleep 8

log "service status"
systemctl is-active "${SERVICES[@]}"

log "http smoke"
SMOKE_DASHBOARD_URL="${SMOKE_URLS[0]}" SMOKE_GATEWAY_URL="${SMOKE_URLS[1]}" \
runuser -u "$RUNTIME_USER" -- env HOME="$RUNTIME_HOME" HERMES_HOME="$HERMES_HOME" "$PYTHON_BIN" - <<'PY'
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
        response = opener.open(url, timeout=10)
        print(f"{url} -> {response.status}")
        if response.status not in ok_statuses:
            raise SystemExit(f"unexpected status for {url}: {response.status}")
    except urllib.error.HTTPError as exc:
        print(f"{url} -> {exc.code}")
        if exc.code not in ok_statuses:
            raise
PY

log "done"
printf 'deployed_commit=%s\n' "$START_HEAD"
