#!/bin/bash
# =============================================================
#  setup_domain.sh  –  Setup domain + SSL untuk Retort Monitor
#  Sekali jalan setelah deploy.sh sukses.
#
#  Prasyarat:
#    - deploy.sh sudah jalan (Laravel listen :8000 via nginx internal)
#    - DNS A record: logger.indahmesin.com → IP VPS
#
#  Jalankan sebagai root:
#    bash setup_domain.sh
# =============================================================

if [ -z "${BASH_VERSION:-}" ]; then
    exec /bin/bash "$0" "$@"
fi

# ── Warna & helper step (sama pola deploy.sh) ────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
failmsg() { echo -e "${RED}[FAIL]${NC} $1"; }

FAILED_STEPS=()
FAIL_HINTS=()

record_fail() {
    FAILED_STEPS+=("$1")
    FAIL_HINTS+=("${2:-}")
    failmsg "  $1 — lanjut step berikutnya."
}

step_run() {
    local name="$1"
    shift
    echo ""
    info "$name"
    local log
    log=$(mktemp)
    if "$@" > >(tee -a /proc/self/fd/2) 2>"$log"; then
        rm -f "$log"
        return 0
    fi
    local hint
    hint=$(tail -3 "$log" | tr '\n' ' ' | sed 's/  */ /g' | cut -c1-120)
    rm -f "$log"
    record_fail "$name" "$hint"
    return 1
}

set_env_var() {
    local key="$1"
    local val="$2"
    local env_file="$3"
    local escaped
    escaped=$(printf '%s\n' "$val" | sed 's/[\\&|]/\\&/g')
    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${escaped}|" "$env_file"
    elif grep -q "^# ${key}=" "$env_file" 2>/dev/null; then
        sed -i "s|^# ${key}=.*|${key}=${escaped}|" "$env_file"
    else
        echo "${key}=${val}" >> "$env_file"
    fi
}

print_report() {
    echo ""
    echo -e "${GREEN}============================================${NC}"
    if [ "${#FAILED_STEPS[@]}" -eq 0 ]; then
        echo -e "${GREEN}  Setup domain selesai — semua step OK${NC}"
    else
        echo -e "${YELLOW}  Setup domain selesai dengan ${#FAILED_STEPS[@]} step gagal${NC}"
        echo -e "${YELLOW}============================================${NC}"
        local i
        for i in "${!FAILED_STEPS[@]}"; do
            echo -e "  ${RED}✗${NC} ${FAILED_STEPS[$i]}"
            [ -n "${FAIL_HINTS[$i]}" ] && echo -e "      ${FAIL_HINTS[$i]}"
        done
    fi
    echo -e "${GREEN}============================================${NC}"
    echo -e "  Domain        : ${YELLOW}https://${DOMAIN}${NC}"
    echo -e "  Backend       : ${YELLOW}127.0.0.1:${APP_PORT}${NC} (dari deploy.sh)"
    echo -e "  Nginx config  : ${YELLOW}${NGINX_SITE}${NC}"
    echo -e "  MQTT broker   : ${YELLOW}${VPS_IP}:1883${NC} (tidak berubah)"
    echo ""
    if [ "${#FAILED_STEPS[@]}" -eq 0 ]; then
        echo -e "${YELLOW}Login dashboard:${NC} https://${DOMAIN}"
        echo -e "  Admin    : admin@retort.com / password"
        echo -e "  Operator : operator@retort.com / password"
    else
        warn "Perbaiki step gagal di atas, lalu jalankan ulang: bash setup_domain.sh"
    fi
    echo ""
    [ "${#FAILED_STEPS[@]}" -gt 0 ] && exit 1
}

# ── Konfigurasi — sesuaikan dengan deploy.sh ─────────────────
APP_DIR="/var/www/project-indah-mesin"
VPS_IP="49.13.233.119"
APP_PORT="8000"                          # harus sama dengan deploy.sh
PHP_VER="8.3"
PHP_BIN="/usr/bin/php${PHP_VER}"

DOMAIN="logger.indahmesin.com"
SITE_NAME="logger.indahmesin.com"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"
CERTBOT_EMAIL="admin@indahmesin.com"     # email Let's Encrypt — ganti jika perlu

# ── Root check ───────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    failmsg "Jalankan sebagai root: sudo bash setup_domain.sh"
    exit 1
fi

info "=== Setup domain Retort Monitor ==="
info "Domain      : ${DOMAIN}"
info "Backend     : 127.0.0.1:${APP_PORT}"
info "Cert email  : ${CERTBOT_EMAIL}"
echo ""

# ── Step functions ───────────────────────────────────────────

step_01_check_backend() {
    if ! ss -ltn 2>/dev/null | grep -q ":${APP_PORT} "; then
        echo "Tidak ada listener di port ${APP_PORT}."
        echo "Jalankan deploy.sh dulu atau pastikan nginx internal Retort aktif."
        return 1
    fi
    info "  Backend Laravel/nginx internal OK di :${APP_PORT}"
}

step_02_nginx_site() {
    cat > "$NGINX_AVAILABLE" << NGINXCONF
# Retort Monitor — reverse proxy ke Laravel (port internal ${APP_PORT})
# Dibuat oleh setup_domain.sh — certbot akan menambah blok SSL
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    access_log /var/log/nginx/${SITE_NAME}.access.log;
    error_log  /var/log/nginx/${SITE_NAME}.error.log;

    location /monitoring/stream {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        chunked_transfer_encoding off;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};

        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 300;
        proxy_connect_timeout 60;
    }
}
NGINXCONF

    ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
    nginx -t
    systemctl reload nginx
    info "  Site nginx aktif: ${DOMAIN} → 127.0.0.1:${APP_PORT}"
}

step_03_firewall() {
    if command -v ufw &>/dev/null; then
        ufw allow 80/tcp comment 'HTTP certbot + redirect' 2>/dev/null || true
        ufw allow 443/tcp comment 'HTTPS Retort Monitor' 2>/dev/null || true
        info "  UFW: port 80 & 443 dibuka"
    else
        info "  UFW tidak terpasang — skip."
    fi
}

step_04_certbot() {
    apt-get update -qq
    apt-get install -y -qq certbot python3-certbot-nginx

    # Non-interaktif; butuh DNS A record sudah mengarah ke VPS
    certbot --nginx \
        -d "$DOMAIN" \
        --non-interactive \
        --agree-tos \
        --no-eff-email \
        --email "$CERTBOT_EMAIL" \
        --redirect

    nginx -t
    systemctl reload nginx
    info "  SSL aktif untuk https://${DOMAIN}"
}

step_05_laravel_app_url() {
    local env_file="${APP_DIR}/.env"
    if [ ! -f "$env_file" ]; then
        echo "File .env tidak ditemukan di ${APP_DIR}"
        return 1
    fi

    set_env_var APP_URL "https://${DOMAIN}" "$env_file"
    "${PHP_BIN}" artisan config:clear
    "${PHP_BIN}" artisan config:cache
    info "  APP_URL di .env → https://${DOMAIN}"
}

# ── Main ─────────────────────────────────────────────────────
step_run "1/5 Cek backend :${APP_PORT}"     step_01_check_backend
step_run "2/5 Buat nginx reverse proxy"     step_02_nginx_site
step_run "3/5 Buka firewall 80/443"         step_03_firewall
step_run "4/5 Install certbot + SSL"        step_04_certbot
step_run "5/5 Update Laravel APP_URL"       step_05_laravel_app_url

print_report
