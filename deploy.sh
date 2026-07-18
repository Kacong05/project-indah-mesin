#!/bin/bash
# =============================================================
#  deploy.sh  –  Setup awal VPS untuk project-indah-mesin
#  Diuji di: Ubuntu 22.04 / 24.04 LTS
#  Jalankan sebagai root atau sudo user:
#    bash deploy.sh   (JANGAN: sh deploy.sh)
# =============================================================

if [ -z "${BASH_VERSION:-}" ]; then
    exec /bin/bash "$0" "$@"
fi

# ── Warna output ─────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
failmsg() { echo -e "${RED}[FAIL]${NC} $1"; }

# ── Pelacakan step gagal ─────────────────────────────────────
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

print_deploy_report() {
    echo ""
    echo -e "${GREEN}============================================${NC}"
    if [ "${#FAILED_STEPS[@]}" -eq 0 ]; then
        echo -e "${GREEN}  Deploy selesai — semua step OK${NC}"
    else
        echo -e "${YELLOW}  Deploy selesai dengan ${#FAILED_STEPS[@]} step gagal${NC}"
        echo -e "${YELLOW}============================================${NC}"
        local i
        for i in "${!FAILED_STEPS[@]}"; do
            echo -e "  ${RED}✗${NC} ${FAILED_STEPS[$i]}"
            [ -n "${FAIL_HINTS[$i]}" ] && echo -e "      ${FAIL_HINTS[$i]}"
        done
    fi
    echo -e "${GREEN}============================================${NC}"
    echo -e "  Retort Monitor: ${YELLOW}${APP_URL}${NC}"
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
    echo -e "  #define MQTT_BROKER \"${VPS_IP}\""
    echo -e "  #define MQTT_USER   \"${MQTT_ESP_USER}\""
    echo -e "  #define MQTT_PASS   \"${MQTT_ESP_PASS}\""
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
    [ "${#FAILED_STEPS[@]}" -gt 0 ] && exit 1
}

# ── Konfigurasi — SESUAIKAN SEBELUM DIJALANKAN ───────────────
APP_DIR="/var/www/project-indah-mesin"
REPO_URL="https://github.com/Kacong05/project-indah-mesin.git"
REPO_BRANCH="adim"
DB_NAME="project_indah_mesin"
DB_USER="postgres"
DB_PASS="indah-Mesin.123"   # <── GANTI ini
PHP_VER="8.3"
PHP_BIN="/usr/bin/php${PHP_VER}"

VPS_IP="49.13.233.119"        # IP publik VPS
APP_PORT="8000"               # port Retort Monitor (web/API Laravel)
APP_URL="http://${VPS_IP}:${APP_PORT}"

# ── Keamanan MQTT & API ───────────────────────────────────────
MQTT_ESP_USER="retort_esp"
MQTT_BRIDGE_USER="retort_bridge"
MQTT_WEB_USER="retort_web"
CREDS_FILE="${APP_DIR}/.credentials.deploy"

# Pakai ulang kredensial jika sudah pernah deploy (hindari putus ESP32)
if [ -f "$CREDS_FILE" ]; then
    # shellcheck disable=SC1090
    . "$CREDS_FILE"
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

# ── Step functions ───────────────────────────────────────────

step_01_system() {
    apt-get update -qq
    apt-get upgrade -y -qq
}

step_02_php() {
    apt-get install -y -qq software-properties-common
    add-apt-repository -y ppa:ondrej/php
    apt-get update -qq
    apt-get install -y -qq \
        php${PHP_VER} php${PHP_VER}-fpm php${PHP_VER}-cli \
        php${PHP_VER}-pgsql php${PHP_VER}-mbstring php${PHP_VER}-xml \
        php${PHP_VER}-bcmath php${PHP_VER}-curl php${PHP_VER}-zip \
        php${PHP_VER}-intl php${PHP_VER}-tokenizer php${PHP_VER}-fileinfo
}

step_03_composer() {
    if ! command -v composer &>/dev/null; then
        curl -sS https://getcomposer.org/installer | "${PHP_BIN}" 
        mv composer.phar /usr/local/bin/composer
        chmod +x /usr/local/bin/composer
    else
        info "  Composer sudah ada, skip."
    fi
}

step_04_node() {
    local NEED_NODE_INSTALL=1
    if command -v node &>/dev/null; then
        local NODE_MAJOR NODE_MINOR
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
}

step_05_postgresql() {
    apt-get install -y -qq postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
    info "  Membuat database '$DB_NAME' dengan user '$DB_USER'..."
    sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || \
        warn "  Database '$DB_NAME' mungkin sudah ada."
    info "  PostgreSQL siap."
}

step_06_mosquitto() {
    apt-get install -y -qq mosquitto mosquitto-clients

    local f base
    for f in /etc/mosquitto/conf.d/*.conf; do
        [ -f "$f" ] || continue
        base=$(basename "$f")
        [ "$base" = "retort.conf" ] && continue
        mv "$f" "${f}.disabled"
        warn "  Config Mosquitto dinonaktifkan: $base → ${base}.disabled"
    done

    install -o root -g mosquitto -m 640 /dev/null /etc/mosquitto/passwd
    mosquitto_passwd -b /etc/mosquitto/passwd "$MQTT_ESP_USER" "$MQTT_ESP_PASS"
    mosquitto_passwd -b /etc/mosquitto/passwd "$MQTT_BRIDGE_USER" "$MQTT_BRIDGE_PASS"
    mosquitto_passwd -b /etc/mosquitto/passwd "$MQTT_WEB_USER" "$MQTT_WEB_PASS"
    chown root:mosquitto /etc/mosquitto/passwd
    chmod 640 /etc/mosquitto/passwd

    cat > /etc/mosquitto/acl << ACLCONF
# ESP32 logger
user ${MQTT_ESP_USER}
topic write retort/data
topic write retort/csv/#
topic write retort/system
topic read retort/cmd
topic read retort/csv/ack

# mqtt_bridge (server)
user ${MQTT_BRIDGE_USER}
topic read retort/#
topic write retort/csv/ack

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
    systemctl restart mosquitto
    systemctl is-active --quiet mosquitto
    info "  Mosquitto berjalan di port 1883 (auth required)."
}

step_07_clone() {
    apt-get install -y -qq git nginx
    if [ -d "$APP_DIR/.git" ]; then
        warn "  Repo sudah ada, pull terbaru..."
        git -C "$APP_DIR" pull origin "$REPO_BRANCH"
    else
        git clone -b "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
    fi
}

step_08_laravel() {
    cd "$APP_DIR"

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
    set_env_var SENSOR_API_TOKEN "$SENSOR_API_TOKEN"
    set_env_var MQTT_HOST 127.0.0.1
    set_env_var MQTT_PORT 1883
    set_env_var MQTT_USER "$MQTT_WEB_USER"
    set_env_var MQTT_PASSWORD "$MQTT_WEB_PASS"
    set_env_var MQTT_CMD_TOPIC retort/cmd
    set_env_var MQTT_BRIDGE_CSV_API_URL "http://127.0.0.1:${APP_PORT}/api/sessions/import-csv"

    cat > "$CREDS_FILE" << CREDS
# Generated $(date -Iseconds) — JANGAN commit ke git
MQTT_ESP_USER=$MQTT_ESP_USER
MQTT_ESP_PASS=$MQTT_ESP_PASS
MQTT_BRIDGE_USER=$MQTT_BRIDGE_USER
MQTT_BRIDGE_PASS=$MQTT_BRIDGE_PASS
MQTT_WEB_USER=$MQTT_WEB_USER
MQTT_WEB_PASS=$MQTT_WEB_PASS
SENSOR_API_TOKEN=$SENSOR_API_TOKEN
CREDS
    chmod 600 "$CREDS_FILE"
    chown www-data:www-data "$CREDS_FILE"

    composer install --no-dev --optimize-autoloader --no-interaction

    info "  npm install (frontend build)..."
    rm -rf node_modules
    if [ -f package-lock.json ]; then
        npm ci --ignore-scripts --legacy-peer-deps
    else
        npm install --ignore-scripts --legacy-peer-deps
    fi
    npm run build

    "${PHP_BIN}" artisan config:clear
    "${PHP_BIN}" artisan key:generate --force
    "${PHP_BIN}" artisan migrate --force
    "${PHP_BIN}" artisan db:seed --force
    "${PHP_BIN}" artisan config:cache
    "${PHP_BIN}" artisan route:cache
    "${PHP_BIN}" artisan view:cache

    chown -R www-data:www-data "$APP_DIR"
    chmod -R 775 "$APP_DIR/storage" "$APP_DIR/bootstrap/cache"
}

step_09_nginx() {
    cat > /etc/nginx/sites-available/project-indah-mesin << NGINXCONF
# Retort Monitor — listen port ${APP_PORT}
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

    ln -sf /etc/nginx/sites-available/project-indah-mesin /etc/nginx/sites-enabled/
    nginx -t
    systemctl reload nginx
}

step_10_services() {
    apt-get install -y -qq python3-venv python3-pip
    if [ ! -d "${APP_DIR}/.venv" ]; then
        python3 -m venv "${APP_DIR}/.venv"
    fi
    "${APP_DIR}/.venv/bin/pip" install -q --upgrade pip
    "${APP_DIR}/.venv/bin/pip" install -q paho-mqtt requests
    chown -R www-data:www-data "${APP_DIR}/.venv"

    local PYTHON_VENV="${APP_DIR}/.venv/bin/python3"

    cat > /etc/systemd/system/mqtt-bridge.service << BRIDGECONF
[Unit]
Description=MQTT Bridge ESP32 to Laravel (project-indah-mesin)
After=network.target mosquitto.service nginx.service postgresql.service

[Service]
User=www-data
WorkingDirectory=${APP_DIR}
Environment=API_URL=http://127.0.0.1:${APP_PORT}/api/sensor
Environment=SYSTEM_API_URL=http://127.0.0.1:${APP_PORT}/api/system-event
Environment=CSV_API_URL=http://127.0.0.1:${APP_PORT}/api/sessions/import-csv
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
ExecStart=${PHP_BIN} artisan queue:listen --tries=1 --timeout=0
StandardOutput=append:$APP_DIR/storage/logs/queue.log
StandardError=append:$APP_DIR/storage/logs/queue.log

[Install]
WantedBy=multi-user.target
QUEUECONF

    systemctl daemon-reload
    systemctl enable mqtt-bridge
    systemctl restart mqtt-bridge
    systemctl enable laravel-queue
    systemctl start laravel-queue

    if command -v ufw &>/dev/null; then
        ufw allow "${APP_PORT}/tcp" comment 'Retort Monitor' 2>/dev/null || true
        ufw allow 1883/tcp comment 'MQTT ESP32' 2>/dev/null || true
    fi
}

# ── Main ─────────────────────────────────────────────────────
info "=== Deploy project-indah-mesin ==="
info "Server IP   : $VPS_IP"
info "App dir     : $APP_DIR"
info "Branch      : $REPO_BRANCH"
info "Retort URL  : $APP_URL"
echo ""

step_run "1/10 Update sistem"                    step_01_system
step_run "2/10 Install PHP ${PHP_VER}"           step_02_php
step_run "3/10 Install Composer"                 step_03_composer
step_run "4/10 Install Node.js 22"               step_04_node
step_run "5/10 Install PostgreSQL"               step_05_postgresql
step_run "6/10 Install Mosquitto MQTT"           step_06_mosquitto
step_run "7/10 Clone repository"                 step_07_clone
step_run "8/10 Setup Laravel"                    step_08_laravel
step_run "9/10 Konfigurasi Nginx port ${APP_PORT}" step_09_nginx
step_run "10/10 MQTT bridge + queue worker"      step_10_services

print_deploy_report
