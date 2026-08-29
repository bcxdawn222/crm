#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/www/wwwroot
CURRENT="$ROOT/crm-system"
RELEASES="$ROOT/crm-releases"
ROLLBACKS="$ROOT/crm-rollbacks"
SHARED="$ROOT/crm-shared"
INCOMING="$RELEASES/incoming"
NGINX_CONFIG=/etc/nginx/conf.d/crm-system.conf
NGINX_MAP=/etc/nginx/conf.d/00-crm-connection-map.conf
SERVICE=/etc/systemd/system/crm-system.service
CANDIDATE_PORT=${CRM_CANDIDATE_PORT:-3002}
STATE="$RELEASES/deployment-state.env"
require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "缺少服务器命令: $1" >&2; exit 1; }
}
manifest_value() {
  python3 - "$1" "$2" <<'PY'
import json
import sys
from pathlib import Path
payload = json.loads((Path(sys.argv[1]) / "release-manifest.json").read_text(encoding="utf-8"))
value = payload.get(sys.argv[2])
if not isinstance(value, str) or not value:
    raise SystemExit(1)
print(value)
PY
}
wait_health() {
  local url=$1 expected_commit=$2 output=$3
  for _ in $(seq 1 40); do
    if curl -fsS --max-time 3 "$url/api/health" >"$output"; then
      if python3 - "$output" "$expected_commit" <<'PY'
import json
import sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
ok = payload.get("status") == "ok" and payload.get("profile") == "stable"
ok = ok and payload.get("database") == "reachable" and payload.get("commit") == sys.argv[2]
raise SystemExit(0 if ok else 1)
PY
      then return 0; fi
    fi
    sleep 1
  done
  echo "健康检查未在 40 秒内达到目标提交 $expected_commit" >&2
  return 1
}
asset_hash() {
  local base_url=$1 output=$2 html assets
  html=$(mktemp)
  assets=$(mktemp)
  curl -fsS "$base_url/login" >"$html"
  grep -oE '/_next/static/[^"'"'"' ]+' "$html" | sort -u >"$assets"
  test -s "$assets"
  while IFS= read -r asset; do curl -fsS "$base_url$asset" >/dev/null; done <"$assets"
  sha256sum "$assets" | awk '{print $1}' >"$output"
  rm -f "$html" "$assets"
}
write_systemd() {
  local commit=$1 version=$2
  cat >"$SERVICE" <<EOF
[Unit]
Description=CRM system application (systemd direct)
After=network.target mariadb.service
Requires=mariadb.service

[Service]
Type=simple
User=crmapp
Group=crmapp
WorkingDirectory=$CURRENT
Environment=HOME=/home/crmapp
Environment=NODE_ENV=production
Environment=CRM_PROFILE=stable
Environment=CRM_BUILD_VERSION=$version
Environment=CRM_BUILD_COMMIT=$commit
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
Restart=always
RestartSec=5
KillMode=control-group
NoNewPrivileges=true
PrivateTmp=true
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
}
patch_nginx() {
  install -d -o crmapp -g crmapp -m 750 "$SHARED/logs"
  cat >"$NGINX_MAP" <<'EOF'
map $http_upgrade $crm_connection_upgrade {
    default upgrade;
    '' close;
}
EOF
  python3 - "$NGINX_CONFIG" <<'PY'
import re
import sys
from pathlib import Path
path = Path(sys.argv[1])
source = path.read_text(encoding="utf-8")
source = source.replace('proxy_set_header Connection "upgrade";', 'proxy_set_header Connection $crm_connection_upgrade;')
source = re.sub(r'access_log\s+/www/wwwroot/crm-system/logs/(?:stable/)?nginx-access\.log;',
                'access_log /www/wwwroot/crm-shared/logs/nginx-access.log;', source)
source = re.sub(r'error_log\s+/www/wwwroot/crm-system/logs/(?:stable/)?nginx-error\.log;',
                'error_log /www/wwwroot/crm-shared/logs/nginx-error.log;', source)
if 'proxy_set_header X-CRM-Profile stable;' not in source:
    marker = '        proxy_set_header X-Forwarded-Proto $scheme;'
    if marker not in source:
        raise SystemExit('Nginx 配置缺少 X-Forwarded-Proto，拒绝猜测插入位置')
    source = source.replace(marker, marker + '\n        proxy_set_header X-CRM-Profile stable;', 1)
path.write_text(source, encoding="utf-8")
PY
  nginx -t
  systemctl reload nginx
  nginx -s reopen
}

audit() {
  local listener manager connection old_logs commit backup
  listener=false
  ss -ltn | grep -qE '127\.0\.0\.1:3000\b' && listener=true
  manager=systemd-pm2
  systemctl cat crm-system.service --no-pager 2>/dev/null | grep -q 'next/dist/bin/next' && manager=systemd-direct
  connection=false
  nginx -T 2>/dev/null | grep -q 'Connection \$crm_connection_upgrade' && connection=true
  old_logs=0
  for pid in $(pgrep nginx || true); do
    count=$(ls -l "/proc/$pid/fd" 2>/dev/null | grep -c 'crm-system.rollback' || true)
    old_logs=$((old_logs + count))
  done
  commit=$(curl -fsS http://127.0.0.1:3000/api/health | python3 -c 'import json,sys; print(json.load(sys.stdin).get("commit","unknown"))')
  backup=$(find /root/crm-backups -maxdepth 1 -type f -name '*.sql.gz' -printf '%TY-%Tm-%TdT%TH:%TM:%TS %s %p\n' 2>/dev/null | sort | tail -n1)
  echo "HEALTH_COMMIT=$commit"
  echo "LISTENER_LOOPBACK=$listener"
  echo "MANAGER=$manager"
  echo "NGINX_CONNECTION_MAP=$connection"
  echo "ROLLBACK_LOG_HANDLES=$old_logs"
  echo "LATEST_BACKUP=${backup:-missing}"
  echo "NGINX_CONFIG=$NGINX_CONFIG"
  echo "APP_ROOT=$CURRENT"
}

stage() {
  local archive=$1 release_id=$2 commit=$3 version=$4 release_dir checksum pid_file health_file
  [[ $release_id =~ ^[A-Za-z0-9._-]+$ ]] || { echo "非法 release_id" >&2; exit 1; }
  [[ $commit =~ ^[0-9a-f]{40}$ ]] || { echo "非法 commit" >&2; exit 1; }
  [[ $version =~ ^[A-Za-z0-9._-]+$ ]] || { echo "非法 version" >&2; exit 1; }
  checksum=${archive%.zip}.sha256
  release_dir="$RELEASES/$release_id"
  if [ -f "$release_dir/.deployment/staged" ]; then
    test "$(manifest_value "$release_dir" commit)" = "$commit"
    echo "候选包已完成相同提交的备用端口验收: $release_dir"
    return 0
  fi
  test ! -e "$release_dir" || { echo "候选目录已存在但没有验收标记: $release_dir" >&2; exit 1; }
  for tool in unzip sha256sum rsync curl npm node python3; do require_command "$tool"; done
  (cd "$INCOMING" && sha256sum -c "$(basename "$checksum")")
  install -d -m 755 "$release_dir"
  unzip -q "$archive" -d "$release_dir"
  test "$(manifest_value "$release_dir" release_id)" = "$release_id"
  test "$(manifest_value "$release_dir" commit)" = "$commit"
  test "$(manifest_value "$release_dir" profile)" = test
  for env_file in .env .env.production; do
    if [ -f "$CURRENT/$env_file" ]; then install -m 600 "$CURRENT/$env_file" "$release_dir/$env_file"; fi
  done
  install -d -o crmapp -g crmapp -m 750 "$SHARED/storage" "$SHARED/logs" "$release_dir/.deployment"
  [ ! -d "$CURRENT/storage" ] || rsync -a "$CURRENT/storage/" "$SHARED/storage/"
  [ ! -d "$CURRENT/logs" ] || rsync -a "$CURRENT/logs/" "$SHARED/logs/"
  rm -rf "$release_dir/storage" "$release_dir/logs"
  ln -s "$SHARED/storage" "$release_dir/storage"
  ln -s "$SHARED/logs" "$release_dir/logs"
  chown -R crmapp:crmapp "$release_dir"
  su -s /bin/bash crmapp -c "cd '$release_dir' && npm ci --no-audit --no-fund"
  su -s /bin/bash crmapp -c "cd '$release_dir' && npx prisma generate"
  su -s /bin/bash crmapp -c "cd '$release_dir' && npx prisma migrate status"
  pid_file="$release_dir/.deployment/candidate.pid"
  health_file="$release_dir/.deployment/candidate-health.json"
  su -s /bin/bash crmapp -c "cd '$release_dir' && nohup env CRM_PROFILE=stable CRM_BUILD_VERSION='$version' CRM_BUILD_COMMIT='$commit' PORT='$CANDIDATE_PORT' node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port '$CANDIDATE_PORT' >'$SHARED/logs/candidate-$release_id.log' 2>&1 & echo \$! >'$pid_file'"
  trap 'if test -f "$pid_file"; then candidate_pid=$(cat "$pid_file"); candidate_pgid=$(ps -o pgid= -p "$candidate_pid" | tr -d " "); test -z "$candidate_pgid" || kill -- "-$candidate_pgid" 2>/dev/null || true; fi' RETURN
  wait_health "http://127.0.0.1:$CANDIDATE_PORT" "$commit" "$health_file"
  asset_hash "http://127.0.0.1:$CANDIDATE_PORT" "$release_dir/.deployment/candidate-assets.sha256"
  candidate_pid=$(cat "$pid_file"); candidate_pgid=$(ps -o pgid= -p "$candidate_pid" | tr -d ' ')
  kill -- "-$candidate_pgid"
  for _ in $(seq 1 20); do ss -ltn | grep -q ":$CANDIDATE_PORT " || break; sleep 0.25; done
  ! ss -ltn | grep -q ":$CANDIDATE_PORT "
  rm -f "$pid_file"
  printf 'release_id=%s\ncommit=%s\nversion=%s\n' "$release_id" "$commit" "$version" >"$release_dir/.deployment/staged"
  echo "备用端口候选验收通过: $release_id commit=$commit port=$CANDIDATE_PORT"
}

rollback_after_failure() {
  local code=$? failed
  trap - EXIT
  [ "$code" -ne 0 ] || return 0
  echo "正式切换失败，开始恢复上一稳定目录" >&2
  systemctl stop crm-system.service 2>/dev/null || true
  if [ -n "${ROLLBACK_PATH:-}" ] && [ -d "$ROLLBACK_PATH" ]; then
    failed="$ROLLBACKS/failed-$(date -u +%Y%m%dT%H%M%SZ)"
    [ ! -e "$CURRENT" ] || mv "$CURRENT" "$failed"
    mv "$ROLLBACK_PATH" "$CURRENT"
  fi
  [ ! -f "${SERVICE_BACKUP:-}" ] || cp -a "$SERVICE_BACKUP" "$SERVICE"
  [ ! -f "${NGINX_BACKUP:-}" ] || cp -a "$NGINX_BACKUP" "$NGINX_CONFIG"
  if [ -n "${MAP_BACKUP:-}" ] && [ -f "$MAP_BACKUP" ]; then cp -a "$MAP_BACKUP" "$NGINX_MAP"; else rm -f "$NGINX_MAP"; fi
  systemctl daemon-reload
  systemctl start crm-system.service || true
  nginx -t && systemctl reload nginx && nginx -s reopen || true
  exit "$code"
}

deploy() {
  local release_id=$1 release_dir commit version stamp before_backup after_backup stable_health stable_assets
  release_dir="$RELEASES/$release_id"
  test -f "$release_dir/.deployment/staged"
  commit=$(manifest_value "$release_dir" commit)
  version=$(manifest_value "$release_dir" version)
  before_backup=$(find /root/crm-backups -maxdepth 1 -type f -name '*.sql.gz' -printf '%p\n' 2>/dev/null | sort | tail -n1)
  systemctl start crm-db-backup.service
  after_backup=$(find /root/crm-backups -maxdepth 1 -type f -name '*.sql.gz' -printf '%p\n' | sort | tail -n1)
  test -n "$after_backup" && test "$after_backup" != "${before_backup:-}"
  gzip -t "$after_backup"
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  ROLLBACK_PATH="$ROLLBACKS/$(manifest_value "$CURRENT" release_id)-$stamp"
  SERVICE_BACKUP="$ROLLBACKS/crm-system.service-$stamp"
  NGINX_BACKUP="$ROLLBACKS/crm-system.conf-$stamp"
  MAP_BACKUP="$ROLLBACKS/crm-connection-map-$stamp"
  install -d -m 755 "$ROLLBACKS"
  cp -a "$SERVICE" "$SERVICE_BACKUP"
  cp -a "$NGINX_CONFIG" "$NGINX_BACKUP"
  [ ! -f "$NGINX_MAP" ] || cp -a "$NGINX_MAP" "$MAP_BACKUP"
  trap rollback_after_failure EXIT
  systemctl stop crm-system.service
  for _ in $(seq 1 20); do ss -ltn | grep -q ':3000 ' || break; sleep 0.25; done
  ! ss -ltn | grep -q ':3000 '
  rsync -a "$CURRENT/storage/" "$SHARED/storage/"
  rsync -a "$CURRENT/logs/" "$SHARED/logs/"
  if [ -d "$CURRENT/storage" ] && [ ! -L "$CURRENT/storage" ]; then
    mv "$CURRENT/storage" "$CURRENT/storage.before-shared-$stamp"
    ln -s "$SHARED/storage" "$CURRENT/storage"
  fi
  if [ -d "$CURRENT/logs" ] && [ ! -L "$CURRENT/logs" ]; then
    mv "$CURRENT/logs" "$CURRENT/logs.before-shared-$stamp"
    ln -s "$SHARED/logs" "$CURRENT/logs"
  fi
  mv "$CURRENT" "$ROLLBACK_PATH"
  mv "$release_dir" "$CURRENT"
  write_systemd "$commit" "$version"
  systemctl enable crm-system.service >/dev/null
  systemctl start crm-system.service
  stable_health="$CURRENT/.deployment/stable-health.json"
  wait_health http://127.0.0.1:3000 "$commit" "$stable_health"
  patch_nginx
  wait_health https://xuzhiyin.cn "$commit" "$CURRENT/.deployment/public-health.json"
  stable_assets="$CURRENT/.deployment/stable-assets.sha256"
  asset_hash https://xuzhiyin.cn "$stable_assets"
  cmp "$CURRENT/.deployment/candidate-assets.sha256" "$stable_assets"
  ss -ltn | grep -qE '127\.0\.0\.1:3000\b'
  ! ss -ltn | grep -qE '\*:3000\b|0\.0\.0\.0:3000\b'
  sleep 2
  for pid in $(pgrep nginx || true); do ! ls -l "/proc/$pid/fd" 2>/dev/null | grep -q 'crm-system.rollback'; done
  printf 'current_release_id=%s\ncurrent_commit=%s\nprevious_path=%s\nbackup=%s\n' "$release_id" "$commit" "$ROLLBACK_PATH" "$after_backup" >"$STATE"
  chmod 600 "$STATE"
  trap - EXIT
  echo "正式发布通过: $release_id commit=$commit backup=$after_backup"
}

rollback() {
  local previous current_commit previous_commit previous_version failed
  test -f "$STATE"
  # shellcheck disable=SC1090
  source "$STATE"
  previous=$previous_path
  test -d "$previous"
  current_commit=$(manifest_value "$CURRENT" commit)
  previous_commit=$(manifest_value "$previous" commit)
  previous_version=$(manifest_value "$previous" version)
  systemctl stop crm-system.service
  failed="$ROLLBACKS/rolled-back-$current_commit-$(date -u +%Y%m%dT%H%M%SZ)"
  mv "$CURRENT" "$failed"
  mv "$previous" "$CURRENT"
  write_systemd "$previous_commit" "$previous_version"
  systemctl start crm-system.service
  wait_health http://127.0.0.1:3000 "$previous_commit" "$CURRENT/rollback-health.json"
  nginx -t
  systemctl reload nginx
  nginx -s reopen
  echo "已回滚到 commit=$previous_commit，发布失败目录=$failed"
}

case "${1:-}" in
  audit) audit ;;
  stage) shift; stage "$@" ;;
  deploy) shift; deploy "$@" ;;
  rollback) rollback ;;
  *) echo "用法: $0 audit|stage <zip> <release_id> <commit> <version>|deploy <release_id>|rollback" >&2; exit 2 ;;
esac
