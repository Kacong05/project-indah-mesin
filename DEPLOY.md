# Panduan Deploy VPS — project-indah-mesin

Tutorial lengkap: PostgreSQL + Laravel + MQTT + data terkirim ke database.

---

## Apakah PostgreSQL perlu diinstal?

**Ya, wajib.** Project Laravel ini memakai PostgreSQL untuk:

| Fungsi | Koneksi |
|--------|---------|
| Data sensor (suhu, tekanan) | `sensor_readings` |
| Daftar mesin retort | `retort_machines` |
| User login (admin/operator) | `users` |
| Session web | `sessions` |
| Cache & queue | `cache`, `jobs` |

Tanpa PostgreSQL, `php artisan migrate` gagal dan API `/api/sensor` tidak bisa menyimpan data.

---

## Arsitektur alur data

```
ESP32 RetortLogger
    │  publish JSON tiap 2 detik
    ▼
Mosquitto MQTT (port 1883)
    │  topic: retort/data
    ▼
mqtt_bridge.py  ← script jembatan (WAJIB)
    │  HTTP POST
    ▼
Laravel  /api/sensor
    │  INSERT
    ▼
PostgreSQL  (tabel sensor_readings)
    │
    ▼
Dashboard web (login operator/admin)
```

> **Penting:** Laravel tidak subscribe MQTT langsung. Tanpa `mqtt_bridge.py`, data ESP32 hanya ada di broker MQTT, tidak masuk database.

---

## Bagian 1 — Install PostgreSQL (Ubuntu 22.04/24.04)

SSH ke VPS:

```bash
ssh root@IP_VPS_ANDA
```

Install PostgreSQL:

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql   # harus active (running)
```

Buat database dan password:

```bash
# Ganti PASSWORD_KUAT dengan password aman
sudo -u postgres psql << 'EOF'
ALTER USER postgres WITH PASSWORD 'PASSWORD_KUAT';
CREATE DATABASE project_indah_mesin OWNER postgres;
\q
EOF
```

Cek koneksi:

```bash
sudo -u postgres psql -d project_indah_mesin -c "SELECT version();"
```

---

## Bagian 2 — Clone project & setup Laravel

```bash
sudo apt install -y git nginx php8.3-fpm php8.3-pgsql php8.3-mbstring \
  php8.3-xml php8.3-bcmath php8.3-curl php8.3-zip php8.3-intl unzip curl

# Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Node (untuk build frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone
sudo mkdir -p /var/www
cd /var/www
sudo git clone -b main https://github.com/Kacong05/project-indah-mesin.git
cd project-indah-mesin
```

Edit `.env`:

```bash
sudo cp .env.example .env
sudo nano .env
```

Isi minimal:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=http://IP_VPS_ANDA

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=project_indah_mesin
DB_USERNAME=postgres
DB_PASSWORD=PASSWORD_KUAT

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=database
```

Install & migrate:

```bash
composer install --no-dev --optimize-autoloader
npm install --ignore-scripts
npm run build
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
```

Seeder membuat:
- Admin: `admin@retort.com` / `password`
- Operator: `operator@retort.com` / `password`
- Mesin dummy: **`RT-001`**

Permission:

```bash
sudo chown -R www-data:www-data /var/www/project-indah-mesin
sudo chmod -R 775 storage bootstrap/cache
```

---

## Bagian 3 — Install Mosquitto (MQTT Broker)

```bash
sudo apt install -y mosquitto mosquitto-clients

sudo tee /etc/mosquitto/conf.d/retort.conf << 'EOF'
listener 1883
allow_anonymous true
EOF

sudo systemctl enable mosquitto
sudo systemctl restart mosquitto
```

Buka firewall:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 1883/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

Test MQTT:

```bash
# Terminal 1 — subscribe
mosquitto_sub -h localhost -t "retort/data" -v

# Terminal 2 — publish test
mosquitto_pub -h localhost -t "retort/data" -m '{"id":"RT-001","actual":97.5,"phase":"logging"}'
```

---

## Bagian 4 — Test kirim data ke PostgreSQL (tanpa ESP32)

### Cara A: curl langsung

```bash
curl -X POST http://IP_VPS_ANDA/api/sensor \
  -H "Content-Type: application/json" \
  -d '{
    "machine_code": "RT-001",
    "temperature": 121.5,
    "pressure": 1.8,
    "process_status": "holding"
  }'
```

Respon sukses:

```json
{"success":true,"message":"Sensor reading recorded successfully.","data":{...}}
```

Cek di database:

```bash
sudo -u postgres psql -d project_indah_mesin -c \
  "SELECT id, temperature, pressure, process_status, recorded_at FROM sensor_readings ORDER BY id DESC LIMIT 5;"
```

### Cara B: worker.py (simulasi)

Di VPS atau PC lokal (arahkan ke VPS):

```bash
pip install requests
# Edit API_URL di worker.py ke http://IP_VPS/api/sensor
# Jalankan dengan kode mesin RT-001 (default, sama dengan database & ESP32)
python worker.py RT-001
```

> `machine_code` **harus sudah ada** di tabel `retort_machines`. Default seeder: **RT-001**.

---

## Bagian 5 — MQTT Bridge (ESP32 → PostgreSQL)

Install dependency:

```bash
sudo apt install -y python3-pip
pip3 install paho-mqtt requests
```

Jalankan bridge:

```bash
cd /var/www/project-indah-mesin
export API_URL="http://127.0.0.1:8080/api/sensor"
export MQTT_TOPIC="retort/data"
python3 mqtt_bridge.py
```

Service systemd (jalan otomatis):

```bash
sudo tee /etc/systemd/system/mqtt-bridge.service << 'EOF'
[Unit]
Description=MQTT Bridge ESP32 to Laravel
After=network.target mosquitto.service nginx.service postgresql.service

[Service]
User=www-data
WorkingDirectory=/var/www/project-indah-mesin
Environment=API_URL=http://127.0.0.1/api/sensor
Environment=MQTT_TOPIC=retort/data
ExecStart=/usr/bin/python3 /var/www/project-indah-mesin/mqtt_bridge.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable mqtt-bridge
sudo systemctl start mqtt-bridge
sudo systemctl status mqtt-bridge
```

---

## Bagian 6 — Kode mesin (seragam RT-001)

Semua komponen memakai kode yang sama:

| Komponen | Kode |
|----------|------|
| ESP32 default (`config.ino`) | `RT-001` |
| Database seeder | `RT-001` |
| worker.py | `RT-001` |
| MQTT payload field `id` | `RT-001` |

Tidak perlu mapping tambahan. Untuk mesin kedua, tambahkan `RT-002` di database dan ubah Nomor Mesin di ESP32.

```bash
sudo -u postgres psql -d project_indah_mesin << 'EOF'
INSERT INTO retort_machines (machine_code, name, location, status, created_at, updated_at)
VALUES ('RT-002', 'Retort Line 2', 'Produksi', 'standby', NOW(), NOW())
ON CONFLICT (machine_code) DO NOTHING;
EOF
```

---

## Bagian 7 — Deploy berdampingan dengan web lain (tanpa domain, pakai IP)

Jika web lama hanya diakses lewat IP (mis. `http://82.153.226.85`), **jangan pakai port 80** untuk Retort Monitor — itu akan bentrok.

Solusi: **beda port**.

```
http://82.153.226.85        → web lama (port 80, TIDAK DIUBAH)
http://82.153.226.85:8080   → Retort Monitor (port baru)
82.153.226.85:1883          → MQTT broker (ESP32)
```

### Konfigurasi di deploy.sh

```bash
VPS_IP="82.153.226.85"
APP_PORT="8080"
```

Script hanya menambah nginx config baru di port `8080`. Site web lama di port `80` **tidak disentuh**.

### Buka port firewall

```bash
sudo ufw allow 8080/tcp    # dashboard Retort
sudo ufw allow 1883/tcp    # MQTT ESP32
# port 80 biasanya sudah terbuka untuk web lama
```

### Cek setelah deploy

```bash
# Web lama masih jalan?
curl -I http://82.153.226.85

# Retort Monitor
curl -I http://82.153.226.85:8080

# Test API sensor
curl -X POST http://82.153.226.85:8080/api/sensor \
  -H "Content-Type: application/json" \
  -d '{"machine_code":"RT-001","temperature":121.0,"pressure":1.5,"process_status":"holding"}'
```

### Login dashboard

Buka browser: **http://82.153.226.85:8080**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@retort.com | password |
| Operator | operator@retort.com | password |

### Jika nanti beli domain (opsional)

Bisa pindah ke subdomain + port 80 dengan `server_name retort.domain.com` — tidak wajib untuk sekarang.

### Yang dibagi antar site (aman)

| Resource | Dampak ke web lama |
|----------|-------------------|
| Nginx port 80 | **Tidak disentuh** — retort pakai port 8080 |
| PostgreSQL | Tidak — database terpisah |
| PHP-FPM | Tidak — app terpisah |
| Mosquitto 1883 | Tidak — service independen |

---

## Bagian 8 — Konfigurasi ESP32

Di halaman **Settings** web ESP32 (AP `RetortLogger-Config`):

| Field | Nilai |
|-------|-------|
| WiFi SSID | SSID jaringan pabrik |
| WiFi Password | password WiFi |
| MQTT Broker | `IP_VPS_ANDA` |
| MQTT Port | `1883` |

Di `config.ino` sebelum flash (**harus sama dengan VPS**):

```cpp
#define MQTT_USER       "retort_esp"
#define MQTT_PASS       "password-dari-deploy-vps"
#define MQTT_PUB_TOPIC  "retort/data"
#define MQTT_CMD_TOPIC  "retort/cmd"
```

Password MQTT & API token tercetak di akhir `deploy.sh` dan tersimpan di:
`/var/www/project-indah-mesin/.credentials.deploy`

---

## Keamanan API & MQTT

### API `/api/sensor`

Wajib kirim token di header:

```bash
curl -X POST http://82.153.226.85:8080/api/sensor \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DARI_ENV" \
  -d '{"machine_code":"RT-001","temperature":121,"pressure":1.5,"process_status":"holding"}'
```

Token disimpan di `.env` Laravel:

```env
SENSOR_API_TOKEN=...
```

Generate manual (lokal):

```bash
php -r "echo bin2hex(random_bytes(32));"
```

### MQTT Mosquitto

| User | Hak akses | Dipakai oleh |
|------|-----------|--------------|
| `retort_esp` | publish `retort/data`, subscribe `retort/cmd` | ESP32 |
| `retort_bridge` | read `retort/#` | mqtt_bridge.py |

`allow_anonymous false` — koneksi tanpa user/password ditolak.

Test subscribe (di VPS):

```bash
mosquitto_sub -h localhost -u retort_bridge -P 'PASSWORD' -t retort/data -v
```

Test publish:

```bash
mosquitto_pub -h localhost -u retort_esp -P 'PASSWORD' -t retort/data \
  -m '{"id":"RT-001","actual":97.5,"phase":"idle"}'
```

### Update VPS yang sudah jalan (dari anonymous)

```bash
cd /var/www/project-indah-mesin
git pull
# Set SENSOR_API_TOKEN di .env jika belum ada
nano .env

php artisan config:cache
sudo systemctl restart mqtt-bridge
# Ulangi setup Mosquitto auth dari deploy.sh bagian 6, atau jalankan deploy.sh sekali
```

---

## Bagian 9 — Verifikasi end-to-end

1. ESP32 dashboard: WiFi = OK, MQTT = OK
2. Di VPS: `mosquitto_sub -h localhost -t retort/data -v` → ada JSON tiap 2 detik
3. Bridge log: `[OK] RT-001 | 97.0°C | idle`
4. Database:
   ```bash
   sudo -u postgres psql -d project_indah_mesin -c \
     "SELECT COUNT(*) FROM sensor_readings;"
   ```
5. Buka browser: `http://IP_VPS_ANDA` → login `operator@retort.com` / `password` → Dashboard ada data baru

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| `SQLSTATE[08006]` | PostgreSQL mati / password salah | Cek `systemctl status postgresql`, `.env` DB_* |
| HTTP 422 validation | `machine_code` tidak ada | Insert ke `retort_machines` atau samakan kode |
| MQTT OK tapi DB kosong | Bridge tidak jalan | `systemctl start mqtt-bridge` |
| `exists:retort_machines` error | Kode mesin typo | Cek `SELECT * FROM retort_machines;` |
| Port 1883 refused | Firewall / Mosquitto | `ufw allow 1883`, `systemctl restart mosquitto` |
| HTTP 401 Unauthorized | Token API salah/kosong | Cek `SENSOR_API_TOKEN` di `.env` dan mqtt_bridge service |
| MQTT connect failed ESP32 | User/pass salah | Samakan `MQTT_USER`/`MQTT_PASS` di `config.ino` dengan VPS |
| Mosquitto not authorized | ACL / password | Cek `/etc/mosquitto/passwd` dan `acl` |

---

## Deploy otomatis (opsional)

```bash
bash deploy.sh
```

Lalu lanjutkan Bagian 5 (mqtt-bridge) dan Bagian 6 (kode mesin) secara manual.

---

## Restart & cek koneksi cepat (`restart_check.sh`)

Skrip **sekali jalan** untuk dipakai saat MQTT ESP32 "off" atau setelah ganti
kredensial. Skrip akan: menyamakan password user MQTT ESP di broker dengan nilai
di `RetortLogger/config.ino`, me-restart semua service (Mosquitto, PHP-FPM,
Nginx, mqtt-bridge, queue, PostgreSQL), lalu menguji listener MQTT, round-trip
publish/subscribe, dan endpoint `POST /api/sensor`.

> **Catatan port:** `82.153.226.85:8080` = web/API Laravel. `82.153.226.85:1883`
> = broker MQTT (yang dipakai ESP32). ESP32 **tidak** terhubung ke 8080.

Jalankan di VPS sebagai root:

```bash
cd /var/www/project-indah-mesin
git pull                      # ambil restart_check.sh terbaru
sudo bash restart_check.sh
```

Sebelum menjalankan, pastikan variabel di bagian atas `restart_check.sh` cocok
dengan `RetortLogger/config.ino` (`MQTT_ESP_USER`, `MQTT_ESP_PASS`, `VPS_IP`,
`APP_PORT`). Setelah skrip selesai dan semua cek `[OK]`, **re-flash ESP32**
dengan `config.ino` (broker `82.153.226.85`, port `1883`).

Pantau data masuk:

```bash
journalctl -fu mqtt-bridge
```
