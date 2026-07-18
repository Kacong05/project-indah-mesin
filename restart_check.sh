#!/bin/bash
# =============================================================
#  restart_check.sh  –  Sinkron kredensial MQTT + restart service
#  Jalankan di VPS sebagai root:
#      bash restart_check.sh   (JANGAN: sh restart_check.sh)
#
#  Membaca .credentials.deploy (dari deploy.sh), menyamakan
#  password Mosquitto + mqtt-bridge.service, lalu tes koneksi.
# =============================================================

if [ -z "${BASH_VERSION:-}" ]; then
    exec /bin/bash "$0" "$@"
fi

set -u

# ── Konfigurasi — sesuaikan dengan deploy.sh ─────────────────
VPS_IP="49.13.233.119"
APP_PORT="8000"
MQTT_PORT="1883"
APP_DIR="/var/www/project-indah-mesin"
MQTT_DATA_TOPIC="retort/data"

CREDS_FILE="${APP_DIR}/.credentials.deploy"
ENV_FILE="${APP_DIR}/.env"
BRIDGE_SERVICE="/etc/systemd/system/mqtt-bridge.service"

# ── Warna & helper ───────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
info() { echo -e "${YELLOW}[..]${NC}   $1"; }
fail() { echo -e "${RED}[X]${NC}    $1"; }

if [ "$(id -u)" -ne 0 ]; then
    fail "Jalankan sebagai root: sudo bash restart_check.sh"
    exit 1
fi

echo "=============================================="
echo "  Restart & Cek Koneksi — Retort Monitor"
echo "  VPS=${VPS_IP}  Web/API=:${APP_PORT}  MQTT=:${MQTT_PORT}"
echo "=============================================="

# ── Kredensial wajib dari deploy ─────────────────────────────
if [ ! -f "$CREDS_FILE" ]; then
    fail "File $CREDS_FILE tidak ada. Jalankan deploy.sh dulu."
    exit 1
fi
# shellcheck disable=SC1090
. "$CREDS_FILE"
ok "Kredensial dibaca dari $CREDS_FILE"

MQTT_ESP_USER="${MQTT_ESP_USER:-retort_esp}"
MQTT_BRIDGE_USER="${MQTT_BRIDGE_USER:-retort_bridge}"
MQTT_WEB_USER="${MQTT_WEB_USER:-retort_web}"

for var in MQTT_ESP_PASS MQTT_BRIDGE_PASS MQTT_WEB_PASS; do
    if [ -z "${!var:-}" ]; then
        fail "$var kosong di $CREDS_FILE"
        exit 1
    fi
done

if [ -z "${SENSOR_API_TOKEN:-}" ] && [ -f "$ENV_FILE" ]; then
    SENSOR_API_TOKEN=$(grep -E '^SENSOR_API_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '" ')
fi

# ─────────────────────────────────────────────────────────────
# 1. Sinkron SEMUA user MQTT di broker (esp + bridge + web)
# ─────────────────────────────────────────────────────────────
echo ""
info "1) Sinkron password Mosquitto dari .credentials.deploy..."
if ! command -v mosquitto_passwd >/dev/null 2>&1; then
    fail "mosquitto belum terpasang. Jalankan deploy.sh dulu."
    exit 1
fi
if [ ! -f /etc/mosquitto/passwd ]; then
    install -o root -g mosquitto -m 640 /dev/null /etc/mosquitto/passwd
fi

mosquitto_passwd -b /etc/mosquitto/passwd "$MQTT_ESP_USER" "$MQTT_ESP_PASS"
mosquitto_passwd -b /etc/mosquitto/passwd "$MQTT_BRIDGE_USER" "$MQTT_BRIDGE_PASS"
mosquitto_passwd -b /etc/mosquitto/passwd "$MQTT_WEB_USER" "$MQTT_WEB_PASS"
chown root:mosquitto /etc/mosquitto/passwd 2>/dev/null || true
chmod 640 /etc/mosquitto/passwd
ok "Broker: ${MQTT_ESP_USER}, ${MQTT_BRIDGE_USER}, ${MQTT_WEB_USER} disinkronkan."

# ─────────────────────────────────────────────────────────────
# 2. Sinkron mqtt-bridge.service (fix 'not authorised')
# ─────────────────────────────────────────────────────────────
echo ""
info "2) Sinkron mqtt-bridge.service..."
if [ -f "$BRIDGE_SERVICE" ]; then
    sed -i "s|^Environment=MQTT_PASS=.*|Environment=MQTT_PASS=${MQTT_BRIDGE_PASS}|" "$BRIDGE_SERVICE"
    if [ -n "${SENSOR_API_TOKEN:-}" ]; then
        sed -i "s|^Environment=SENSOR_API_TOKEN=.*|Environment=SENSOR_API_TOKEN=${SENSOR_API_TOKEN}|" "$BRIDGE_SERVICE"
    fi
    systemctl daemon-reload
    ok "mqtt-bridge.service Environment diperbarui."
else
    info "mqtt-bridge.service belum ada — lewati (jalankan deploy.sh step 10)."
fi

# ─────────────────────────────────────────────────────────────
# 3. Restart semua service
# ─────────────────────────────────────────────────────────────
echo ""
info "3) Restart service..."
PHP_FPM=$(systemctl list-units --type=service --all 2>/dev/null | grep -oE 'php[0-9.]+-fpm' | head -1)

for svc in mosquitto ${PHP_FPM} nginx mqtt-bridge laravel-queue postgresql; do
    [ -z "$svc" ] && continue
    if systemctl list-unit-files 2>/dev/null | grep -q "^${svc}.service"; then
        systemctl restart "$svc" 2>/dev/null && ok "restart ${svc}" || fail "gagal restart ${svc}"
    fi
done
sleep 2

echo ""
info "Status service:"
for svc in mosquitto ${PHP_FPM} nginx mqtt-bridge laravel-queue postgresql; do
    [ -z "$svc" ] && continue
    if systemctl list-unit-files 2>/dev/null | grep -q "^${svc}.service"; then
        if systemctl is-active --quiet "$svc"; then
            ok "${svc} active"
        else
            fail "${svc} TIDAK active (journalctl -xeu ${svc})"
        fi
    fi
done

# ─────────────────────────────────────────────────────────────
# 4. Cek port MQTT listening
# ─────────────────────────────────────────────────────────────
echo ""
info "4) Cek listener MQTT :${MQTT_PORT}..."
if ss -ltn 2>/dev/null | grep -q ":${MQTT_PORT} "; then
    ok "Mosquitto listening di :${MQTT_PORT}"
else
    fail "Tidak ada listener di :${MQTT_PORT} — cek /etc/mosquitto/conf.d/retort.conf"
fi

# ─────────────────────────────────────────────────────────────
# 5. Tes round-trip MQTT
# ─────────────────────────────────────────────────────────────
echo ""
info "5) Tes round-trip MQTT..."
if command -v mosquitto_sub >/dev/null 2>&1; then
    OUT=$(mktemp)
    mosquitto_sub -h 127.0.0.1 -u "$MQTT_BRIDGE_USER" -P "$MQTT_BRIDGE_PASS" \
        -t "$MQTT_DATA_TOPIC" -C 1 -W 6 > "$OUT" 2>/dev/null &
    SUBPID=$!
    sleep 1
    TESTMSG='{"id":"SELFTEST","actual":12.3,"setting":120.0,"phase":"idle","logging":false,"iso":"2026-07-18T12:00:00+07:00"}'
    if mosquitto_pub -h 127.0.0.1 -u "$MQTT_ESP_USER" -P "$MQTT_ESP_PASS" \
        -t "$MQTT_DATA_TOPIC" -m "$TESTMSG" 2>/tmp/mqtt_pub.err; then
        ok "Publish sebagai '${MQTT_ESP_USER}' berhasil."
    else
        fail "Publish GAGAL: $(cat /tmp/mqtt_pub.err 2>/dev/null)"
    fi
    wait "$SUBPID" 2>/dev/null
    if [ -s "$OUT" ]; then
        ok "Bridge menerima: $(head -c 80 "$OUT")"
    else
        fail "Bridge tidak menerima pesan (cek ACL atau mqtt-bridge not authorised)."
    fi
    rm -f "$OUT"
else
    info "mosquitto_sub tidak tersedia — lewati."
fi

# ─────────────────────────────────────────────────────────────
# 6. Tes API Laravel
# ─────────────────────────────────────────────────────────────
echo ""
info "6) Tes API http://127.0.0.1:${APP_PORT}/api/sensor..."
if [ -n "${SENSOR_API_TOKEN:-}" ]; then
    NOW_ISO=$(date -Iseconds)
    CODE=$(curl -s -o /tmp/api.out -w '%{http_code}' -X POST \
        "http://127.0.0.1:${APP_PORT}/api/sensor" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${SENSOR_API_TOKEN}" \
        -d "{\"machine_code\":\"RT-001\",\"temperature\":99.9,\"pressure\":1.0,\"process_status\":\"idle\",\"recorded_at\":\"${NOW_ISO}\"}")
    if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
        if grep -q '"success":true' /tmp/api.out 2>/dev/null; then
            ok "API balas HTTP ${CODE} — token valid ($(head -c 80 /tmp/api.out))."
        else
            fail "API HTTP ${CODE} tapi success!=true: $(head -c 160 /tmp/api.out)"
        fi
    else
        fail "API HTTP ${CODE}: $(head -c 160 /tmp/api.out)"
    fi
else
    fail "SENSOR_API_TOKEN kosong — cek .env / .credentials.deploy."
fi

# ─────────────────────────────────────────────────────────────
# Ringkasan
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}=============================================="
echo -e "  Selesai${NC}"
echo -e "  Re-flash ESP32 dengan RetortLogger/config.ino:"
echo -e "    #define MQTT_BROKER \"${VPS_IP}\""
echo -e "    #define MQTT_PORT   ${MQTT_PORT}"
echo -e "    #define MQTT_USER   \"${MQTT_ESP_USER}\""
echo -e "    #define MQTT_PASS   \"${MQTT_ESP_PASS}\""
echo -e "  Pantau bridge : ${YELLOW}journalctl -fu mqtt-bridge${NC}"
echo ""
