#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ayhanmalkoc/hermes-agent.git}"
BRANCH="${BRANCH:-studio}"
COMMIT="${COMMIT:-}"
RUNTIME_DIR="${RUNTIME_DIR:-/usr/local/lib/hermes-agent}"
RUNTIME_VENV="${RUNTIME_VENV:-$RUNTIME_DIR/venv}"
RUNTIME_USER="${RUNTIME_USER:-hermes}"
RUNTIME_GROUP="${RUNTIME_GROUP:-hermes}"
RUNTIME_HOME="${RUNTIME_HOME:-/var/lib/hermes}"
HERMES_HOME="${HERMES_HOME:-$RUNTIME_HOME/.hermes}"
LOG_DIR="${LOG_DIR:-/var/log/hermes}"
TAILNET_IP="${TAILNET_IP:-100.107.234.45}"
MODEL_BASE_URL="${MODEL_BASE_URL:-http://100.107.234.45:20128/v1}"
MODEL_DEFAULT="${MODEL_DEFAULT:-openai-all}"
GATEWAY_PORT="${GATEWAY_PORT:-8642}"
DASHBOARD_PORT="${DASHBOARD_PORT:-9119}"
DASHBOARD_USER="${DASHBOARD_USER:-admin}"
DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD:-ayhan}"
DASHBOARD_CREDS_FILE="${DASHBOARD_CREDS_FILE:-/root/hermes-dashboard-credentials.txt}"
API_CREDS_FILE="${API_CREDS_FILE:-/root/hermes-api-credentials.txt}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
UV_BIN="${UV_BIN:-$(command -v uv || true)}"
PASSWORDLESS_SUDO=false
FORCE=false

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'USAGE'
Usage: sudo scripts/bootstrap-hermes-runtime.sh [options]

Prepare a clean host using Hermes' official Linux root layout:
  /usr/local/lib/hermes-agent
  /usr/local/lib/hermes-agent/venv
  /usr/local/bin/hermes

Options:
  --passwordless-sudo  Add hermes ALL=(ALL:ALL) NOPASSWD:ALL.
  --force              Overwrite existing runtime/service/config paths.
  --help               Show this help.

Environment overrides:
  REPO_URL=https://github.com/ayhanmalkoc/hermes-agent.git
  BRANCH=studio
  COMMIT=<optional sha>
  RUNTIME_DIR=/usr/local/lib/hermes-agent
  RUNTIME_HOME=/var/lib/hermes
  HERMES_HOME=/var/lib/hermes/.hermes
  TAILNET_IP=100.107.234.45
  MODEL_BASE_URL=http://100.107.234.45:20128/v1
  MODEL_DEFAULT=openai-all
  DASHBOARD_USER=admin
  DASHBOARD_PASSWORD=ayhan
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --passwordless-sudo) PASSWORDLESS_SUDO=true; shift ;;
    --force) FORCE=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "run as root"
command -v git >/dev/null 2>&1 || die "git not found"
command -v "$PYTHON_BIN" >/dev/null 2>&1 || die "python not found: $PYTHON_BIN"

if [[ "$FORCE" != true ]]; then
  existing=()
  for path in "$RUNTIME_DIR" "$HERMES_HOME" /usr/local/bin/hermes /etc/systemd/system/hermes-gateway.service /etc/systemd/system/hermes-dashboard.service; do
    [[ -e "$path" ]] && existing+=("$path")
  done
  if (( ${#existing[@]} > 0 )); then
    printf '\nERROR: existing Hermes runtime paths found; rerun with --force to overwrite:\n' >&2
    printf '  %s\n' "${existing[@]}" >&2
    exit 1
  fi
fi

log "runtime user"
if ! getent group "$RUNTIME_GROUP" >/dev/null; then groupadd --system "$RUNTIME_GROUP"; fi
if ! id "$RUNTIME_USER" >/dev/null 2>&1; then
  useradd --system --gid "$RUNTIME_GROUP" --home-dir "$RUNTIME_HOME" --create-home --shell /usr/bin/bash "$RUNTIME_USER"
fi

log "directories"
install -d -m 0755 -o root -g root /usr/local/lib
install -d -m 0755 -o "$RUNTIME_USER" -g "$RUNTIME_GROUP" "$RUNTIME_HOME" "$HERMES_HOME" "$LOG_DIR"

log "clone runtime"
rm -rf "$RUNTIME_DIR"
git clone --branch "$BRANCH" "$REPO_URL" "$RUNTIME_DIR"
cd "$RUNTIME_DIR"
if [[ -n "$COMMIT" ]]; then git checkout --detach "$COMMIT"; fi
START_HEAD="$(git rev-parse HEAD)"

log "python venv"
"$PYTHON_BIN" -m venv "$RUNTIME_VENV"
"$RUNTIME_VENV/bin/python" -m pip install --upgrade pip setuptools wheel
if [[ -n "$UV_BIN" ]]; then
  "$UV_BIN" pip install --python "$RUNTIME_VENV/bin/python" -e '.[all]'
else
  "$RUNTIME_VENV/bin/python" -m pip install -e '.[all]'
fi

log "dashboard web build"
npm install --workspace web
npm run build -w web

log "config"
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

cat >"$HERMES_HOME/.env" <<EOF_ENV
OPENAI_API_KEY=sk-hermes-local
API_SERVER_ENABLED=true
API_SERVER_HOST=$TAILNET_IP
API_SERVER_PORT=$GATEWAY_PORT
API_SERVER_KEY=$API_SERVER_KEY
HERMES_DASHBOARD=1
HERMES_DASHBOARD_HOST=$TAILNET_IP
HERMES_DASHBOARD_PORT=$DASHBOARD_PORT
HERMES_DASHBOARD_TUI=1
SUDO_PASSWORD=
EOF_ENV
chmod 0600 "$HERMES_HOME/.env"

cat >"$HERMES_HOME/config.yaml" <<EOF_CFG
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
platform_toolsets:
  cli:
    - core
_config_version: 33
EOF_CFG
chmod 0600 "$HERMES_HOME/config.yaml"

cat >"$DASHBOARD_CREDS_FILE" <<EOF_CREDS
Hermes dashboard
URL: http://$TAILNET_IP:$DASHBOARD_PORT/
Username: $DASHBOARD_USER
Password: $DASHBOARD_PASSWORD
EOF_CREDS
chmod 0600 "$DASHBOARD_CREDS_FILE"
cat >"$API_CREDS_FILE" <<EOF_API
Hermes API server credential
URL: http://$TAILNET_IP:$GATEWAY_PORT
API_SERVER_KEY: $API_SERVER_KEY
EOF_API
chmod 0600 "$API_CREDS_FILE"

log "permissions"
chown -R root:root "$RUNTIME_DIR"
find "$RUNTIME_DIR" -type d -exec chmod a+rx {} +
find "$RUNTIME_DIR" -type f -exec chmod a+r {} +
find "$RUNTIME_VENV/bin" -type f -exec chmod a+rx {} +
find "$RUNTIME_DIR" -type f -name '*.so' -exec chmod a+rx {} +
chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$RUNTIME_HOME" "$LOG_DIR"

cat >/usr/local/bin/hermes <<EOF_SHIM
#!/usr/bin/env bash
unset PYTHONPATH
unset PYTHONHOME
export HERMES_HOME="$HERMES_HOME"
export HOME="$RUNTIME_HOME"
exec "$RUNTIME_VENV/bin/hermes" "\$@"
EOF_SHIM
chmod 0755 /usr/local/bin/hermes

cat >"$RUNTIME_HOME/.profile" <<EOF_PROFILE
export HOME=$RUNTIME_HOME
export HERMES_HOME=$HERMES_HOME
export PATH=$RUNTIME_VENV/bin:/usr/local/bin:\$PATH
EOF_PROFILE
chown "$RUNTIME_USER:$RUNTIME_GROUP" "$RUNTIME_HOME/.profile"
chmod 0644 "$RUNTIME_HOME/.profile"

if [[ "$PASSWORDLESS_SUDO" == true ]]; then
  log "passwordless sudo"
  cat >/etc/sudoers.d/hermes-nopasswd <<EOF_SUDO
$RUNTIME_USER ALL=(ALL:ALL) NOPASSWD:ALL
EOF_SUDO
  chmod 0440 /etc/sudoers.d/hermes-nopasswd
  visudo -c -q -f /etc/sudoers.d/hermes-nopasswd
fi

log "systemd units"
# Reuse deploy for unit creation, install, restart, and smoke after bootstrap.
REPO_ROOT="$RUNTIME_DIR" DEPLOY_BRANCH="$BRANCH" /root/hermes-agent/scripts/deploy-hermes-runtime.sh

log "done"
printf 'bootstrapped_commit=%s\n' "$START_HEAD"
printf 'dashboard_credentials=%s\n' "$DASHBOARD_CREDS_FILE"
printf 'api_credentials=%s\n' "$API_CREDS_FILE"
