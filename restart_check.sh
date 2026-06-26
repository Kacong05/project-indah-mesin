#!/bin/bash
# =============================================================
#  restart_check.sh  –  Sekali jalan: samakan token MQTT ESP,
#                       restart semua service, dan cek koneksi.
#  Jalankan di VPS sebagai root/sudo:
#      sudo bash restart_check.sh
#
#  Untuk apa:
#    - ESP32 MQTT "off" biasanya karena IP broker / password tak cocok.
#    - Skrip ini MEMAKSA password user MQTT ESP di broker = nilai di
#      RetortLogger/config.ino, lalu restart + tes publish/subscribe + API.
# =============================================================
set -u

# ── Konfigurasi — HARUS sama dengan RetortLogger/config.ino ──────────
VPS_IP="82.153.226.85"          # IP publik VPS (broker MQTT)
APP_PORT="8080"                 # port web/API Laravel (BUKAN port MQTT)
MQTT_PORT="1883"                # port broker Mosquitto (dipakai ESP32)
APP_DIR="/var/www/project-indah-mesin"

# Kredensial MQTT ESP — samakan persis dengan config.ino (MQTT_USER/MQTT_PASS)
MQTT_ESP_USER="retort_esp"
MQTT_ESP_PASS="RetortEsp_1f1dafaf9d570f46"
MQTT_DATA_TOPIC="retort/data"

CREDS_FILE="${APP_DIR}/.credentials.deploy"
ENV_FILE="${APP_DIR}/.env"

# ── Warna & helper ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
info() { echo -e "${YELLOW}[..]${NC}   $1"; }
fail() { echo -e "${RED}[X]${NC}    $1"; }

if [ "$(id -u)" -ne 0 ]; then
    fail "Jalankan sebagai root: sudo bash restart_check.sh"; exit 1
fi

echo "=============================================="
echo "  Restart & Cek Koneksi — Retort Monitor"
echo "  VPS=${VPS_IP}  Web/API=:${APP_PORT}  MQTT=:${MQTT_PORT}"
echo "=============================================="

# ── Ambil kredensial bridge & API token dari file deploy/.env ────────
MQTT_BRIDGE_USER=""; MQTT_BRIDGE_PASS=""; SENSOR_API_TOKEN=""
if [ -f "$CREDS_FILE" ]; then
    # shellcheck disable=SC1090
    source "$CREDS_FILE"
    ok "Kredensial dibaca dari $CREDS_FILE"
else
    info "$CREDS_FILE tidak ada — sebagian cek (bridge/API) dilewati."
fi
if [ -z "${SENSOR_API_TOKEN:-}" ] && [ -f "$ENV_FILE" ]; then
    SENSOR_API_TOKEN=$(grep -E '^SENSOR_API_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '" ')
fi

# ─────────────────────────────────────────────────────────────
# 1. Samakan password MQTT user ESP di broker = config.ino
# ─────────────────────────────────────────────────────────────
echo ""; info "1) Sinkron password MQTT ESP ('${MQTT_ESP_USER}')..."
if ! command -v mosquitto_passwd >/dev/null 2>&1; then
    fail "mosquitto belum terpasang. Jalankan deploy.sh dulu."; exit 1
fi
if [ ! -f /etc/mosquitto/passwd ]; then
    install -o root -g mosquitto -m 640 /dev/null /etc/mosquitto/passwd
fi
mosquitto_passwd -b /etc/mosquitto/passwd "$MQTT_ESP_USER" "$MQTT_ESP_PASS"
chown root:mosquitto /etc/mosquitto/passwd 2>/dev/null || true
chmod 640 /etc/mosquitto/passwd
ok "Password '${MQTT_ESP_USER}' di broker kini sama dengan config.ino."

# ─────────────────────────────────────────────────────────────
# 2. Restart semua service
# ─────────────────────────────────────────────────────────────
echo ""; info "2) Restart service..."
PHP_FPM=$(systemctl list-units --type=service --all 2>/dev/null | grep -oE 'php[0-9.]+-fpm' | head -1)

for svc in mosquitto ${PHP_FPM} nginx mqtt-bridge laravel-queue postgresql; do
    [ -z "$svc" ] && continue
    if systemctl list-unit-files 2>/dev/null | grep -q "^${svc}.service"; then
        systemctl restart "$svc" 2>/dev/null && ok "restart ${svc}" || fail "gagal restart ${svc}"
    fi
done
sleep 2

echo ""; info "Status service:"
for svc in mosquitto ${PHP_FPM} nginx mqtt-bridge laravel-queue postgresql; do
    [ -z "$svc" ] && continue
    if systemctl list-unit-files 2>/dev/null | grep -q "^${svc}.service"; then
        if systemctl is-active --quiet "$svc"; then ok "${svc} active"; else fail "${svc} TIDAK active (journalctl -xeu ${svc})"; fi
    fi
done

# ─────────────────────────────────────────────────────────────
# 3. Cek port MQTT terbuka & listening
# ─────────────────────────────────────────────────────────────
echo ""; info "3) Cek listener MQTT :${MQTT_PORT}..."
if ss -ltn 2>/dev/null | grep -q ":${MQTT_PORT} "; then
    ok "Mosquitto listening di :${MQTT_PORT}"
else
    fail "Tidak ada listener di :${MQTT_PORT} — cek /etc/mosquitto/conf.d/retort.conf"
fi

# ─────────────────────────────────────────────────────────────
# 4. Tes publish/subscribe MQTT (round-trip)
# ─────────────────────────────────────────────────────────────
echo ""; info "4) Tes round-trip MQTT (publish sebagai ESP)..."
if command -v mosquitto_sub >/dev/null 2>&1 && [ -n "${MQTT_BRIDGE_PASS:-}" ]; then
    OUT=$(mktemp)
    mosquitto_sub -h 127.0.0.1 -u "$MQTT_BRIDGE_USER" -P "$MQTT_BRIDGE_PASS" \
        -t "$MQTT_DATA_TOPIC" -C 1 -W 6 > "$OUT" 2>/dev/null &
    SUBPID=$!
    sleep 1
    TESTMSG='{"id":"SELFTEST","actual":12.3,"setting":120.0,"phase":"idle","logging":false}'
    if mosquitto_pub -h 127.0.0.1 -u "$MQTT_ESP_USER" -P "$MQTT_ESP_PASS" \
        -t "$MQTT_DATA_TOPIC" -m "$TESTMSG" 2>/tmp/mqtt_pub.err; then
        ok "Publish sebagai '${MQTT_ESP_USER}' berhasil (password cocok)."
    else
        fail "Publish GAGAL — password '${MQTT_ESP_USER}' ditolak: $(cat /tmp/mqtt_pub.err)"
    fi
    wait "$SUBPID" 2>/dev/null
    if [ -s "$OUT" ]; then ok "Bridge user menerima pesan: $(head -c 80 "$OUT")"; else fail "Pesan tak diterima subscriber (cek ACL/bridge)"; fi
    rm -f "$OUT"
else
    info "Lewati round-trip (mosquitto_sub / kredensial bridge tidak tersedia)."
fi

# ─────────────────────────────────────────────────────────────
# 5. Tes API Laravel /api/sensor dengan token
# ─────────────────────────────────────────────────────────────
echo ""; info "5) Tes API http://127.0.0.1:${APP_PORT}/api/sensor..."
if [ -n "${SENSOR_API_TOKEN:-}" ]; then
    CODE=$(curl -s -o /tmp/api.out -w '%{http_code}' -X POST \
        "http://127.0.0.1:${APP_PORT}/api/sensor" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${SENSOR_API_TOKEN}" \
        -d '{"machine_code":"RT-001","temperature":99.9,"pressure":1.0,"process_status":"idle"}')
    if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
        ok "API balas HTTP ${CODE} — token & DB jalan."
    else
        fail "API HTTP ${CODE}: $(head -c 160 /tmp/api.out)"
    fi
else
    fail "SENSOR_API_TOKEN kosong — set di .env / .credentials.deploy."
fi

# ─────────────────────────────────────────────────────────────
# Ringkasan
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}=============================================="
echo -e "  Selesai${NC}"
echo -e "  Pastikan RetortLogger/config.ino sebelum flash:"
echo -e "    #define MQTT_BROKER \"${VPS_IP}\""
echo -e "    #define MQTT_PORT   ${MQTT_PORT}"
echo -e "    #define MQTT_USER   \"${MQTT_ESP_USER}\""
echo -e "    #define MQTT_PASS   \"${MQTT_ESP_PASS}\""
echo -e "  API token (bridge→Laravel): ${YELLOW}${SENSOR_API_TOKEN:-<kosong>}${NC}"
echo -e "  Pantau data masuk : ${YELLOW}journalctl -fu mqtt-bridge${NC}"
echo ""
