# Retort Monitor - Web Monitoring Mesin Retort Berbasis IoT

Aplikasi berbasis web untuk memantau suhu dan tekanan pada mesin retort sterilisasi makanan secara real-time. Proyek ini dibangun dengan framework **Laravel** (Backend), **Inertia.js & React** (Frontend), dan **Tailwind CSS** (Styling).

---

## 🛠️ Tech Stack & Dependencies

*   **Backend Framework**: [Laravel 11](https://laravel.com) (PHP >= 8.2)
*   **Frontend Library**: [React 18](https://reactjs.org) & [Inertia.js](https://inertiajs.com)
*   **CSS Framework**: [Tailwind CSS v4](https://tailwindcss.com)
*   **Visualisasi Grafik**: [Chart.js](https://www.chartjs.org) & [react-chartjs-2](https://react-chartjs-2.js.org)
*   **Ekspor Data**: [ExcelJS](https://github.com/exceljs/exceljs) & [file-saver](https://github.com/eligrey/FileSaver.js)
*   **Simulasi Sensor (Client IoT)**: Python 3 dengan pustaka `requests`

---

## 📋 Fitur Utama Aplikasi

Aplikasi ini memiliki sistem otentikasi dan otorisasi berbasis peran (**Role-Based Access Control / RBAC**) yang membagi akses menjadi dua peranan utama: **Admin** dan **Operator**.

### 1. Peran Operator (Operator Area)
*   **Dashboard Pemantauan Real-time**:
    *   **Live Reloading**: Melakukan sinkronisasi data sensor secara otomatis setiap 2 detik tanpa *refresh* halaman.
    *   **Gauge Suhu Interaktif**: Visualisasi radial/doughnut suhu terkini dengan indikator warna dinamis sesuai status (Merah: Bahaya/Kritis, Hijau: Rentang Target Normal 121°C ± 5°C, Jingga: Fase Pemanasan, Abu-abu: Offline/Dingin).
    *   **Grafik Suhu Real-time**: Grafik garis tren suhu dalam 24 pembacaan terakhir.
    *   **Status Koneksi IoT**: Deteksi apakah mesin *Online* atau *Offline* berdasarkan detak jantung (*heartbeat*) sensor (< 1 menit).
    *   **Statistik Harian**: Menampilkan jumlah data yang masuk hari ini, kecepatan transfer data (interval dalam milidetik), dan jumlah alarm terpicu hari ini.
    *   **Notifikasi Alarm Toast**: Alarm aktif akan muncul secara langsung berupa popup *toast* melayang di pojok kanan atas.
    *   **Log Aktivitas Terbaru**: Menampilkan log 5 aktivitas terakhir operator bersangkutan.
*   **Riwayat Data & Grafik Historis**:
    *   Melihat tabel riwayat pembacaan sensor lengkap dengan penanda status suhu dan status sinkronisasi.
    *   Filter data berdasarkan **Rentang Tanggal** (Mulai & Selesai).
    *   **Ekspor Excel (.xlsx)**: Mengunduh data historis ke file Excel menggunakan *ExcelJS*. Fitur istimewa di sini adalah **menyematkan visualisasi grafik tren suhu langsung ke dalam sheet Excel** berupa gambar PNG base64.
*   **Manajemen Alarm & Notifikasi**:
    *   Menampilkan daftar alarm abnormal yang terjadi pada mesin retort bersangkutan.
    *   Filter alarm berdasarkan status (`active`, `acknowledged`, `resolved`).
    *   Fitur **Tandai Dibaca (Acknowledge)** untuk satu atau semua alarm secara sekaligus sebagai bukti konfirmasi operator.

### 2. Peran Administrator (Admin Area)
*   **Manajemen Pengguna (CRUD Pengguna)**:
    *   Membuat, mengubah, mencari, dan menghapus akun pengguna (Admin atau Operator).
    *   **Auto-Provisioning Mesin**: Saat membuat/memperbarui pengguna dengan peran Operator, Admin dapat menuliskan kode mesin (*machine code*). Jika mesin dengan kode tersebut belum ada di database, sistem secara otomatis akan membuat record mesin retort baru.

### 3. Detektor & Logika Alarm Cerdas (Smart Alarm Logic)
Sistem memiliki detektor anomali suhu sterilisasi retort dengan target normal **121.0°C** dan batas toleransi **±5.0°C** (Rentang aman: 116.0°C s.d 126.0°C):
*   **Fase Warm-up Safe-skip**: Sistem mendeteksi apabila mesin masih dalam fase pemanasan awal (suhu belum pernah mencapai batas warm-up 100°C), sehingga alarm "suhu terlalu rendah" tidak akan terpicu secara salah (*false alarm*).
*   **Auto-Trigger Alarm**:
    *   Suhu melebihi 126.0°C -> Peringatan Suhu Tinggi (`high_temperature`), menjadi tingkat *Kritis* jika melebihi 131.0°C.
    *   Suhu di bawah 116.0°C (setelah fase pemanasan) -> Peringatan Suhu Rendah (`low_temperature`).
*   **Auto-Resolve Alarm**: Ketika suhu kembali masuk dalam rentang normal (116°C s.d 126°C), alarm aktif terkait akan otomatis ditandai sebagai *Resolved* oleh sistem.

### 4. Logger Aktivitas Pengguna (Audit Trail)
Mencatat setiap aksi penting pengguna seperti login, logout, penambahan/pengubahan data, ekspor riwayat sensor, dan konfirmasi alarm untuk audit keamanan dan produktivitas.

### 5. Simulator Mesin IoT (Client Simulator)
Terdapat file `worker.py` yang ditulis dalam bahasa Python untuk mensimulasikan pengiriman data sensor dari perangkat keras ke server lokal melalui REST API:
*   Menerima input kode mesin yang ingin disimulasikan.
*   Mengirimkan payload JSON berisi `machine_code`, `temperature`, `pressure`, dan `process_status` setiap 5 detik sekali ke endpoint `/api/sensor`.

---

## 🚀 Cara Menjalankan Project

### 1. Prasyarat (Prerequisites)
Pastikan Anda sudah menginstal:
*   PHP >= 8.2
*   Composer
*   Node.js & NPM
*   Python 3 (opsional, untuk menjalankan simulator sensor)
*   Laragon / XAMPP (untuk database MySQL)

### 2. Instalasi Dependensi
Jalankan perintah berikut di direktori proyek:
```bash
# Instal dependensi backend PHP
composer install

# Instal dependensi frontend Node.js
npm install
```

### 3. Konfigurasi Environment & Migrasi Database
1.  Salin file `.env.example` menjadi `.env` dan atur konfigurasi database Anda.
2.  Jalankan migrasi database dan pengisian data sampel (*seeder*):
    ```bash
    php artisan migrate --seed
    ```
    *Seeder akan membuat akun bawaan:*
    *   **Administrator**: `admin@retort.com` | Password: `password`
    *   **Operator**: `operator@retort.com` | Password: `password` (terhubung ke mesin `RT-001`)

### 4. Jalankan Aplikasi
Jalankan server backend Laravel dan compiler aset Vite secara bersamaan:
```bash
# Terminal 1: Menjalankan Laravel server
php artisan serve

# Terminal 2: Menjalankan Vite Development server
npm run dev
```
Buka peramban (browser) dan akses alamat `http://127.0.0.1:8000`.

### 5. Menjalankan Simulator IoT (Worker)
Untuk melihat data bergerak secara real-time pada dashboard operator:
1.  Pastikan dependensi Python terpasang (jika belum): `pip install requests`
2.  Jalankan script simulator:
    ```bash
    python worker.py
    ```
3.  Masukkan kode mesin yang disimulasikan (misal: `RT-001` untuk mesin bawaan operator, atau buat kode mesin baru).

