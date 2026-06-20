# CONFIGURATION.md – RetortLogger

Referensi lengkap semua konfigurasi hardware, software, dan parameter proses.

---

## 1. Pin Hardware

### ESP32-S3 (Board Final)

| Fungsi | GPIO | Keterangan |
|--------|------|------------|
| RS485 TX | 17 | UART1 TX → MAX485 DI |
| RS485 RX | 18 | UART1 RX ← MAX485 RO |
| RS485 DE/RE | 16 | Direction control (HIGH=TX) |
| RTC SDA | 8 | I2C SDA (DS3231M) |
| RTC SCL | 9 | I2C SCL (DS3231M) |
| SD CS | 10 | SPI Chip Select |
| SD MOSI | 11 | SPI MOSI |
| SD CLK | 12 | SPI Clock |
| SD MISO | 13 | SPI MISO |

### ESP32 DevKit (Development / Saat Ini)

Gunakan pin yang sama kecuali I2C default ESP32 (SDA=21, SCL=22).  
Jika berbeda, edit `Wire.begin(SDA, SCL)` di `rtc_hw.ino`.

---

## 2. MQTT Topics

| Variabel | Default | Keterangan |
|----------|---------|------------|
| Publish | `retort/data` | Data sensor dikirim ke sini |
| Command | `retort/cmd` | Perintah diterima dari sini |

Topics dapat diubah via captive portal atau Preferences key `mqtt_pub` / `mqtt_cmd`.

---

## 3. MQTT Payload

### Publish (`retort/data`)

```json
{
  "id":      "retort_A1B2C3",
  "ts":      "2024-06-01 08:30:00",
  "phase":   2,
  "temp":    121.35,
  "sp":      121.00,
  "running": true
}
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `id` | string | Device ID unik (dari MAC address) |
| `ts` | string | Timestamp "YYYY-MM-DD HH:MM:SS" |
| `phase` | int | 0=idle, 1=heating, 2=holding, 3=cooling |
| `temp` | float | Suhu aktual °C |
| `sp` | float | Setpoint fase aktif °C |
| `running` | bool | Status proses |

### Subscribe (`retort/cmd`)

| Payload | Aksi |
|---------|------|
| `START` | Mulai proses retort dari IDLE |
| `STOP` | Hentikan proses |
| `STATUS` | Publish state saat ini segera |
| `REPLAY` | Putar ulang data dari SD card |

---

## 4. Preferences Keys (NVS)

Namespace: `retort`

| Key | Tipe | Default | Keterangan |
|-----|------|---------|------------|
| `wifi_ssid` | String | _(kosong)_ | SSID WiFi |
| `wifi_pass` | String | _(kosong)_ | Password WiFi |
| `mqtt_host` | String | _(kosong)_ | Hostname/IP broker |
| `mqtt_port` | UShort | `1883` | Port broker |
| `mqtt_user` | String | _(kosong)_ | Username MQTT |
| `mqtt_pass` | String | _(kosong)_ | Password MQTT |
| `mqtt_pub` | String | `retort/data` | Topic publish |
| `mqtt_cmd` | String | `retort/cmd` | Topic command |
| `device_id` | String | Auto (MAC) | ID perangkat |
| `sample_ms` | UShort | `1000` | Interval sampling (ms) |
| `heat_sp` | Float | `121.0` | Setpoint pemanasan (°C) |
| `hold_dur` | UInt | `1200000` | Durasi holding (ms = 20 menit) |
| `cool_thr` | Float | `40.0` | Ambang selesai cooling (°C) |

---

## 5. Interval Sampling

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| Default | 1000 ms | 1 sampel/detik |
| Minimum | 100 ms | Batas bawah validasi portal |
| Maksimum | 60000 ms | 1 menit |

Ubah via captive portal field **"Sample interval (ms)"** atau Preferences key `sample_ms`.

---

## 6. Struktur Folder MicroSD

```
/
└── retort/
    ├── 20240601_083000.csv   ← log per sesi (auto-named dari timestamp)
    ├── 20240601_143000.csv
    └── ...
```

### Format CSV

```csv
timestamp,phase,temp_c,setpoint_c,running
2024-06-01 08:30:01,1,35.20,121.00,1
2024-06-01 08:30:02,1,36.70,121.00,1
...
```

- File baru dibuat setiap kali proses dimulai (nama dari timestamp pertama).
- Rotasi otomatis saat file mencapai **5 MB**.
- Replay membaca file terakhir secara alfabetikal.

---

## 7. Modbus Register Map

Sesuaikan `MB_REG_TEMP` di `modbus_hw.ino` dengan register sensor/PLC Anda.

| Register | Alamat | Format | Keterangan |
|----------|--------|--------|------------|
| Suhu | `0x0000` | Uint16 × 0.1 | e.g. `1213` = 121.3°C |

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| Slave ID | `1` | Ubah `MB_SLAVE_ID` |
| Baud rate | `9600` | Ubah `MB_BAUD` |
| Data bits | 8N1 | Fixed |

---

## 8. TODO Implementasi (Saat Hardware Datang)

```
[ ] USE_MODBUS = true
    → Verifikasi alamat register dengan datasheet sensor
    → Sesuaikan MB_SLAVE_ID, MB_BAUD
    → Test dengan ModbusPoll atau modbusmaster GUI

[ ] USE_RTC = true
    → Jika RTC belum tersinkronisasi, sync via NTP dulu lalu tulis ke DS3231M
    → Tambahkan NTP sync sebelum rtcSetup() selesai

[ ] USE_SD = true
    → Format MicroSD FAT32 sebelum pertama kali digunakan
    → Verifikasi CS pin sesuai wiring fisik

[ ] USE_OTA = true
    → WAJIB ganti password OTA dari "retort-ota-change-me"
    → Simpan password di Preferences, bukan hardcode

[ ] USE_FAKE_SENSOR = false
    → Nonaktifkan setelah Modbus berjalan
    → Pastikan USE_MODBUS = true lebih dulu

[ ] NTP Sync (opsional jika RTC digunakan)
    → Tambahkan configTime() setelah WiFi terhubung
    → Tulis hasil NTP ke DS3231M sekali saat boot

[ ] MQTT TLS (opsional)
    → Ganti WiFiClient dengan WiFiClientSecure
    → Muat CA cert dari SPIFFS/LittleFS

[ ] Watchdog Timer
    → Aktifkan esp_task_wdt untuk recovery otomatis saat hang
```
