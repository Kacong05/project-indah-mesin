# RetortLogger

**RetortLogger** adalah sistem pencatat data proses retort industri berbasis perangkat **ESP32-S3**. Perangkat membaca suhu dan status dari controller Autonics TNL, merekam data ke kartu MicroSD, serta mengirim data ke server melalui MQTT. Pengguna mengakses antarmuka web langsung dari perangkat melalui WiFi untuk memantau status, mengatur konfigurasi, dan mengunduh log CSV.

---

# Daftar Isi

- [1. Pendahuluan](#1-pendahuluan)
- [2. Persyaratan](#2-persyaratan)
- [3. Login](#3-login)
- [4. Dashboard](#4-dashboard)
- [5. Penjelasan Menu](#5-penjelasan-menu)
  - [5.1 Dashboard](#51-dashboard)
  - [5.2 Settings](#52-settings)
  - [5.3 Log & Storage](#53-log--storage)
  - [5.4 Logout](#54-logout)
- [6. Langkah Penggunaan](#6-langkah-penggunaan)
- [7. Penjelasan Tombol](#7-penjelasan-tombol)
- [8. Pesan Error](#8-pesan-error)
- [9. FAQ](#9-faq)
- [10. Troubleshooting](#10-troubleshooting)
- [11. Penutup](#11-penutup)

---

# 1. Pendahuluan

## Tujuan Aplikasi

RetortLogger dirancang untuk:

- Merekam data suhu proses retort secara otomatis ke kartu MicroSD.
- Mengirim data sensor ke server pusat melalui MQTT.
- Memantau status perangkat (WiFi, MQTT, SD card, fase proses) secara real-time.
- Menyediakan antarmuka web ringan yang dapat diakses dari HP maupun komputer di lokasi pabrik.

## Fungsi Utama

- Pembacaan suhu aktual (PV) dan setpoint (SV) dari controller Autonics TNL via Modbus RTU.
- Perekaman otomatis ke file CSV saat proses retort aktif (MV > 0 atau saklar DI-1 ON).
- Dashboard monitoring dengan pembaruan otomatis setiap 2 detik.
- Pengaturan WiFi dan identitas mesin melalui halaman Settings.
- Penjelajahan, unduh, dan hapus file log dari kartu SD.

## Target Pengguna

- Operator retort di lini produksi.
- Supervisor/teknisi yang memantau proses sterilisasi.
- Tim maintenance yang mengonfigurasi koneksi WiFi dan identitas perangkat.

---

# 2. Persyaratan

## Perangkat Keras

- Modul ESP32-S3 IoT Logger dengan firmware RetortLogger terpasang.
- Kartu MicroSD (untuk perekaman log).
- Controller Autonics TNL-P46RR-RS-035 terhubung via RS485.
- Akses WiFi router pabrik (atau koneksi langsung ke AP perangkat saat konfigurasi awal).

## Perangkat Lunak / Akses

| Persyaratan | Keterangan |
| ----------- | ---------- |
| Browser | Chrome, Firefox, Safari, atau Edge versi terbaru |
| Koneksi WiFi | Terhubung ke router pabrik **atau** ke hotspot `RetortLogger-Config` |
| Koneksi internet | Diperlukan agar data terkirim ke server MQTT (bukan wajib untuk akses web lokal) |
| Hak akses | Nomor mesin dan password login yang valid |

## Kredensial Default

| Field | Nilai Default |
| ----- | ------------- |
| Nomor Mesin | `RT-001` |
| Password | `retort123` |

> **Penting:** Ubah password default setelah instalasi pertama melalui menu Settings.

---

# 3. Login

## Cara Membuka Aplikasi

### A. Akses via Hotspot Konfigurasi (Pertama Kali / WiFi Belum Dikonfigurasi)

1. Nyalakan perangkat RetortLogger.
2. Di HP atau laptop, buka daftar WiFi.
3. Sambungkan ke jaringan **`RetortLogger-Config`** (hotspot terbuka, tanpa password).
4. Browser akan otomatis membuka halaman login (captive portal). Jika tidak, buka alamat `http://192.168.4.1`.

### B. Akses via Jaringan Pabrik (Setelah WiFi Dikonfigurasi)

1. Pastikan perangkat sudah terhubung ke WiFi router pabrik.
2. Buka browser dan akses alamat IP perangkat di jaringan lokal (contoh: `http://192.168.x.x`).
3. Anda akan diarahkan ke halaman login.

## Mengisi Form Login

1. Isi field **Nomor Mesin** sesuai identitas mesin (default: `RT-001`).
2. Isi field **Password** (default: `retort123`).
3. Klik tombol **Login**.

> 📷 Screenshot: Halaman Login

## Setelah Login

- Anda diarahkan ke halaman **Dashboard**.
- Sesi login berlaku selama **8 jam** sejak aktivitas terakhir.
- Setelah sesi habis, Anda harus login kembali.

---

# 4. Dashboard

Dashboard adalah halaman utama setelah login. Data diperbarui otomatis setiap **2 detik**.

## Komponen Dashboard

### Panel Jam & Tanggal

| Elemen | Keterangan |
| ------ | ---------- |
| Waktu | Jam saat ini (format 24 jam, zona WIB jika NTP tersinkron) |
| Tanggal | Tanggal hari ini |
| Log | Timestamp terakhir data tercatat |
| Peringatan RTC | Muncul jika modul RTC tidak terdeteksi |
| Indikator NTP | Tampil `● NTP WIB` jika waktu sudah disinkronkan via internet |

### Panel Suhu Utama

| Elemen | Keterangan |
| ------ | ---------- |
| Suhu besar | Suhu aktual (PV) dari controller TNL, dalam °C |
| Bar indikator | Visualisasi level suhu (hijau normal, oranye perhatian, merah di atas rentang) |
| Setting | Setpoint (SV) suhu dari controller |
| Fase | Status fase proses: `IDLE`, `HEATING`, `HOLDING`, `COOLING` |
| Status rekam | `● REC` saat sedang merekam, `RUN` saat proses jalan tanpa rekam, `idle` saat diam |

### Kartu Status

| Kartu | Keterangan | Indikator |
| ----- | ---------- | --------- |
| **WiFi** | Status koneksi ke router | `OK` (hijau) / `OFF` (merah) |
| **MQTT** | Status koneksi ke broker MQTT | `OK` (hijau) / `OFF` (merah) |
| **Status** | Fase proses saat ini | Warna oranye saat sedang rekam |
| **Output MV** | Persentase output kontrol (heating/cooling) | Oranye jika MV > 0 |
| **SD Card** | Status kartu MicroSD | `OK` (hijau) / `N/A` (merah) |
| **P/S** | Pattern dan Step controller TNL (contoh: `2-01`) | — |
| **TOT M:S** | Total waktu proses pattern (menit:detik) | — |
| **STP M:S** | Sisa waktu step aktif (menit:detik) | — |

### Kartu Opsional (Mode Pengembangan)

Kartu berikut hanya muncul jika firmware diaktifkan dengan flag khusus:

| Kartu | Keterangan |
| ----- | ---------- |
| **MV Simulasi** | Tombol nyalakan/matikan simulasi MV 50% (hanya untuk uji, bukan produksi) |
| **Saklar DI TNL** | Status input digital DI-1 dari controller TNL |

### Pesan Petunjuk (Hint)

Di bagian bawah dashboard, pesan teks muncul jika ada masalah koneksi:

- WiFi gagal terhubung (SSID tidak ditemukan, password salah, dll.).
- MQTT gagal terhubung ke broker.

> 📷 Screenshot: Dashboard

---

# 5. Penjelasan Menu

Navigasi sidebar (atau bar atas di layar HP) terdiri dari empat menu:

- Dashboard
- Settings
- Log & Storage
- Logout

---

## 5.1 Dashboard

Halaman monitoring real-time proses retort.

**Fungsi:**

- Menampilkan suhu aktual, setpoint, dan fase proses.
- Memantau status koneksi WiFi, MQTT, dan SD card.
- Menampilkan output MV dan informasi pattern/step dari controller TNL.
- Memperbarui data otomatis tanpa perlu refresh manual.

**Cara menggunakan:**

1. Buka menu **Dashboard** (halaman default setelah login).
2. Amati kartu status untuk memastikan WiFi, MQTT, dan SD card berstatus OK.
3. Perhatikan indikator `● REC` — muncul saat perangkat sedang merekam data ke SD card.
4. Jika ada pesan peringatan di bawah, ikuti petunjuk (misalnya isi ulang WiFi di Settings).

> 📷 Screenshot: Dashboard

---

## 5.2 Settings

Halaman konfigurasi perangkat.

### Bagian WiFi

| Field | Keterangan |
| ----- | ---------- |
| SSID | Nama jaringan WiFi router pabrik |
| Password | Password WiFi (wajib diisi ulang setiap kali menyimpan) |

### Bagian MQTT

Informasi broker MQTT ditampilkan sebagai **baca saja** (contoh: `82.153.226.85:1883`). Pengaturan broker, port, username, password, dan topic MQTT diatur di firmware (`config.ino`) dan memerlukan re-flash untuk diubah.

### Bagian Identity

| Field | Keterangan |
| ----- | ---------- |
| Nomor Mesin | Identitas unik mesin (contoh: `RT-001`) |
| Password Login Baru | Password baru untuk login web (minimal 6 karakter) |

**Cara menyimpan:**

1. Isi field yang ingin diubah.
2. Klik tombol **Simpan**.
3. Perangkat akan restart otomatis dalam beberapa detik.
4. Login kembali setelah restart selesai.

> 📷 Screenshot: Pengaturan (Settings)

---

## 5.3 Log & Storage

Halaman gabungan untuk melihat, mengunduh, dan mengelola file log CSV di kartu MicroSD.

### Informasi Kapasitas

Di bagian atas ditampilkan:

- **Used** — kapasitas terpakai
- **Free** — kapasitas kosong
- **Total** — kapasitas total SD card

### Daftar File

| Kolom | Keterangan |
| ----- | ---------- |
| Tanggal Jam | Waktu mulai sesi perekaman (format `DD-MM-YYYY HH:MM:SS`) |
| Size | Ukuran file |
| Aksi | Tombol unduh (DL) dan hapus (Del) |

File log terbaru ditandai dengan label **TERBARU** dan baris berwarna biru muda.

### Navigasi Folder

- Klik nama folder (ikon 📁) untuk masuk ke subfolder.
- Klik breadcrumb path di atas tabel untuk kembali ke folder induk.

**Cara menggunakan:**

1. Buka menu **Log & Storage**.
2. Tunggu daftar file dimuat (folder default: `/retort`).
3. Klik **Download CSV Terbaru** untuk mengunduh file log paling baru.
4. Atau klik **DL** pada baris file tertentu untuk mengunduh file spesifik.
5. Klik **Del** untuk menghapus file — konfirmasi akan muncul sebelum penghapusan.

> 📷 Screenshot: Log & Storage

---

## 5.4 Logout

Mengakhiri sesi login dan kembali ke halaman login.

**Cara menggunakan:**

1. Klik menu **Logout** di sidebar.
2. Anda diarahkan ke halaman login.
3. Sesi di browser dihapus — login ulang diperlukan untuk akses berikutnya.

---

# 6. Langkah Penggunaan

## 6.1 Konfigurasi Awal Perangkat

1. Nyalakan perangkat RetortLogger.
2. Sambungkan HP/laptop ke WiFi **`RetortLogger-Config`**.
3. Browser akan membuka halaman login otomatis.
4. Login dengan kredensial default (`RT-001` / `retort123`).
5. Buka menu **Settings**.
6. Isi **SSID** dan **Password** WiFi router pabrik.
7. Ubah **Nomor Mesin** dan **Password Login Baru** sesuai kebutuhan.
8. Klik **Simpan** — perangkat restart otomatis.
9. Setelah restart, sambungkan HP/laptop ke WiFi router pabrik.
10. Akses alamat IP perangkat di jaringan lokal dan login kembali.

> 📷 Screenshot: Settings — Pengisian WiFi

## 6.2 Memantau Proses Retort

1. Login ke dashboard.
2. Pastikan kartu **WiFi**, **MQTT**, dan **SD Card** menampilkan status OK.
3. Jalankan proses retort di controller TNL (RUN + MV aktif).
4. Perangkat otomatis mulai merekam saat **MV > 0** atau **saklar DI-1 ON**.
5. Amati indikator `● REC` dan fase proses (`HEATING` → `HOLDING` → `COOLING`).
6. Setelah proses selesai (MV = 0 dan DI-1 OFF), perekaman berhenti otomatis (~5 detik debounce).

> 📷 Screenshot: Dashboard — Status REC Aktif

## 6.3 Mengunduh Log CSV

### Unduh Log Terbaru

1. Buka menu **Log & Storage**.
2. Klik tombol **Download CSV Terbaru**.
3. File CSV akan diunduh ke perangkat Anda.

### Unduh File Tertentu

1. Buka menu **Log & Storage**.
2. Cari file di daftar (file terbaru ada di atas).
3. Klik tombol **DL** pada baris file yang diinginkan.
4. File CSV tersimpan di folder unduhan browser.

> 📷 Screenshot: Log & Storage — Daftar File CSV

## 6.4 Menghapus File Log

1. Buka menu **Log & Storage**.
2. Klik tombol **Del** pada file yang ingin dihapus.
3. Dialog konfirmasi muncul — baca nama file dengan teliti.
4. Klik **Hapus** untuk konfirmasi, atau **Batal** untuk membatalkan.
5. Daftar file diperbarui otomatis.

> 📷 Screenshot: Dialog Konfirmasi Hapus File

## 6.5 Mengubah Password Login

1. Buka menu **Settings**.
2. Isi field **Password Login Baru** (minimal 6 karakter).
3. Klik **Simpan**.
4. Perangkat restart — login dengan password baru setelah restart.

---

# 7. Penjelasan Tombol

| Tombol | Lokasi | Fungsi |
| ------ | ------ | ------ |
| **Login** | Halaman Login | Memvalidasi kredensial dan masuk ke dashboard |
| **Simpan** | Settings | Menyimpan konfigurasi WiFi dan identitas mesin, lalu restart perangkat |
| **Download CSV Terbaru** | Log & Storage | Mengunduh file log CSV paling baru dari SD card |
| **DL** | Log & Storage (per baris) | Mengunduh file CSV tertentu |
| **Del** | Log & Storage (per baris) | Menghapus file CSV (dengan konfirmasi) |
| **Hapus** | Dialog konfirmasi | Mengonfirmasi penghapusan file |
| **Batal** | Dialog konfirmasi | Membatalkan penghapusan file |
| **Nyalakan Simulasi MV** | Dashboard (mode dev) | Memaksa MV 50% untuk uji pipeline (bukan produksi) |
| **Matikan Simulasi MV** | Dashboard (mode dev) | Menonaktifkan simulasi MV |
| **Logout** | Sidebar | Mengakhiri sesi dan kembali ke halaman login |

---

# 8. Pesan Error

## Halaman Login

| Pesan | Penyebab | Solusi |
| ----- | -------- | ------ |
| `ID/password salah` | Nomor mesin atau password tidak cocok | Periksa kembali kredensial. Reset via Settings jika lupa password |
| `Missing fields` | Field login kosong | Isi Nomor Mesin dan Password |
| `Error koneksi` | Browser tidak dapat terhubung ke perangkat | Pastikan terhubung ke WiFi yang benar (hotspot atau router) |

## Dashboard

| Pesan / Indikator | Penyebab | Solusi |
| ----------------- | -------- | ------ |
| WiFi `OFF` | Perangkat tidak terhubung ke router | Isi SSID dan password WiFi di Settings |
| `SSID tidak ketemu` | Nama WiFi salah | Periksa ejaan SSID di Settings |
| `Password WiFi salah` | Password WiFi tidak valid | Isi ulang password WiFi yang benar di Settings |
| `Tidak ada AP` | Router WiFi tidak ditemukan | Pastikan router aktif dan dalam jangkauan |
| MQTT `OFF` | Koneksi ke broker MQTT gagal | Periksa koneksi internet router. Hubungi admin untuk cek broker |
| `Broker tidak terjangkau` | Broker MQTT tidak dapat diakses | Pastikan router terhubung internet dan broker aktif |
| `User MQTT salah` | Kredensial MQTT tidak valid | Hubungi admin — pengaturan MQTT di firmware |
| `MQTT tidak diizinkan` | Autentikasi MQTT ditolak | Hubungi admin untuk verifikasi kredensial MQTT |
| SD Card `N/A` | Kartu MicroSD tidak terdeteksi | Periksa kartu SD terpasang dengan benar |
| `RTC tidak terdeteksi` | Modul RTC DS3231M tidak terbaca | Periksa koneksi hardware RTC |
| `Menunggu ESP (Modbus/WiFi sibuk)...` | Perangkat sibuk membaca sensor | Tunggu beberapa detik, data akan muncul otomatis |

## Log & Storage

| Pesan | Penyebab | Solusi |
| ----- | -------- | ------ |
| `SD Card tidak tersedia.` | Kartu SD tidak terdeteksi atau rusak | Periksa kartu SD, coba kartu lain |
| `SD sibuk, coba lagi…` | SD card sedang digunakan (rekam/unduh) | Tunggu beberapa detik, halaman akan refresh otomatis |
| `Memuat daftar file…` | Sedang membaca direktori SD | Tunggu hingga daftar muncul |

## Settings

| Pesan | Penyebab | Solusi |
| ----- | -------- | ------ |
| `Tersimpan. Restart...` | Konfigurasi berhasil disimpan | Tunggu perangkat restart, lalu login kembali |
| `Error` | Gagal menyimpan konfigurasi | Coba lagi. Pastikan sesi login masih aktif |

---

# 9. FAQ

### Apakah perekaman data perlu dinyalakan manual?

Tidak. Perekaman **otomatis** dimulai saat output MV > 0 atau saklar DI-1 pada controller TNL aktif. Perekaman berhenti otomatis saat MV = 0 dan DI-1 OFF selama 5 detik berturut-turut.

### Di mana data log disimpan?

Data disimpan sebagai file CSV di kartu MicroSD, folder `/retort/`. Format nama file: `YYYYMMDD_HHMMSS.csv`.

### Apakah saya perlu internet untuk menggunakan dashboard?

Tidak selalu. Dashboard web dapat diakses via jaringan lokal (WiFi router atau hotspot perangkat). Namun, koneksi internet diperlukan agar data terkirim ke server MQTT dan waktu disinkronkan via NTP.

### Berapa lama sesi login berlaku?

Sesi login berlaku **8 jam** sejak aktivitas terakhir. Setelah itu, Anda harus login kembali.

### Bisakah saya mengubah pengaturan MQTT dari web?

Tidak. Pengaturan broker MQTT (alamat, port, username, password, topic) diatur di firmware (`config.ino`) dan memerlukan re-flash perangkat untuk diubah. Halaman Settings hanya menampilkan informasi broker sebagai referensi.

### Apa arti fase HEATING, HOLDING, COOLING, IDLE?

| Fase | Arti |
| ---- | ---- |
| `IDLE` | Proses tidak aktif, suhu rendah |
| `HEATING` | Suhu sedang naik menuju setpoint |
| `HOLDING` | Suhu stabil di setpoint (fase sterilisasi) |
| `COOLING` | Suhu sedang turun setelah holding |

### Apa format isi file CSV?

```
Tanggal Jam,Actual,Setting,ISO,Phase,MV,Run,Logging
```

Contoh baris:

```
1/16/2026 5:02:14PM,97.0,121.2,2026-01-16T17:02:14+07:00,HOLDING,50.0,1,1
```

### Apakah ada tombol Start/Stop proses di dashboard?

Tidak. Kontrol proses retort dilakukan di controller TNL (panel fisik). Dashboard hanya memantau dan merekam data secara otomatis.

---

# 10. Troubleshooting

## Tidak Bisa Login

**Gejala:** Pesan `ID/password salah` atau halaman tidak terbuka.

**Solusi:**

1. Pastikan Nomor Mesin dan Password benar (default: `RT-001` / `retort123`).
2. Pastikan HP/laptop terhubung ke WiFi yang sama dengan perangkat.
3. Jika lupa password, hubungi teknisi untuk reset via firmware atau NVS.
4. Coba akses via hotspot `RetortLogger-Config` jika WiFi router bermasalah.

## Data Tidak Muncul di Dashboard

**Gejala:** Suhu menampilkan `--°C`, semua kartu kosong.

**Solusi:**

1. Tunggu beberapa detik — pesan `Menunggu ESP...` normal saat Modbus sibuk.
2. Periksa koneksi RS485 antara ESP32 dan controller TNL.
3. Pastikan controller TNL dalam status RUN.
4. Refresh halaman atau logout-login kembali.

## Dashboard Kosong / Tidak Terupdate

**Gejala:** Data tidak berubah, angka statis.

**Solusi:**

1. Periksa koneksi WiFi perangkat (kartu WiFi harus `OK`).
2. Refresh halaman browser.
3. Clear cache browser dan login ulang.
4. Restart perangkat ESP32 (matikan-hidupkan daya).

## WiFi Tidak Terhubung

**Gejala:** Kartu WiFi menampilkan `OFF`, pesan error SSID/password.

**Solusi:**

1. Sambungkan ke hotspot `RetortLogger-Config`.
2. Login dan buka Settings.
3. Isi ulang SSID dan Password WiFi dengan benar.
4. Klik Simpan — perangkat restart dan mencoba koneksi ulang.
5. Pastikan router WiFi aktif dan sinyal cukup kuat.

## MQTT Tidak Terhubung

**Gejala:** Kartu MQTT menampilkan `OFF`.

**Solusi:**

1. Pastikan WiFi sudah terhubung (`OK`).
2. Pastikan router memiliki akses internet.
3. Hubungi administrator server untuk verifikasi status broker MQTT.
4. Pengaturan MQTT hanya dapat diubah via re-flash firmware.

## SD Card Tidak Terdeteksi

**Gejala:** Kartu SD Card menampilkan `N/A`, halaman Log & Storage menampilkan peringatan.

**Solusi:**

1. Matikan perangkat, lepas dan pasang kembali kartu MicroSD.
2. Pastikan kartu SD diformat FAT32.
3. Coba kartu SD lain untuk mengisolasi masalah hardware.
4. Periksa slot SD card pada modul ESP32.

## Gagal Mengunduh Log

**Gejala:** Unduhan tidak dimulai atau error 404/503.

**Solusi:**

1. Pastikan SD Card status `OK` di dashboard.
2. Pastikan file CSV ada di daftar Log & Storage.
3. Pastikan sesi login masih aktif (login ulang jika perlu).
4. Coba unduh file lain untuk memastikan masalah spesifik pada satu file.

## Perekaman Tidak Dimulai

**Gejala:** Proses retort jalan tapi indikator `● REC` tidak muncul.

**Solusi:**

1. Pastikan output MV > 0 di controller TNL (heating/cooling aktif).
2. Atau pastikan saklar DI-1 (terminal 18–21) dalam kondisi ON.
3. Pastikan SD Card status `OK`.
4. Periksa koneksi Modbus RS485 ke controller TNL.

---

# 11. Penutup

RetortLogger adalah alat bantu pencatatan dan monitoring proses retort yang dirancang untuk operasi industri. Dengan perekaman otomatis, dashboard real-time, dan manajemen log via web, operator dapat memantau proses sterilisasi tanpa intervensi manual.

Untuk pertanyaan teknis lebih lanjut terkait hardware, firmware, atau integrasi MQTT, hubungi tim maintenance atau administrator sistem.

---

*Dokumen ini dibuat berdasarkan firmware RetortLogger (ESP32-S3). Versi terakhir diperbarui: Juni 2026.*
