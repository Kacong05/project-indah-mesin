# RetortLogger — Mockup Screenshot

Halaman simulasi untuk mengambil screenshot manual book. Tampilan meniru antarmuka web embedded firmware RetortLogger (ESP32-S3).

## Cara Membuka

Buka file HTML langsung di browser, atau via server lokal:

```bash
# Dari folder mockup
python -m http.server 8080
# Buka http://localhost:8080/login.html
```

## Halaman

| File | Deskripsi |
| ---- | --------- |
| `login.html` | Halaman login (Nomor Mesin + Password) |
| `dashboard.html` | Dashboard monitoring — suhu, status, timer live |
| `settings.html` | Pengaturan WiFi dan identitas mesin |
| `storage.html` | Log & Storage — daftar CSV, unduh, hapus |
| `storage-delete-modal.html` | Log & Storage dengan dialog hapus terbuka (siap screenshot) |
| `settings-saved.html` | Settings dengan pesan sukses "Tersimpan. Restart..." |

## Screenshot

1. Buka halaman yang diinginkan di browser (disarankan lebar ≥ 1024px untuk tampilan desktop).
2. Tekan tombol **`B`** untuk menyembunyikan banner biru "MOCKUP DOKUMENTASI".
3. Ambil screenshot (Win+Shift+S / Snipping Tool / DevTools capture).
4. Untuk screenshot **dialog hapus file**: buka `storage.html` → klik **Del** pada baris manapun.

## Simulasi Live (Dashboard)

- Jam dan tanggal real-time (WIB).
- Suhu berfluktuasi ~120.6–121.8 °C (fase HOLDING).
- Timer TOT naik, STP turun setiap 2 detik.
- Output MV berubah secara dinamis.

## Catatan

- Tidak ada backend — semua data dummy.
- Hanya mencakup halaman yang ada di firmware RetortLogger (4 halaman + login).
- Desain CSS disalin dari `web_*.ino` agar konsisten dengan perangkat asli.
