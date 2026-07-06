#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/root/hermes-agent}"
RUNTIME_ROOT="${RUNTIME_ROOT:-/opt/hermes-runtime}"
RUNTIME_VENV="${RUNTIME_VENV:-$RUNTIME_ROOT/.venv}"
RUNTIME_USER="${RUNTIME_USER:-hermes}"
RUNTIME_GROUP="${RUNTIME_GROUP:-hermes}"
RUNTIME_HOME="${RUNTIME_HOME:-/var/lib/hermes}"
HERMES_HOME="${HERMES_HOME:-$RUNTIME_HOME/.hermes}"
ENV_FILE="${ENV_FILE:-/etc/hermes/hermes.env}"
LOG_DIR="${LOG_DIR:-/var/log/hermes}"
DASHBOARD_CREDS_FILE="${DASHBOARD_CREDS_FILE:-/root/hermes-dashboard-credentials.txt}"
API_CREDS_FILE="${API_CREDS_FILE:-/root/hermes-api-credentials.txt}"
DASHBOARD_USER="${DASHBOARD_USER:-admin}"
DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD:-ayhan}"
TAILNET_IP="${TAILNET_IP:-100.107.234.45}"
MODEL_BASE_URL="${MODEL_BASE_URL:-http://100.107.234.45:20128/v1}"
MODEL_DEFAULT="${MODEL_DEFAULT:-openai-all}"
GATEWAY_PORT="${GATEWAY_PORT:-8642}"
DASHBOARD_PORT="${DASHBOARD_PORT:-9119}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
RUNTIME_EXTRA_PACKAGES="${RUNTIME_EXTRA_PACKAGES:-aiohttp}"
PASSWORDLESS_SUDO=false
FORCE=false

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: sudo scripts/bootstrap-hermes-runtime.sh [options]

Prepare a clean host for the packaged Hermes runtime. This is a one-time
bootstrap script; use deploy-hermes-runtime.sh for normal updates.

Options:
  --passwordless-sudo  Add hermes ALL=(ALL:ALL) NOPASSWD:ALL.
  --force              Overwrite existing env/config/systemd files.
  --help               Show this help.

Environment overrides:
  REPO_ROOT=/root/hermes-agent
  RUNTIME_VENV=/opt/hermes-runtime/.venv
  RUNTIME_USER=hermes
  RUNTIME_HOME=/var/lib/hermes
  HERMES_HOME=/var/lib/hermes/.hermes
  ENV_FILE=/etc/hermes/hermes.env
  TAILNET_IP=100.107.234.45
  MODEL_BASE_URL=http://100.107.234.45:20128/v1
  MODEL_DEFAULT=openai-all
  DASHBOARD_USER=admin
  DASHBOARD_PASSWORD=ayhan
  GATEWAY_PORT=8642
  DASHBOARD_PORT=9119
  RUNTIME_EXTRA_PACKAGES="aiohttp"
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --passwordless-sudo)
      PASSWORDLESS_SUDO=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[[ $EUID -eq 0 ]] || die "run as root"
[[ -d "$REPO_ROOT" ]] || die "repo not found: $REPO_ROOT"
command -v systemctl >/dev/null 2>&1 || die "systemd not found"
command -v "$PYTHON_BIN" >/dev/null 2>&1 || die "python not found: $PYTHON_BIN"

if [[ "$FORCE" != true ]]; then
  EXISTING_BOOTSTRAP_FILES=()
  for path in \
    "$ENV_FILE" \
    "$HERMES_HOME/config.yaml" \
    "$DASHBOARD_CREDS_FILE" \
    "$API_CREDS_FILE" \
    /etc/systemd/system/hermes-gateway.service \
    /etc/systemd/system/hermes-dashboard.service
  do
    if [[ -e "$path" ]]; then
      EXISTING_BOOTSTRAP_FILES+=("$path")
    fi
  done
  if (( ${#EXISTING_BOOTSTRAP_FILES[@]} > 0 )); then
    printf '\nERROR: existing runtime bootstrap files found; rerun with --force to overwrite:\n' >&2
    printf '  %s\n' "${EXISTING_BOOTSTRAP_FILES[@]}" >&2
    exit 1
  fi
fi

write_file() {
  local path="$1"
  local mode="$2"
  local owner="$3"
  if [[ -e "$path" && "$FORCE" != true ]]; then
    die "$path exists; rerun with --force to overwrite"
  fi
  install -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" /dev/null "$path"
  cat >"$path"
}

log "repo state"
cd "$REPO_ROOT"
git status --short
[[ -z "$(git status --porcelain)" ]] || die "repo has uncommitted changes; commit first"
START_HEAD="$(git rev-parse HEAD)"
printf 'head=%s\n' "$START_HEAD"

log "runtime user"
if ! getent group "$RUNTIME_GROUP" >/dev/null; then
  groupadd --system "$RUNTIME_GROUP"
fi
if ! id "$RUNTIME_USER" >/dev/null 2>&1; then
  useradd --system --gid "$RUNTIME_GROUP" --home-dir "$RUNTIME_HOME" --create-home --shell /bin/bash "$RUNTIME_USER"
fi

log "directories"
install -d -m 0755 -o root -g root "$RUNTIME_ROOT" /etc/hermes
install -d -m 0755 -o "$RUNTIME_USER" -g "$RUNTIME_GROUP" "$RUNTIME_HOME" "$HERMES_HOME" "$LOG_DIR"

log "python venv"
if [[ ! -x "$RUNTIME_VENV/bin/python" ]]; then
  "$PYTHON_BIN" -m venv "$RUNTIME_VENV"
fi
chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$RUNTIME_ROOT"
umask 022
"$RUNTIME_VENV/bin/python" -m pip install --upgrade pip
"$RUNTIME_VENV/bin/python" -m pip install --upgrade --force-reinstall "$REPO_ROOT"
if [[ -n "$RUNTIME_EXTRA_PACKAGES" ]]; then
  "$RUNTIME_VENV/bin/python" -m pip install --upgrade $RUNTIME_EXTRA_PACKAGES
fi

log "permission guard"
chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$RUNTIME_ROOT" "$RUNTIME_HOME" "$LOG_DIR"
SITE_PACKAGES="$($RUNTIME_VENV/bin/python - <<'PY'
import site
print(site.getsitepackages()[0])
PY
)"
find "$SITE_PACKAGES" -type d -exec chmod a+rx {} +
find "$SITE_PACKAGES" -type f -exec chmod a+r {} +
find "$SITE_PACKAGES" -type f -name '*.so' -exec chmod a+rx {} +
find "$RUNTIME_VENV/bin" -type f -exec chmod a+rx {} +

log "command shim"
cat >/usr/local/bin/hermes <<EOF
#!/usr/bin/env bash
unset PYTHONPATH
unset PYTHONHOME
export HERMES_HOME="$HERMES_HOME"
exec "$RUNTIME_VENV/bin/hermes" "\$@"
EOF
chmod 0755 /usr/local/bin/hermes

log "secrets"
API_SERVER_KEY="${API_SERVER_KEY:-$($RUNTIME_VENV/bin/python - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)}"
DASHBOARD_SECRET="${DASHBOARD_SECRET:-$($RUNTIME_VENV/bin/python - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)}"
DASHBOARD_PASSWORD_HASH="$($RUNTIME_VENV/bin/python - <<PY
from plugins.dashboard_auth.basic import hash_password
print(hash_password("""$DASHBOARD_PASSWORD"""))
PY
)"

write_file "$ENV_FILE" 0600 root:root <<EOF
HERMES_HOME=$HERMES_HOME
HOME=$RUNTIME_HOME
USER=$RUNTIME_USER
LOGNAME=$RUNTIME_USER
PYTHONUNBUFFERED=1
PATH=$RUNTIME_VENV/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
VIRTUAL_ENV=$RUNTIME_VENV
API_SERVER_ENABLED=true
API_SERVER_HOST=$TAILNET_IP
API_SERVER_PORT=$GATEWAY_PORT
API_SERVER_KEY=$API_SERVER_KEY
HERMES_DASHBOARD=1
HERMES_DASHBOARD_HOST=$TAILNET_IP
HERMES_DASHBOARD_PORT=$DASHBOARD_PORT
HERMES_DASHBOARD_TUI=1
SUDO_PASSWORD=
EOF

write_file "$HERMES_HOME/config.yaml" 0600 "$RUNTIME_USER:$RUNTIME_GROUP" <<EOF
model:
  provider: openai
  base_url: $MODEL_BASE_URL
  api_mode: chat_completions
  default: $MODEL_DEFAULT
terminal:
  backend: local
web:
  backend: local
  use_gateway: true
browser:
  engine: camoufox
  cloud_provider: null
  use_gateway: true
dashboard:
  theme: system
  basic_auth:
    username: $DASHBOARD_USER
    password_hash: $DASHBOARD_PASSWORD_HASH
    secret: $DASHBOARD_SECRET
    session_ttl_seconds: 604800
memory:
  write_approval: false
curator:
  enabled: true
  consolidate: true
gateway:
  strict: false
platforms:
  api_server:
    enabled: true
    host: $TAILNET_IP
    port: $GATEWAY_PORT
    key: $API_SERVER_KEY
platform_toolsets:
  cli:
    - core
_config_version: 2
EOF

write_file "$DASHBOARD_CREDS_FILE" 0600 root:root <<EOF
Hermes dashboard
URL: http://$TAILNET_IP:$DASHBOARD_PORT/
Username: $DASHBOARD_USER
Password: $DASHBOARD_PASSWORD
EOF

write_file "$API_CREDS_FILE" 0600 root:root <<EOF
Hermes remote API
URL: http://$TAILNET_IP:$GATEWAY_PORT
API key: $API_SERVER_KEY
EOF

if [[ "$PASSWORDLESS_SUDO" == true ]]; then
  log "passwordless sudo"
  cat >/etc/sudoers.d/hermes-nopasswd <<EOF
$RUNTIME_USER ALL=(ALL:ALL) NOPASSWD:ALL
EOF
  chmod 0440 /etc/sudoers.d/hermes-nopasswd
  visudo -c -q -f /etc/sudoers.d/hermes-nopasswd
fi

log "systemd units"
write_file /etc/systemd/system/hermes-gateway.service 0644 root:root <<EOF
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

write_file /etc/systemd/system/hermes-dashboard.service 0644 root:root <<EOF
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

log "start services"
systemctl daemon-reload
systemctl enable --now hermes-gateway.service hermes-dashboard.service
sleep 8
systemctl is-active hermes-gateway.service hermes-dashboard.service

log "http smoke"
runuser -u "$RUNTIME_USER" -- "$RUNTIME_VENV/bin/python" - <<PY
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
for url in ("http://$TAILNET_IP:$DASHBOARD_PORT/", "http://$TAILNET_IP:$GATEWAY_PORT/health"):
    try:
        res = urlopen(Request(url), timeout=10)
        code = res.getcode()
    except HTTPError as exc:
        code = exc.code
    except URLError as exc:
        raise SystemExit(f"{url} -> ERROR {exc}")
    print(f"{url} -> {code}")
    if url.endswith('/health') and code != 200:
        raise SystemExit(f"gateway smoke failed: {code}")
    if str($DASHBOARD_PORT) in url and code not in (200, 302, 401):
        raise SystemExit(f"dashboard smoke failed: {code}")
PY

log "done"
printf 'bootstrapped_commit=%s\n' "$START_HEAD"
printf 'dashboard_credentials=%s\n' "$DASHBOARD_CREDS_FILE"
printf 'api_credentials=%s\n' "$API_CREDS_FILE"
