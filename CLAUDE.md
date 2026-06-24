Halo Claude, saya butuh bantuan untuk merancang logika pengelompokan data riwayat sensor (history) berdasarkan "Proses" atau sesi, pada project web saya yang menggunakan **Laravel (Backend)** dan **React Inertia.js (Frontend)**.

### Konteks Sistem:
1. Perangkat ESP membaca data sensor dan menyimpannya terlebih dahulu ke SD Card lengkap dengan `timestamp` dari modul RTC di perangkat.
2. Data dikirim ke server/database web menggunakan `timestamp` perangkat. Hal ini untuk mengantisipasi data telat terkirim karena jaringan lambat, sehingga waktu datanya tetap valid sesuai kejadian aslinya.

### Tujuan:
Saya ingin di halaman *History*, datanya dipisahkan berdasarkan masing-masing proses produksi.
Contoh di Frontend nanti tampilannya berupa daftar proses seperti ini:
- **Proses 1:** 17.00 - 17.18
- **Proses 2:** 17.30 - 17.46
*(Jika pengguna mengklik "Proses 1", maka UI akan memunculkan tabel/grafik data yang terekam pada rentang waktu 17.00 - 17.18).*

### Logika yang Saya Inginkan:
Mesin tidak terus-terusan menyala. Jika selisih waktu (`timestamp`) antara data yang baru dikirim oleh ESP dengan data terakhir sebelumnya memiliki jeda yang cukup jauh (misal beda 10 atau 15 menit), maka data baru tersebut diasumsikan sudah masuk ke "Proses" yang baru.

### Pertanyaan & Bantuan yang Saya Butuhkan:
1. **Sisi Database / Backend (Laravel):**
   - Pendekatan mana yang lebih baik: Apakah mengelompokkannya secara *dinamis* saat query (dengan melihat selisih timestamp) menggunakan fungsi SQL/Collection? ATAU membuat kolom `process_id` (sebagai penanda sesi) di database lalu men-generate ID baru saat mendeteksi jeda waktu saat data *insert*?
   - Tolong buatkan logika algoritma atau contoh kode di Controller/Model Laravel-nya.
2. **Sisi Frontend (React.js / Inertia):**
   - Bagaimana cara menyusun UI dan *state management* agar saya bisa me-render *list* proses tersebut, dan memunculkan detail data historisnya ketika proses tertentu di-klik?
   - Berikan contoh struktur komponen UI-nya.

Tolong jelaskan secara perlahan dan berikan contoh kodenya!
