#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "deploy failed at line $LINENO" >&2' ERR

echo '=== stage: init ==='
APP_DIR=/root/overseas-opportunity-radar
UPLOAD_DIR=/tmp/overseas-opportunity-radar-deploy/.deploy-tmp
PROCESS_NAME=overseas-opportunity-radar
APP_PORT=3001
PRIMARY_DOMAIN=radar.yifan1.com
ADMIN_DOMAIN=admin-radar.yifan1.com
NGINX_CONF=/etc/nginx/conf.d/overseas-opportunity-radar.conf
CERTBOT_WEBROOT=/var/www/certbot
CERT_DIR=/etc/letsencrypt/live/$PRIMARY_DOMAIN
export NVM_DIR="$HOME/.nvm"

if [ ! -d "$UPLOAD_DIR" ]; then
  echo "Upload directory not found: $UPLOAD_DIR" >&2
  exit 1
fi

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y "$@"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y "$@"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y "$@"
  else
    echo "No supported package manager found" >&2
    exit 1
  fi
}

ensure_command() {
  command_name="$1"
  package_name="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    install_packages "$package_name"
  fi
}

ensure_node_runtime() {
  current_node_major=''
  if command -v node >/dev/null 2>&1; then
    current_node_major=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)
  fi
  if [ -n "$current_node_major" ] && [ "$current_node_major" -ge 20 ] && command -v npm >/dev/null 2>&1; then
    return
  fi

  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm alias default 20
    nvm use 20
  else
    NODE_VERSION=v20.18.0
    NODE_ROOT=/usr/local/lib/nodejs
    arch=$(uname -m)
    case "$arch" in
      x86_64|amd64)
        node_arch=x64
        ;;
      aarch64|arm64)
        node_arch=arm64
        ;;
      *)
        echo "Unsupported architecture for Node.js: $arch" >&2
        exit 1
        ;;
    esac
    temp_dir=$(mktemp -d)
    curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-${node_arch}.tar.gz" -o "$temp_dir/node.tar.gz"
    mkdir -p /usr/local/lib
    tar -xzf "$temp_dir/node.tar.gz" -C /usr/local/lib
    ln -sfn "/usr/local/lib/node-${NODE_VERSION}-linux-${node_arch}" "$NODE_ROOT"
    ln -sfn "$NODE_ROOT/bin/node" /usr/local/bin/node
    ln -sfn "$NODE_ROOT/bin/npm" /usr/local/bin/npm
    ln -sfn "$NODE_ROOT/bin/npx" /usr/local/bin/npx
    rm -rf "$temp_dir"
    hash -r
  fi

  current_node_major=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)
  if [ -z "$current_node_major" ] || [ "$current_node_major" -lt 20 ] || ! command -v npm >/dev/null 2>&1; then
    echo "node/npm installation did not succeed" >&2
    exit 1
  fi
}

restart_nginx() {
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable nginx || true
    systemctl restart nginx
  else
    nginx -s reload 2>/dev/null || nginx
  fi
}

mkdir -p "$APP_DIR"

echo '=== stage: ensure dependencies ==='
ensure_command rsync rsync
ensure_command curl curl
ensure_command nginx nginx
ensure_command certbot certbot
ensure_command python3 python3

echo '=== stage: ensure node runtime ==='
ensure_node_runtime

echo '=== stage: sync app files ==='
rsync -a --delete "$UPLOAD_DIR"/ "$APP_DIR"/

if [ ! -f "$APP_DIR/.env.production" ]; then
  echo ".env.production was not uploaded" >&2
  exit 1
fi

if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

echo '=== node runtime versions ==='
node -v
npm -v

echo '=== stage: build app ==='
cd "$APP_DIR"
npm ci
npm run build

echo '=== stage: ensure pm2 ==='
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

echo '=== stage: start app ==='
export NODE_ENV=production
pm2 restart "$PROCESS_NAME" --update-env || pm2 start npm --name "$PROCESS_NAME" -- run start -- --port "$APP_PORT"
pm2 save

echo '=== stage: bootstrap nginx http ==='
mkdir -p /etc/nginx/conf.d/disabled "$CERTBOT_WEBROOT"
for conf_file in /etc/nginx/conf.d/*.conf; do
  [ -f "$conf_file" ] || continue
  if [ "$conf_file" = "$NGINX_CONF" ]; then
    continue
  fi
  if grep -Eq 'radar\.yifan1\.com|admin-radar\.yifan1\.com' "$conf_file"; then
    mv "$conf_file" "/etc/nginx/conf.d/disabled/$(basename "$conf_file")"
  fi
done

cat > "$NGINX_CONF" <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name radar.yifan1.com admin-radar.yifan1.com;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }
}
EOF

echo '=== stage: reload nginx http ==='
nginx -t
restart_nginx

echo '=== stage: issue tls cert ==='
certbot certonly \
  --webroot \
  -w "$CERTBOT_WEBROOT" \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --keep-until-expiring \
  --expand \
  --cert-name "$PRIMARY_DOMAIN" \
  -d "$PRIMARY_DOMAIN" \
  -d "$ADMIN_DOMAIN"

cat > "$NGINX_CONF" <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name radar.yifan1.com admin-radar.yifan1.com;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name radar.yifan1.com;

    ssl_certificate /etc/letsencrypt/live/radar.yifan1.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/radar.yifan1.com/privkey.pem;

    location = / {
        return 302 https://radar.yifan1.com/site;
    }

    location ^~ /site {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }

    location = /api/lead-events {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }

    location ^~ /_next {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }

    location / {
        return 404;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin-radar.yifan1.com;

    ssl_certificate /etc/letsencrypt/live/radar.yifan1.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/radar.yifan1.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
EOF

echo '=== stage: switch nginx https ==='
nginx -t
restart_nginx

echo '=== stage: diagnostics ==='
echo '=== deploy host ==='
hostname
echo '=== host ips ==='
hostname -I || true
curl -fsS https://api.ipify.org || true
printf '\n'
echo '=== conf.d files ==='
ls -l /etc/nginx/conf.d || true
echo '=== radar config file ==='
sed -n '1,260p' /etc/nginx/conf.d/overseas-opportunity-radar.conf || true
echo '=== nginx main config ==='
sed -n '1,220p' /etc/nginx/nginx.conf || true
echo '=== cert files ==='
ls -l "$CERT_DIR" || true
echo '=== cert subject alt names ==='
openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -subject -issuer -dates -ext subjectAltName || true
echo '=== nginx -T radar/admin-radar excerpts ==='
nginx -T 2>&1 | grep -nE 'radar\.yifan1\.com|admin-radar\.yifan1\.com|server_name|listen 443|listen 80|ssl_certificate' || true

curl -fsS --retry 10 --retry-delay 3 --retry-connrefused "http://127.0.0.1:${APP_PORT}" >/dev/null

PUBLIC_RESPONSE=$(mktemp)
ADMIN_RESPONSE=$(mktemp)
trap 'rm -f "$PUBLIC_RESPONSE" "$ADMIN_RESPONSE"' EXIT

PUBLIC_CURL_EXIT=0
PUBLIC_STATUS=$(curl -ksS --resolve radar.yifan1.com:443:127.0.0.1 --retry 10 --retry-delay 3 --retry-connrefused -o "$PUBLIC_RESPONSE" -w '%{http_code}' https://radar.yifan1.com/site) || PUBLIC_CURL_EXIT=$?
if [ "$PUBLIC_CURL_EXIT" -ne 0 ] || [ "$PUBLIC_STATUS" != '200' ] || ! grep -q 'Public Site' "$PUBLIC_RESPONSE"; then
  echo "public site verification failed (curl_exit=$PUBLIC_CURL_EXIT status=${PUBLIC_STATUS:-n/a})"
  python -c "from pathlib import Path; import sys; print(Path(sys.argv[1]).read_text(encoding='utf-8', errors='ignore')[:500])" "$PUBLIC_RESPONSE"
  exit 1
fi

ADMIN_CURL_EXIT=0
ADMIN_STATUS=$(curl -ksS --resolve admin-radar.yifan1.com:443:127.0.0.1 --retry 10 --retry-delay 3 --retry-connrefused -o "$ADMIN_RESPONSE" -w '%{http_code}' https://admin-radar.yifan1.com/settings) || ADMIN_CURL_EXIT=$?
echo "verification summary: public(curl_exit=$PUBLIC_CURL_EXIT status=${PUBLIC_STATUS:-n/a}) admin(curl_exit=$ADMIN_CURL_EXIT status=${ADMIN_STATUS:-n/a})"
if [ "$ADMIN_CURL_EXIT" -ne 0 ] || [ "$ADMIN_STATUS" != '200' ] || ! grep -q 'Settings' "$ADMIN_RESPONSE"; then
  echo "admin site verification failed (curl_exit=$ADMIN_CURL_EXIT status=${ADMIN_STATUS:-n/a})"
  python -c "from pathlib import Path; import sys; print(Path(sys.argv[1]).read_text(encoding='utf-8', errors='ignore')[:500])" "$ADMIN_RESPONSE"
  exit 1
fi
