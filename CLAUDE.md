# Perhitungan Nilai F₀ pada Validasi Proses Retort

## Definisi

F₀ adalah nilai sterilitas ekuivalen yang menyatakan jumlah efek letal panas yang setara dengan pemanasan pada:

- Suhu referensi (Tref) = 121,1 °C
- z-value = 10 °C

Satuan F₀ adalah **menit ekuivalen pada 121,1 °C**.

---

# 1. Lethality Rate

Untuk setiap suhu produk yang diukur pada coldest spot:

\[
L(T)=10^{\frac{T-T_{ref}}{z}}
\]

Dimana:

- \(L(T)\) = lethality rate
- \(T\) = suhu aktual produk (°C)
- \(T_{ref}\) = 121,1 °C
- \(z\) = 10 °C

---

## Contoh

Jika suhu produk:

\[
T=121°C
\]

maka:

\[
L=10^{\frac{121-121.1}{10}}
\]

\[
L=0.977
\]

Artinya:

1 menit pada 121°C memberikan efek letal sebesar:

\[
0.977 \text{ menit F₀}
\]

---

# 2. Perhitungan F₀ dari Data Time Series

Jika logger merekam suhu setiap interval waktu tetap:

\[
\Delta t
\]

maka F₀ dihitung dengan integrasi numerik.

Metode yang direkomendasikan:

## Trapezoidal Method

\[
F_0=
\sum_{i=2}^{n}
\left(
\frac{
L_{i-1}+L_i
}{2}
\right)
\times
\Delta t
\]

dengan:

\[
L_i=10^{\frac{T_i-T_{ref}}{z}}
\]

sehingga:

\[
F_0=
\sum_{i=2}^{n}
\left(
\frac{
10^{\frac{T_{i-1}-T_{ref}}{z}}
+
10^{\frac{T_i-T_{ref}}{z}}
}{2}
\right)
\times
\Delta t
\]

---

# 3. Jika Data Direkam Setiap 1 Detik

Karena F₀ menggunakan satuan menit:

\[
\Delta t=\frac{1}{60}
\]

maka:

\[
F_0=
\sum_{i=2}^{n}
\left(
\frac{
10^{\frac{T_{i-1}-121.1}{10}}
+
10^{\frac{T_i-121.1}{10}}
}{2}
\right)
\times
\frac{1}{60}
\]

---

# 4. Jika Data Direkam Setiap 5 Detik

\[
\Delta t=\frac{5}{60}
\]

maka:

\[
F_0=
\sum_{i=2}^{n}
\left(
\frac{
10^{\frac{T_{i-1}-121.1}{10}}
+
10^{\frac{T_i-121.1}{10}}
}{2}
\right)
\times
\frac{5}{60}
\]

---

# 5. Jika Data Direkam Setiap 10 Detik

\[
\Delta t=\frac{10}{60}
\]

maka:

\[
F_0=
\sum_{i=2}^{n}
\left(
\frac{
10^{\frac{T_{i-1}-121.1}{10}}
+
10^{\frac{T_i-121.1}{10}}
}{2}
\right)
\times
\frac{10}{60}
\]

---

# 6. Implementasi Pseudocode

```text
F0 = 0

for setiap pasangan suhu berurutan:

    L_prev = 10^((T_prev - 121.1)/10)

    L_curr = 10^((T_curr - 121.1)/10)

    F0 += ((L_prev + L_curr)/2) * dt

hasil = F0
```

---

# 7. Interpretasi

Contoh:

Target:

\[
F_0 = 6
\]

Hasil perhitungan:

\[
F_0 = 7.92
\]

Karena:

\[
7.92 \ge 6
\]

maka:

**PASS**

Proses sterilisasi memenuhi target letalitas.

---

# Catatan Penting

1. Data suhu harus berasal dari **coldest spot produk**.
2. Suhu chamber retort tidak boleh digunakan sebagai pengganti suhu produk.
3. Interval sampling harus diketahui (1 detik, 5 detik, 10 detik, dst).
4. Tanpa informasi interval waktu, F₀ tidak dapat dihitung secara valid.
5. Untuk validasi proses retort komersial, metode trapezoidal lebih disarankan dibanding metode rectangular sederhana.