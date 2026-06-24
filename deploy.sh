#!/bin/bash
# =============================================================
#  deploy.sh  –  Setup awal VPS untuk project-indah-mesin
#  Diuji di: Ubuntu 22.04 / 24.04 LTS
#  Jalankan sebagai root atau sudo user:
#    bash deploy.sh
# =============================================================

set -e  # berhenti jika ada error

# ── Warna output ─────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Konfigurasi — SESUAIKAN SEBELUM DIJALANKAN ───────────────
APP_DIR="/var/www/project-indah-mesin"
REPO_URL="https://github.com/Kacong05/project-indah-mesin.git"
REPO_BRANCH="adim"
DB_NAME="project_indah_mesin"
DB_USER="postgres"
DB_PASS="indah-Mesin.123"   # <── GANTI ini
PHP_VER="8.3"

# Tanpa domain: web lama tetap port 80, Retort Monitor pakai port lain.
# Jangan pakai port 80 agar tidak bentrok dengan web yang sudah jalan.
VPS_IP="82.153.226.85"        # IP publik VPS Anda
APP_PORT="8080"               # port khusus Retort Monitor
APP_URL="http://${VPS_IP}:${APP_PORT}"

# ── Keamanan MQTT & API ───────────────────────────────────────
MQTT_ESP_USER="retort_esp"
MQTT_BRIDGE_USER="retort_bridge"
MQTT_WEB_USER="retort_web"
CREDS_FILE="/var/www/project-indah-mesin/.credentials.deploy"

# Pakai ulang kredensial jika sudah pernah deploy (hindari putus ESP32)
if [ -f "$CREDS_FILE" ]; then
    # shellcheck disable=SC1090
    source "$CREDS_FILE"
    info "Kredensial existing dipakai ulang dari $CREDS_FILE"
    if [ -z "${MQTT_WEB_PASS:-}" ]; then
        MQTT_WEB_PASS="RetortWeb_$(openssl rand -hex 8)"
        warn "MQTT_WEB_PASS baru dibuat (upgrade dari deploy lama)"
    fi
else
    MQTT_ESP_PASS="RetortEsp_$(openssl rand -hex 8)"
    MQTT_BRIDGE_PASS="RetortBr_$(openssl rand -hex 8)"
    MQTT_WEB_PASS="RetortWeb_$(openssl rand -hex 8)"
    SENSOR_API_TOKEN="$(openssl rand -hex 32)"
fi

info "=== Deploy project-indah-mesin ==="
info "Server IP   : $VPS_IP"
info "App dir     : $APP_DIR"
info "Branch      : $REPO_BRANCH"
info "Retort URL  : http://${VPS_IP}:${APP_PORT}  (web lama tetap :80)"
echo ""

# ─────────────────────────────────────────────────────────────
# 1. Update sistem
# ─────────────────────────────────────────────────────────────
info "1/9 Update sistem..."
apt-get update -qq
apt-get upgrade -y -qq

# ─────────────────────────────────────────────────────────────
# 2. Install PHP 8.3 + ekstensi Laravel
# ─────────────────────────────────────────────────────────────
info "2/9 Install PHP $PHP_VER..."
apt-get install -y -qq software-properties-common
add-apt-repository -y ppa:ondrej/php
apt-get update -qq
apt-get install -y -qq \
    php${PHP_VER} php${PHP_VER}-fpm php${PHP_VER}-cli \
    php${PHP_VER}-pgsql php${PHP_VER}-mbstring php${PHP_VER}-xml \
    php${PHP_VER}-bcmath php${PHP_VER}-curl php${PHP_VER}-zip \
    php${PHP_VER}-intl php${PHP_VER}-tokenizer php${PHP_VER}-fileinfo

# ─────────────────────────────────────────────────────────────
# 3. Install Composer
# ─────────────────────────────────────────────────────────────
info "3/9 Install Composer..."
if ! command -v composer &>/dev/null; then
    curl -sS https://getcomposer.org/installer | php
    mv composer.phar /usr/local/bin/composer
    chmod +x /usr/local/bin/composer
else
    info "  Composer sudah ada, skip."
fi

# ─────────────────────────────────────────────────────────────
# 4. Install Node.js 22 LTS (Vite 8 butuh Node ^20.19 atau >=22.12)
# ─────────────────────────────────────────────────────────────
info "4/9 Install Node.js 22..."
NEED_NODE_INSTALL=1
if command -v node &>/dev/null; then
    NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
    NODE_MINOR=$(node -v | sed 's/v//' | cut -d. -f2)
    if [ "$NODE_MAJOR" -ge 22 ] 2>/dev/null || { [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -ge 19 ] 2>/dev/null; }; then
        NEED_NODE_INSTALL=0
        info "  Node.js sudah cukup baru: $(node -v)"
    else
        warn "  Node.js $(node -v) terlalu lama untuk Vite 8 — upgrade ke 22..."
    fi
fi
if [ "$NEED_NODE_INSTALL" -eq 1 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
    info "  Node.js terpasang: $(node -v)"
fi

# ─────────────────────────────────────────────────────────────
# 5. Install PostgreSQL 16
# ─────────────────────────────────────────────────────────────
info "5/9 Install PostgreSQL..."
apt-get install -y -qq postgresql postgresql-contrib

systemctl enable postgresql
systemctl start postgresql

# Buat user dan database
info "  Membuat database '$DB_NAME' dengan user '$DB_USER'..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || \
    warn "  Database '$DB_NAME' mungkin sudah ada."

info "  PostgreSQL siap."

# ─────────────────────────────────────────────────────────────
# 6. Install Mosquitto MQTT Broker (dengan user/password + ACL)
# ─────────────────────────────────────────────────────────────
info "6/9 Install Mosquitto MQTT Broker (authenticated)..."
apt-get install -y -qq mosquitto mosquitto-clients

# Nonaktifkan config default Ubuntu yang sering bentrok (listener 1883 ganda)
for f in /etc/mosquitto/conf.d/*.conf; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    [ "$base" = "retort.conf" ] && continue
    mv "$f" "${f}.disabled"
    warn "  Config Mosquitto dinonaktifkan: $base → ${base}.disabled"
done

# Password file: owner root, group mosquitto, mode 640 (bisa dibaca proses mosquitto)
install -o root -g mosquitto -m 640 /dev/null /etc/mosquitto/passwd
mosquitto_passwd -b /etc/mosquitto/passwd "$MQTT_ESP_USER" "$MQTT_ESP_PASS"
mosquitto_passwd -b /etc/mosquitto/passwd "$MQTT_BRIDGE_USER" "$MQTT_BRIDGE_PASS"
mosquitto_passwd -b /etc/mosquitto/passwd "$MQTT_WEB_USER" "$MQTT_WEB_PASS"
chown root:mosquitto /etc/mosquitto/passwd
chmod 640 /etc/mosquitto/passwd

# ACL: ESP publish data + baca cmd; bridge baca data; web publish cmd
cat > /etc/mosquitto/acl << ACLCONF
# ESP32 logger
user ${MQTT_ESP_USER}
topic write retort/data
topic read retort/cmd

# mqtt_bridge (server)
user ${MQTT_BRIDGE_USER}
topic read retort/#

# Laravel web dashboard (kirim START/STOP)
user ${MQTT_WEB_USER}
topic write retort/cmd
ACLCONF
chown root:mosquitto /etc/mosquitto/acl
chmod 640 /etc/mosquitto/acl

cat > /etc/mosquitto/conf.d/retort.conf << MQTTCONF
# Mosquitto – RetortLogger (satu-satunya listener 1883)
listener 1883 0.0.0.0
allow_anonymous false
password_file /etc/mosquitto/passwd
acl_file /etc/mosquitto/acl
MQTTCONF

systemctl enable mosquitto
if ! systemctl restart mosquitto; then
    echo ""
    error "Mosquitto gagal start. Jalankan: journalctl -xeu mosquitto.service -n 40"
fi
if ! systemctl is-active --quiet mosquitto; then
    error "Mosquitto tidak active setelah restart."
fi
info "  Mosquitto berjalan di port 1883 (auth required)."

# ─────────────────────────────────────────────────────────────
# 7. Clone repository
# ─────────────────────────────────────────────────────────────
info "7/9 Clone repository..."
apt-get install -y -qq git nginx

if [ -d "$APP_DIR/.git" ]; then
    warn "  Repo sudah ada, pull terbaru..."
    git -C "$APP_DIR" pull origin "$REPO_BRANCH"
else
    git clone -b "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
fi

# ─────────────────────────────────────────────────────────────
# 8. Setup Laravel
# ─────────────────────────────────────────────────────────────
info "8/9 Setup Laravel..."
cd "$APP_DIR"

# Helper: set/update satu baris di .env (handle baris yang dikomentari)
set_env_var() {
    local key="$1"
    local val="$2"
    local escaped
    escaped=$(printf '%s\n' "$val" | sed 's/[\\&|]/\\&/g')
    if grep -q "^${key}=" .env 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${escaped}|" .env
    elif grep -q "^# ${key}=" .env 2>/dev/null; then
        sed -i "s|^# ${key}=.*|${key}=${escaped}|" .env
    else
        echo "${key}=${val}" >> .env
    fi
}

# Copy .env dan isi nilai penting
cp .env.example .env
set_env_var APP_ENV production
set_env_var APP_DEBUG false
set_env_var APP_URL "$APP_URL"
set_env_var DB_CONNECTION pgsql
set_env_var DB_HOST 127.0.0.1
set_env_var DB_PORT 5432
set_env_var DB_DATABASE "$DB_NAME"
set_env_var DB_USERNAME "$DB_USER"
set_env_var DB_PASSWORD "$DB_PASS"
set_env_var SESSION_DRIVER database
set_env_var QUEUE_CONNECTION database
set_env_var CACHE_STORE database

# Token API sensor
set_env_var SENSOR_API_TOKEN "$SENSOR_API_TOKEN"

# MQTT web command (START/STOP dari dashboard)
set_env_var MQTT_HOST 127.0.0.1
set_env_var MQTT_PORT 1883
set_env_var MQTT_USER "$MQTT_WEB_USER"
set_env_var MQTT_PASSWORD "$MQTT_WEB_PASS"
set_env_var MQTT_CMD_TOPIC retort/cmd

# Simpan kredensial untuk referensi (chmod 600)
cat > "$APP_DIR/.credentials.deploy" << CREDS
# Generated $(date -Iseconds) — JANGAN commit ke git
MQTT_ESP_USER=$MQTT_ESP_USER
MQTT_ESP_PASS=$MQTT_ESP_PASS
MQTT_BRIDGE_USER=$MQTT_BRIDGE_USER
MQTT_BRIDGE_PASS=$MQTT_BRIDGE_PASS
MQTT_WEB_USER=$MQTT_WEB_USER
MQTT_WEB_PASS=$MQTT_WEB_PASS
SENSOR_API_TOKEN=$SENSOR_API_TOKEN
CREDS
chmod 600 "$APP_DIR/.credentials.deploy"
chown www-data:www-data "$APP_DIR/.credentials.deploy"

# Install dependensi
composer install --no-dev --optimize-autoloader --no-interaction

# Bersihkan node_modules lama (sering menyimpan vite@3 dari install gagal sebelumnya)
info "  npm install (frontend build)..."
rm -rf node_modules
if [ -f package-lock.json ]; then
    npm ci --ignore-scripts --legacy-peer-deps
else
    npm install --ignore-scripts --legacy-peer-deps
fi
npm run build

# Generate key
php artisan config:clear
php artisan key:generate --force

# Jalankan migrasi + seed (mesin RT-001, user admin/operator)
php artisan migrate --force
php artisan db:seed --force

# Optimasi
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Permission storage
chown -R www-data:www-data "$APP_DIR"
chmod -R 775 "$APP_DIR/storage" "$APP_DIR/bootstrap/cache"

# ─────────────────────────────────────────────────────────────
# 9. Konfigurasi Nginx — port 8080 (web lama tetap di port 80)
# ─────────────────────────────────────────────────────────────
info "9/10 Konfigurasi Nginx port ${APP_PORT} (web lama port 80 tidak disentuh)..."
cat > /etc/nginx/sites-available/project-indah-mesin << NGINXCONF
# Retort Monitor — listen port terpisah, aman berdampingan web IP-only
server {
    listen ${APP_PORT};
    server_name ${VPS_IP} _;

    root ${APP_DIR}/public;
    index index.php;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    charset utf-8;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php${PHP_VER}-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 300;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
NGINXCONF

# Aktifkan HANYA site ini — jangan hapus site web lama yang sudah enabled
ln -sf /etc/nginx/sites-available/project-indah-mesin /etc/nginx/sites-enabled/
# TIDAK: rm -f /etc/nginx/sites-enabled/default  ← web lama tetap aktif
nginx -t
systemctl reload nginx   # reload, bukan restart — lebih aman untuk site lain

# ─────────────────────────────────────────────────────────────
# 10. MQTT bridge + queue worker (systemd)
# ─────────────────────────────────────────────────────────────
info "10/10 MQTT bridge + queue worker..."
# Ubuntu 24+ memblokir pip global (PEP 668) — pakai virtualenv di project
apt-get install -y -qq python3-venv python3-pip
if [ ! -d "${APP_DIR}/.venv" ]; then
    python3 -m venv "${APP_DIR}/.venv"
fi
"${APP_DIR}/.venv/bin/pip" install -q --upgrade pip
"${APP_DIR}/.venv/bin/pip" install -q paho-mqtt requests
chown -R www-data:www-data "${APP_DIR}/.venv"

PYTHON_VENV="${APP_DIR}/.venv/bin/python3"

cat > /etc/systemd/system/mqtt-bridge.service << BRIDGECONF
[Unit]
Description=MQTT Bridge ESP32 to Laravel (project-indah-mesin)
After=network.target mosquitto.service nginx.service postgresql.service

[Service]
User=www-data
WorkingDirectory=${APP_DIR}
Environment=API_URL=http://127.0.0.1:${APP_PORT}/api/sensor
Environment=MQTT_TOPIC=retort/data
Environment=MQTT_USER=${MQTT_BRIDGE_USER}
Environment=MQTT_PASS=${MQTT_BRIDGE_PASS}
Environment=SENSOR_API_TOKEN=${SENSOR_API_TOKEN}
ExecStart=${PYTHON_VENV} ${APP_DIR}/mqtt_bridge.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
BRIDGECONF

systemctl daemon-reload
systemctl enable mqtt-bridge
systemctl restart mqtt-bridge
cat > /etc/systemd/system/laravel-queue.service << QUEUECONF
[Unit]
Description=Laravel Queue Worker – project-indah-mesin
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
Restart=always
RestartSec=5s
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/php$PHP_VER artisan queue:listen --tries=1 --timeout=0
StandardOutput=append:$APP_DIR/storage/logs/queue.log
StandardError=append:$APP_DIR/storage/logs/queue.log

[Install]
WantedBy=multi-user.target
QUEUECONF

systemctl daemon-reload
systemctl enable laravel-queue
systemctl start laravel-queue

# Buka port Retort + MQTT (port 80 web lama biasanya sudah terbuka)
if command -v ufw &>/dev/null; then
    ufw allow ${APP_PORT}/tcp comment 'Retort Monitor' 2>/dev/null || true
    ufw allow 1883/tcp comment 'MQTT ESP32' 2>/dev/null || true
fi

# ─────────────────────────────────────────────────────────────
# Selesai
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Deploy selesai!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "  Web lama      : ${YELLOW}http://${VPS_IP}${NC}  (port 80, tidak diubah)"
echo -e "  Retort Monitor: ${YELLOW}http://${VPS_IP}:${APP_PORT}${NC}"
echo -e "  MQTT Broker   : ${YELLOW}${VPS_IP}:1883${NC}"
echo -e "  Database      : ${YELLOW}$DB_NAME${NC}"
echo -e "  Kode mesin    : ${YELLOW}RT-001${NC}"
echo ""
echo -e "${YELLOW}═══ KREDENSIAL (simpan, untuk ESP32 & testing) ═══${NC}"
echo -e "  MQTT ESP32 user : ${YELLOW}${MQTT_ESP_USER}${NC}"
echo -e "  MQTT ESP32 pass : ${YELLOW}${MQTT_ESP_PASS}${NC}"
echo -e "  API token       : ${YELLOW}${SENSOR_API_TOKEN}${NC}"
echo -e "  (juga di file   : ${APP_DIR}/.credentials.deploy)"
echo ""
echo -e "${YELLOW}ESP32 config.ino sebelum flash:${NC}"
echo -e "  #define MQTT_USER \"${MQTT_ESP_USER}\""
echo -e "  #define MQTT_PASS \"${MQTT_ESP_PASS}\""
echo ""
echo -e "${YELLOW}Login dashboard:${NC}"
echo -e "  Admin    : admin@retort.com / password"
echo -e "  Operator : operator@retort.com / password"
echo ""
echo -e "${YELLOW}ESP32 Settings:${NC}"
echo -e "  Nomor Mesin  : RT-001"
echo -e "  MQTT Broker  : ${VPS_IP}"
echo -e "  MQTT Port    : 1883"
echo ""
