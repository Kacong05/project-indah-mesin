# F₀ Calculation Module

## Tujuan

Membuat modul untuk menghitung nilai **F₀ (Sterilization Value)** berdasarkan data suhu terhadap waktu pada titik **Coldest Spot**.

Modul ini digunakan sebagai validator apakah proses sterilisasi telah memenuhi target F₀.

---

# Input

## Informasi Produk

- Product Name
- Packaging Type
- Sterilization Temperature
- Coldest Spot
- Target F₀
- z-value
- Reference Temperature

---

## Data Suhu

Input berupa pasangan waktu dan suhu.

Contoh:

| Time (Minute) | Temperature (°C) |
|---------------|------------------|
| 0 | 30 |
| 1 | 55 |
| 2 | 80 |
| 3 | 105 |
| 4 | 118 |
| 5 | 121 |
| 6 | 121 |
| 7 | 121 |
| 8 | 121 |
| 9 | 121 |
| 10 | 121 |
| 11 | 121 |
| 12 | 118 |
| 13 | 110 |
| 14 | 95 |

---

# Validasi Input

Sebelum melakukan perhitungan lakukan validasi berikut:

## Waktu

- Tidak boleh kosong
- Harus berupa angka
- Harus meningkat
- Tidak boleh ada nilai duplikat

Contoh benar:

0
1
2
3
4

Contoh salah:

0
1
1
3
4

---

## Suhu

- Tidak boleh kosong
- Harus berupa angka
- Boleh naik
- Boleh turun
- Boleh tetap

---

## Parameter

Target F₀ harus lebih besar dari 0.

z-value harus lebih besar dari 0.

Reference Temperature harus lebih besar dari 0.

---

# Rumus

Hitung nilai lethal rate setiap titik menggunakan rumus:

L = 10^((T - Tref) / z)

Keterangan:

- L = Lethal Rate
- T = Temperatur saat itu
- Tref = Reference Temperature
- z = z-value

---

# Perhitungan F₀

Gunakan metode Trapezoidal Rule.

Untuk setiap pasangan data:

F₀ += ((L1 + L2) / 2) × Δt

dimana:

- L1 = lethal rate titik pertama
- L2 = lethal rate titik kedua
- Δt = selisih waktu (menit)

Lakukan hingga seluruh data selesai.

---

# Output

Tampilkan informasi berikut.

## F₀ Aktual

Contoh:

7.92

---

## Status

Jika

F₀ Aktual ≥ Target F₀

maka

PASS

Jika

F₀ Aktual < Target F₀

maka

FAIL

---

## Selisih

Hitung

Difference = F₀ Aktual − Target F₀

Contoh

Target F₀

6

F₀ Aktual

7.92

Difference

+1.92

---

# Ringkasan

Tampilkan:

- Product Name
- Coldest Spot
- Target F₀
- Actual F₀
- Difference
- Status

---

# Error Handling

Tampilkan pesan apabila:

- Tidak ada data suhu
- Hanya terdapat satu titik data
- z-value tidak valid
- Reference Temperature tidak valid
- Target F₀ tidak valid
- Waktu tidak berurutan
- Data mengandung nilai kosong

---

# Catatan Implementasi

- Gunakan seluruh data pada Coldest Spot.
- Perhitungan dilakukan menggunakan metode Trapezoidal Rule.
- Interval waktu (Δt) dihitung dari selisih antar waktu sehingga tidak harus selalu 1 menit.
- Hasil F₀ ditampilkan dengan 2 angka di belakang koma.
- Status validator ditentukan berdasarkan perbandingan antara F₀ Aktual dan Target F₀.
- Modul harus mendukung jumlah data suhu yang dinamis (tidak dibatasi jumlah baris).