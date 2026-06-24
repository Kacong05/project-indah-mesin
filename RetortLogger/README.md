# RetortLogger

Firmware untuk **Industrial Retort Logger** berbasis ESP32-S3.

Ditulis dalam Arduino IDE (.ino, multi-tab).  
Dirancang agar semua modul hardware dapat diaktifkan hanya dengan mengubah satu baris `#define`.

---

## Struktur File

| File | Isi |
|------|-----|
| `RetortLogger.ino` | Entry point, feature flags, `setup()`, `loop()` |
| `config.ino` | Preferences (NVS) load/save |
| `wifi_ap.ino` | AP mode, captive portal, STA connect |
| `mqtt_client.ino` | MQTT publish, subscribe, command handler |
| `retort_sim.ino` | Simulasi heating/holding/cooling |
| `modbus_hw.ino` | RS485 Modbus RTU (nonaktif default) |
| `rtc_hw.ino` | DS3231M RTC (nonaktif default) |
| `sd_logger.ino` | MicroSD CSV log + replay (nonaktif default) |
| `ota_update.ino` | OTA firmware update (nonaktif default) |

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
| RS485 (Serial1) RX / TX | 15 / 16 |
| MicroSD CS / MOSI / CLK / MISO | 10 / 11 / 12 / 13 |

> Catatan RS485: jika tidak ada komunikasi, tukar RX↔TX (15↔16).

---

## Sumber Data (Autonics TNL-P46RR-RS-035)

Dibaca via **Read Input Registers (FC04)** dalam satu transaksi:

| Register | Isi |
|----------|-----|
| `0x03E8` | Present Value (PV / Actual) |
| `0x03E9` | Decimal point (skala otomatis) |
| `0x03EA` | Display unit |
| `0x03EB` | Set Value (SV / Setting) |

Komunikasi default: `9600 8N1`, unit address `1` — samakan dengan setting
parameter komunikasi pada controller.

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
| `PubSubClient` | knolleary | mqtt_client.ino |
| `ModbusMaster` | Doc Walker | modbus_hw.ino (`USE_MODBUS=true`) |
| `RTClib` | Adafruit | rtc_hw.ino (`USE_RTC=true`) |
| `ArduinoOTA` | Built-in | ota_update.ino (`USE_OTA=true`) |
| `SD` | Built-in | sd_logger.ino (`USE_SD=true`) |

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
3. Login (default `RETORT-001` / `retort123`) → buka **Settings**
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
