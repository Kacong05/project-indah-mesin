# Industrial Retort Logger

## AP Mode

SSID : RetortLogger-Config



Gunakan captive portal.

Semua request browser diarahkan ke ESP32.

---

## Login

Halaman pertama adalah login.

Field:

* Nomor Mesin
* Password

Default:

Nomor Mesin : RT-001

Password : retort123

Simpan pada Preferences (NVS).

Password disimpan menggunakan SHA256.

Gunakan session authentication.

Auto logout 10 menit.

Semua route harus membutuhkan login.

Sediakan tombol logout.

---

## Dashboard

Informasi:

* WiFi status
* MQTT status
* Current phase
* Temperature
* Pressure
* SD card status

Tombol:

* Start Process
* Stop Process
* Restart ESP32

Update otomatis setiap 2 detik menggunakan AJAX/fetch.

---

## Settings

### WiFi

* SSID
* Password

### MQTT

* Broker address
* Port
* Username
* Password
* Publish topic
* Command topic

### Parameter Retort

* Target temperature
* Holding time
* Heating rate
* Cooling rate

### Machine Identity

* Nomor mesin
* Password login

Semua data disimpan di Preferences.

Validasi input.

Restart hanya jika diperlukan.

---

## Log

Menampilkan seluruh file CSV dalam SD card.

Tampilkan:

* Nama file
* Ukuran file
* Tanggal

Tombol:

* Download

Tambahkan:

* Download log terbaru

Download menggunakan HTTP.

Jika SD card tidak tersedia tampilkan pesan peringatan.

---

## Storage

Menampilkan seluruh file dan folder dalam SD card.

Fitur:

* Download file
* Hapus file
* Konfirmasi sebelum menghapus
* Kapasitas terpakai
* Kapasitas kosong

---

## Keamanan

* Session authentication
* Semua route protected
* Endpoint download protected
* Auto logout 10 menit
* Password SHA256
* Hindari plaintext
* Non-blocking

---

## Library

* ESPAsyncWebServer
* AsyncTCP
* Preferences
* ArduinoJson
* SD
* WiFi
* DNSServer

---

## Struktur File

RetortLogger.ino

config.ino

wifi_ap.ino

mqtt_client.ino

retort_sim.ino

modbus_hw.ino

rtc_hw.ino

sd_logger.ino

ota_update.ino

web_auth.ino

web_dashboard.ino

web_settings.ino

web_logs.ino

web_storage.ino

---

## UI

Dark mode.

Sidebar:

* Dashboard
* Settings
* Log
* Storage
* Logout

Gunakan HTML + CSS + JavaScript dalam PROGMEM atau LittleFS.

Responsif.

---

## Standar Kode

Production ready.

Tanpa pseudocode.

Tanpa placeholder.

Hemat RAM.

Non-blocking.

Mudah dikembangkan.

Kerjakan satu file setiap kali diminta.
