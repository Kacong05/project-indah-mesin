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
#define USE_MV_SIMULATION false  // default produksi — MV asli dari TNL
#define USE_TNL_DI_TRIGGER false // jangan dipakai produksi
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
(150 ms) agar tidak pernah mem-block siklus 1 detik. **Satu transaksi**
Read Input Registers (FC04) membaca blok kontigu `0x03E8`–`0x03ED`:

| Index | Register | Isi |
|-------|----------|-----|
| 0 | `0x03E8` | Present Value (PV / Actual) |
| 1 | `0x03E9` | Decimal point (skala otomatis) |
| 2 | `0x03EA` | Display unit |
| 3 | `0x03EB` | **Set Value (SV / Setting) — LIVE dari controller** |
| 4 | `0x03EC` | **Heating MV** (`0..1000` = `0..100.0%`) |
| 5 | `0x03ED` | **Cooling MV** (`0..1000` = `0..100.0%`) |

PV dan SV memakai skala decimal point yang sama (mis. `dp=1` → /10).
MV memakai skala tetap (`raw / 10 = %`). `state.mv` = MV terbesar (heating/cooling).

Transaksi ketiga: **status RUN/STOP** FC03 holding `0x0000` (`0=RUN`, `1=STOP`).

> SV live read-only ada di input register `0x03EB` (FC04), bukan di `0x0000`.

Komunikasi terpasang: `9600 8N1`, unit address `1` (terbukti terbaca).

> **Parity default TNL sebenarnya 8N2** (8 data, no parity, 2 stop). 8N1 tetap
> terbaca karena perangkat toleran terhadap stop bit. Jika suatu saat PV
> timeout, ganti `MB_FORMAT` di `modbus_hw.ino` ke `SERIAL_8N2`.

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

## Store-and-Forward MQTT (anti kehilangan data saat jaringan putus)

Flag: `USE_STORE_FORWARD` (default `true`) di `RetortLogger.ino`. Modul: `mqtt_forward.ino`.

**Masalah:** publish MQTT biasa hanya mengirim *state saat ini*. Bila WiFi/MQTT
putus 2 menit, 2 menit data **tidak pernah sampai ke database** (walau aman di SD).

**Solusi:** MQTT mengirim **dari log SD**, bukan dari RAM:

1. Tiap baris CSV sudah berisi `ISO` (timestamp asli) + `Phase`, `MV`, `Run`, `Logging`.
2. Forwarder menyimpan **offset byte "sudah terkirim"** per file di NVS.
3. **Tersambung & caught-up** → kirim baris terbaru (live, 1 detik).
4. **Putus** → offset diam, backlog menumpuk di SD.
5. **Reconnect** → kirim backlog cepat (≤30 baris/detik) dengan **timestamp asli**
   sampai mengejar live. `mqtt_bridge.py` meneruskan `iso` → `recorded_at`, jadi
   data susulan masuk ke **sesi & urutan waktu yang benar** (bukan menumpuk di
   waktu reconnect).
6. **Idle** (tak ada proses & sudah caught-up) → kirim heartbeat status agar mesin
   tetap terdeteksi ONLINE. Saat sedang logging, heartbeat ditahan agar tak ada
   reading ganda berstempel waktu server.

Tahan **reboot**: offset di NVS, jadi baris yang belum terkirim sebelum mati listrik
tetap dikirim setelah nyala kembali.

**Batas yang diketahui:**
- Gate API hanya menyimpan saat `MV > 0` (idle/ambient sengaja tak disimpan). Saat
  fase holding MV bisa 0 sesaat → baris itu di-*drop* server (perilaku eksisting).
  Gunakan **Simulasi MV** saat testing agar semua baris tersimpan.
- Rotasi file di 5 MB (~puluhan jam) meninggalkan sisa file lama yang belum
  terkirim; sangat jarang pada operasi normal.
- Resume setelah crash bisa mengirim ulang ≤10 baris terakhir (interval simpan
  offset) → kemungkinan duplikat kecil; dipilih demi **tidak ada data hilang**.

---

## Output CSV

File `/retort/YYYYMMDD_HHMMSS.csv` (nama = waktu mulai sesi, 24 jam). Format ini
**sortable** (urut leksikografis = kronologis) sehingga halaman *Log & Storage*
bisa menampilkan **file terbaru di atas** cukup dengan sort desc, dan nama file
ditampilkan rapi sebagai `DD-MM-YYYY HH:MM:SS`. Isi kolom:

```
Tanggal Jam,Actual,Setting,ISO,Phase,MV,Run,Logging
1/16/2026 5:02:14PM,97.0,121.2,2026-01-16T17:02:14+07:00,HOLDING,50.0,1,1
```

> Kolom **Tanggal Jam** (12 jam, `M/D/YYYY h:mm:ssPM`) + **Actual** + **Setting**
> dipertahankan agar cocok dengan laporan Indah Mesin & pembaca lama. Kolom
> tambahan (`ISO`, `Phase`, `MV`, `Run`, `Logging`) dipakai **store-and-forward
> MQTT** untuk merekonstruksi payload identik dengan publish live (termasuk
> `recorded_at` dari `ISO`). Yang berubah pada nama file hanya formatnya.

Tiap sesi perekaman membuat file baru (lihat *auto-trigger* di atas).

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

## Mulai / Berhenti Perekaman — Auto-Trigger

Perekaman **otomatis** mengikuti kondisi controller (tanpa tombol manual).
Alur (lihat diagram *trigger logic flow*):

1. **Monitor** — PV, SV, MV, status RUN/STOP terus dibaca tiap 1 detik. Data
   pra-proses (suhu ambient, status STOP) **tidak** direkam ke sesi.
2. **Trigger aktif** — saat **katup terbuka** (`status RUN` **atau** `MV > 0`),
   firmware membuka sesi CSV baru (timestamp mulai = nama file) dan mulai rekam.
3. **Loop rekam** — PV/SV/MV ditulis ke SD tiap 1 detik selama proses jalan.
4. **Proses selesai** — saat `status STOP` **dan** `MV = 0` (di-*debounce*
   `STOP_DEBOUNCE_N` detik agar output PID sesaat 0 saat holding tidak
   menghentikan rekaman), sesi di-*flush* dan file ditutup. Siap proses berikut.

Logika OR (`RUN || MV>0`) memastikan rekaman tetap jalan selama status RUN walau
MV PID sesaat 0; berhenti hanya bila benar-benar STOP + MV 0.

Konstanta di `modbus_hw.ino`:

```cpp
#define USE_AUTO_TRIGGER true  // false = kembali ke mode manual (MQTT START/STOP)
#define MV_ON_RAW        0     // MV raw > nilai ini → output aktif (katup terbuka)
#define STOP_DEBOUNCE_N  5     // detik non-aktif berturut sebelum tutup sesi
```

PV/SV selalu dibaca dari TNL. Bila `USE_AUTO_TRIGGER false`, perekaman kembali
dikontrol manual via MQTT:

```
Topic : retort/cmd
Payload: START | STOP | STATUS
```

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
  "iso": "2026-06-27T00:05:30+07:00",
  "phase": "HOLDING",
  "actual": 121.3,
  "setting": 121.0,
  "mv": 42.5,
  "run": true,
  "logging": true
}
```

| Field ESP | Tipe | Keterangan |
|-----------|------|------------|
| `id` | string | Nomor mesin (= `machine_code` di Laravel, default `RT-001`) |
| `ts` | string | Timestamp RTC (12 jam, untuk tampilan) |
| `iso` | string | Timestamp ISO-8601 + offset WIB → dipetakan ke `recorded_at` (store-and-forward) |
| `phase` | string | `IDLE` / `HEATING` / `HOLDING` / `COOLING` |
| `actual` | float | PV (suhu aktual) dari TNL |
| `setting` | float | SV (setpoint) dari TNL |
| `mv` | float | Output kontrol (%) — Heating/Cooling MV terbesar |
| `run` | bool | Status controller (`true` = RUN, `false` = STOP) |
| `logging` | bool | `true` saat sesi perekaman aktif (auto-trigger) |

### MV & trigger — satu jalur (uji lab = retort sungguhan)

**Default firmware** (`USE_MV_SIMULATION false`, `USE_TNL_DI_TRIGGER false`):

| Sumber | Register Modbus | Dipakai untuk |
|--------|-----------------|---------------|
| **MV** | FC04 `0x03EC` / `0x03ED` | Laporan MQTT/API + gate simpan database (MV > 0) |
| **RUN** | FC03 `0x0000` | Rekam SD tetap jalan walau MV sesaat 0 saat holding |

Tidak ada “trigger palsu” di ESP. **Yang dibaca dan dilaporkan selalu MV asli dari TNL.**

#### Uji dengan saklar di TNL (tanpa reflash ESP)

Agar uji **mirip retort masuk**, saklar/proses harus membuat **register MV TNL naik** — sama seperti saat katup uap retort sungguhan terbuka:

1. TNL mode **RUN** (bukan STOP di layar).
2. Saat uji: mode **Manual (MAN)** → set **Heating MV** > 0 (mis. 50,0%) saat saklar ditutup / proses dimulai.  
   Saat produksi: biarkan **PID Auto** — MV naik sendiri saat heating.
3. ESP otomatis deteksi MV > 0 → rekam SD + kirim web. **Tidak perlu ubah firmware** saat pindah ke retort live.

Saklar di terminal TNL (DI-1, interlock retort, dll.) hanya perlu **mengaktifkan proses/MV di controller** — bukan input terpisah ke ESP.

Spesifikasi kontak DI (manual TCD210227AH): ON ≤ 2 kΩ, OFF ≥ 90 kΩ.  
Setting **Digital Input Func = OFF** jika DI hanya interlock mekanik; jika DI dipakai start RUN, sesuaikan parameter TNL sekali di panel (bukan di ESP).

#### Dev only (jangan dipakai produksi)

Hanya jika MV TNL tetap 0 dan Anda tetap ingin uji pipeline web:

```cpp
#define USE_MV_SIMULATION true   // dashboard paksa MV 50%
```

Reflash diperlukan. **Jangan** dipakai saat retort sungguhan sudah terpasang.

### Pemetaan oleh `mqtt_bridge.py` → `/api/sensor`

| API Laravel | Sumber dari payload ESP |
|-------------|-------------------------|
| `machine_code` | `id` |
| `temperature` | `actual` |
| `sv` | `setting` |
| `pressure` | `pressure` (TNL tak punya → `0`) |
| `process_status` | fase asli bila bermakna (`heating`/`holding`/`sterilizing`/`cooling`); selain itu `logging ? "logging" : phase` |
| `recorded_at` | `iso` (fallback `ts`) — timestamp asli ESP, kunci akurasi store-and-forward |

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
