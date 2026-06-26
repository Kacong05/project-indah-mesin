# RetortLogger

Firmware untuk **Industrial Retort Logger** berbasis ESP32-S3.

Ditulis dalam Arduino IDE (.ino, multi-tab).  
Dirancang agar semua modul hardware dapat diaktifkan hanya dengan mengubah satu baris `#define`.

---

## Struktur File

| File | Isi |
|------|-----|
| `RetortLogger.ino` | Entry point, feature flags, `setup()`, `loop()`, **task logger** |
| `config.ino` | Preferences (NVS) load/save + kredensial MQTT |
| `wifi_ap.ino` | AP mode, captive portal, STA connect |
| `mqtt_client.ino` | MQTT publish, subscribe, command handler |
| `retort_sim.ino` | Simulasi heating/holding/cooling (mode fake sensor) |
| `modbus_hw.ino` | RS485 Modbus RTU — raw RTU, baca PV & SV dari TNL |
| `rtc_hw.ino` | DS3231M RTC (timestamp log) |
| `sd_logger.ino` | MicroSD CSV log (perekaman per sesi) |
| `ota_update.ino` | OTA firmware update (nonaktif default) |
| `web_*.ino` | Halaman web embedded (auth, dashboard, settings, logs, storage) |

---

## Feature Flags

Edit bagian atas `RetortLogger.ino`:

```cpp
#define USE_FAKE_SENSOR false  // Simulasi sensor (true HANYA tanpa Modbus)
#define USE_MODBUS      true   // RS485 Modbus RTU - Autonics TNL
#define USE_RTC         true   // DS3231M RTC
#define USE_SD          true   // MicroSD logging
#define USE_OTA         false  // OTA update
```

PENTING: `USE_FAKE_SENSOR` dan `USE_MODBUS` tidak boleh `true` bersamaan —
simulasi akan menimpa data nyata dari controller.

---

## Pin Map (ESP32-S3)

| Fungsi | Pin |
|--------|-----|
| RTC DS3231 SDA / SCL | 8 / 9 |
| RS485 onboard (Serial1) **TX2 / RX2** | **15 / 16** |
| RS485 DE (arah) | −1 (board auto-direction, tak ada pin DE) |
| MicroSD CS / MOSI / CLK / MISO | 10 / 11 / 12 / 13 |

> Sesuai pinout resmi board khurs ESP32-S3 IoT Logger: **TX2=GPIO15, RX2=GPIO16**.
> `Serial1.begin(baud, fmt, RX=16, TX=15)`.
>
> Wiring ke Autonics TNL (terminal **13 = A+**, **14 = B−**):
> **TNL-13 → board A+**, **TNL-14 → board B−**. Jika tidak ada komunikasi,
> tukar A+↔B− di terminal RS485 board.

---

## Sumber Data (Autonics TNL-P46RR-RS-035)

Firmware memakai **raw Modbus RTU** (tanpa library) dengan timeout pendek
(150 ms) agar tidak pernah mem-block siklus 1 detik. Dua transaksi terpisah:

| Fungsi | FC | Register | Isi |
|--------|----|----------|-----|
| PV + decimal point | **FC04** (Input) | `0x03E8` (+`0x03E9`) | Present Value (Actual) & skala |
| SV | **FC03** (Holding) | `0x0000` | Set Value (Setting) |

Skala mengikuti decimal point yang dibaca dari controller (mis. `dp=1` → /10).

Komunikasi terpasang: `9600 8N1`, unit address `1` (terbukti terbaca).

> **Parity default TNL sebenarnya 8N2** (8 data, no parity, 2 stop). 8N1 tetap
> terbaca karena perangkat toleran terhadap stop bit. Jika suatu saat PV
> timeout, ganti `MB_FORMAT` di `modbus_hw.ino` ke `SERIAL_8N2`.
>
> Jika SV terbaca `0`, controller mungkin menaruh SV di input register
> `0x03EB` (FC04) — ubah pembacaan SV di `modbus_hw.ino` sesuai manual unit.

---

## Arsitektur Task (anti kehilangan data)

Logger **tidak boleh kehilangan 1 detik pun**. Karena itu akuisisi data
dipisah dari jaringan:

| Konteks | Core | Tugas |
|---------|------|-------|
| `loggerTask` (prioritas 3) | 1 | Baca Modbus PV/SV + tulis SD, tepat tiap **1000 ms** (`vTaskDelayUntil`) |
| `loop()` Arduino (prioritas 1) | 1 | WiFi, MQTT, web — boleh lambat |
| WiFi/TCP stack | 0 | Internal Espressif |

Karena `loggerTask` berprioritas lebih tinggi, walau `loop()` mandek
(mis. `mqtt.connect()`), pengambilan data **tetap jalan tepat waktu**.

Mitigasi blocking yang sudah diterapkan:

- **MQTT**: `setSocketTimeout(2)` — reconnect ke broker mati maks 2 dtk (bukan 15).
- **Modbus**: raw RTU timeout 150 ms — gagal sekali → pakai nilai terakhir, tak block.
- **Serial USB**: `setTxTimeoutMs(0)` — print tak block walau tak ada host.
- **SD**: semua akses (task vs web) dilindungi mutex `gSdMutex`.
- **RTC/I2C**: hanya dibaca di `loggerTask`; `loop()` pakai cache `gLastTs`.

Start/Stop dari web/MQTT hanya **menaikkan flag** (`gLogStartReq`/`gLogStopReq`);
buka/tutup file CSV dikerjakan `loggerTask` agar seluruh I/O SD satu konteks.

---

## Output CSV

File `/retort/<timestamp>.csv` dengan kolom:

```
Tanggal Jam,Actual,Setting
1/16/2026 5:02:14PM,97.0,121.2
```

Perekaman dimulai saat tombol **Start** (atau MQTT `START`) dan berhenti saat
**Stop**. Tiap sesi membuat file baru.

---

## Library yang Dibutuhkan

Install via Arduino Library Manager:

| Library | Author | Digunakan oleh |
|---------|--------|----------------|
| `ESPAsyncWebServer` + `AsyncTCP` | ESP32Async | web server (async) |
| `PubSubClient` | knolleary | mqtt_client.ino |
| `ArduinoJson` | bblanchon | mqtt_client.ino / web |
| `RTClib` | Adafruit | rtc_hw.ino (`USE_RTC=true`) |
| `ArduinoOTA` | Built-in | ota_update.ino (`USE_OTA=true`) |
| `SD` | Built-in | sd_logger.ino (`USE_SD=true`) |

> `ModbusMaster` **tidak lagi dibutuhkan** — Modbus RTU ditulis manual (raw)
> di `modbus_hw.ino` agar timeout bisa dipangkas pendek.

---

## Konfigurasi Board (Arduino IDE)

- **Board**: `ESP32S3 Dev Module`
- **Flash Mode**: `QIO`
- **Flash Size**: `4MB`
- **PSRAM**: Sesuai modul
- **USB Mode**: `Hardware CDC and JTAG`

Untuk sementara dengan **ESP32 DevKit** gunakan board `ESP32 Dev Module`.

---

## Konfigurasi via Captive Portal

1. Hubungkan ke WiFi `RetortLogger-Config` (AP terbuka)
2. Browser otomatis diarahkan ke halaman login
3. Login (default `RT-001` / `retort123`) → buka **Settings**
4. Isi SSID, password WiFi, broker MQTT, dan parameter
5. Simpan (restart otomatis jika WiFi/MQTT berubah)

---

## Mulai / Berhenti Perekaman

Lewat dashboard (**Start** / **Stop**) atau MQTT:

```
Topic : retort/cmd
Payload: START   (mulai rekam CSV baru)
```

Perintah lain: `STOP` (tutup file), `STATUS` (publish state).

Pada mode hardware, suhu (PV) dan setpoint (SV) selalu dibaca dari controller
TNL; tombol Start/Stop hanya mengontrol sesi perekaman ke SD card.

---

## Integrasi MQTT (End-to-End)

Alur data lengkap ESP32 → database:

```
ESP32 (publish tiap 2 dtk)
   │  topic: retort/data
   ▼
Mosquitto MQTT (broker, port 1883)
   │
   ▼
mqtt_bridge.py  (subscribe retort/data → HTTP POST)
   │
   ▼
Laravel  POST /api/sensor  (header token)
   ▼
PostgreSQL  (tabel sensor_readings)
```

### Payload yang dipublish ESP (`retort/data`)

```json
{
  "id": "RT-001",
  "ts": "6/27/2026 12:05:30AM",
  "phase": "HOLDING",
  "actual": 121.3,
  "setting": 121.0,
  "logging": true
}
```

| Field ESP | Tipe | Keterangan |
|-----------|------|------------|
| `id` | string | Nomor mesin (= `machine_code` di Laravel, default `RT-001`) |
| `ts` | string | Timestamp dari RTC |
| `phase` | string | `IDLE` / `HEATING` / `HOLDING` / `COOLING` |
| `actual` | float | PV (suhu aktual) dari TNL |
| `setting` | float | SV (setpoint) dari TNL |
| `logging` | bool | `true` saat sesi perekaman aktif |

### Pemetaan oleh `mqtt_bridge.py` → `/api/sensor`

| API Laravel | Sumber dari payload ESP |
|-------------|-------------------------|
| `machine_code` | `id` |
| `temperature` | `actual` |
| `sv` | `setting` |
| `pressure` | `pressure` (TNL tak punya → `0`) |
| `process_status` | `logging ? "logging" : phase.lower()` |

> `machine_code` **wajib sudah ada** di tabel `retort_machines` (default seeder
> `RT-001`), jika tidak API balas `422`.

### Kredensial & topic (harus sama dengan VPS)

Set di `config.ino` sebelum flash:

```cpp
#define MQTT_USER       "retort_esp"
#define MQTT_PASS       "<password dari deploy.sh>"
#define MQTT_PUB_TOPIC  "retort/data"
#define MQTT_CMD_TOPIC  "retort/cmd"
```

Broker & Port diisi lewat halaman **Settings** (disimpan di NVS).

### Perintah dari Laravel (`retort/cmd`)

Tombol Start/Stop di dashboard web Laravel memanggil `MqttCommandService` →
publish `START:RT-001` / `STOP:RT-001`. ESP hanya merespons jika kode mesin
cocok dengan `id`-nya, lalu memulai/berhenti merekam.

---

## Catatan Perubahan UI Web (Responsive)

Semua halaman web embedded (Login, Dashboard, Settings, Log, Storage) dibuat
responsive agar nyaman dibuka dari HP maupun desktop, tetap ringan untuk ESP32-S3
(CSS inline di dalam `<style>`, tanpa file/library eksternal).

- Reset `*{box-sizing:border-box}` agar padding tidak merusak lebar elemen.
- Layout sidebar fleksibel: nav 160px di desktop, otomatis menjadi top bar
  (`flex-direction:column`) pada layar ≤ 640px.
- Input form `font-size:16px` untuk mencegah auto-zoom di iOS; tombol & target
  sentuh diperbesar (padding lebih tinggi) agar ramah layar sentuh.
- Tabel (Log & Storage) dibungkus `.tw{overflow-x:auto}` + `min-width` sehingga
  bisa di-scroll horizontal tanpa merusak layout di layar sempit.
- Kartu status dashboard memakai grid `auto-fill` + `clamp()` pada ukuran font
  nilai agar menyesuaikan lebar layar.
- Tombol form (Login/Settings) full-width di mobile, kembali `auto` di desktop.
- Modal hapus (Storage) diberi padding & lebar adaptif (`max-width` + `width:100%`).

Tidak ada perubahan logika/endpoint; murni penyesuaian markup & CSS tampilan.
