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
#define USE_FAKE_SENSOR true   // Gunakan sensor simulasi
#define USE_MODBUS      false  // RS485 Modbus RTU
#define USE_RTC         false  // DS3231M RTC
#define USE_SD          false  // MicroSD logging
#define USE_OTA         false  // OTA update
```

Saat hardware final datang: ubah flag ke `true`, tidak ada perubahan arsitektur.

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

1. Hubungkan ke WiFi `RetortLogger-Config` (password: `retort123`)
2. Buka browser → otomatis redirect ke halaman konfigurasi
3. Isi SSID, password WiFi, broker MQTT, dan parameter proses
4. Klik **Save & Restart**

---

## Memulai Proses Retort

Kirim perintah MQTT ke topic command:

```
Topic : retort/cmd
Payload: START
```

Perintah lain: `STOP`, `STATUS`, `REPLAY`

---

## Alur Fase Simulasi

```
IDLE → HEATING (1.5°C/s) → HOLDING (20 menit @ 121°C) → COOLING (0.8°C/s) → IDLE
```
