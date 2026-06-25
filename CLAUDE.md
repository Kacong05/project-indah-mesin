# Prompt: Perubahan Layout Dashboard Retort Monitoring

Berikut adalah instruksi perubahan yang perlu dilakukan pada file `resources/js/Pages/Dashboard.jsx` di project Laravel + Inertia + React ini.

---

## Konteks Project

- **Framework**: Laravel + InertiaJS + React (Vite)
- **Styling**: Tailwind CSS (dark mode, glassmorphism)
- **File utama**: `resources/js/Pages/Dashboard.jsx`
- **Komponen 3D**: `resources/js/Components/RetortModel.jsx` (dirender via `@react-three/fiber` + `@react-three/drei`)
- **Komponen monitoring**: `resources/js/Components/MonitoringPanel.jsx`
- **Chart library**: `react-chartjs-2` + `chart.js`

---

## Perubahan yang Diminta

### 1. Grafik Suhu — Lebih Panjang dan Lebih Banyak Data

**Lokasi di file**: Sekitar baris 503–515, bagian `{/* Charts + 3D Model Row */}`.

**Perubahan yang harus dilakukan:**

#### a) Perbesar tinggi grafik
Di dalam div grafik (line chart), ubah class `h-72` menjadi `h-96` atau lebih besar (misal `h-[420px]`) agar grafik terlihat lebih tinggi dan mudah dibaca:

```jsx
// SEBELUM:
<div className="h-72 w-full">

// SESUDAH:
<div className="h-[420px] w-full">
```

#### b) Perbanyak jumlah data point di grafik
Data grafik berasal dari `chartData` yang dikirim dari controller Laravel. Di backend (`app/Http/Controllers/DashboardController.php`), cari query yang mengambil data chart dan **ubah limit dari yang saat ini** (biasanya 20–30 record terakhir) menjadi **100 atau lebih** record terakhir. Contoh:

```php
// SEBELUM (di DashboardController atau sejenisnya):
->latest()->limit(20)->get()

// SESUDAH:
->latest()->limit(100)->get()
```

> **Catatan**: Pastikan label X-axis (waktu) tetap terbaca. Jika terlalu padat, aktifkan opsi `maxTicksLimit` di konfigurasi chart:
```js
scales: {
    x: {
        grid: { display: false },
        ticks: {
            color: '#94a3b8',
            maxTicksLimit: 12,  // ← tambahkan ini agar label tidak tumpang tindih
            maxRotation: 45,
            minRotation: 0,
        }
    }
}
```

---

### 2. Pindahkan Model 3D — ke Bawah Samping Kanan Monitoring Panel

**Perubahan besar pada struktur layout.** Saat ini layout-nya:

```
[Grafik Suhu (2/3 lebar)] [Model 3D (1/3 lebar)]   ← baris pertama
[Monitoring Panel (full width)]                      ← baris kedua
```

**Layout baru yang diinginkan:**

```
[Grafik Suhu (full width)]                           ← baris pertama (grafik lebih lebar)
[Monitoring Panel (2/3 atau 3/4 lebar)] [Model 3D (1/3 atau 1/4 lebar)]  ← baris kedua
```

**Cara implementasinya — edit bagian layout di `Dashboard.jsx`:**

```jsx
{/* ── SEBELUM (hapus/ganti seluruh blok ini) ── */}
{/* Charts + 3D Model Row */}
<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
    {/* Line Chart */}
    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg lg:col-span-2">
        <h3 className="text-lg font-medium text-white mb-4">Grafik Suhu</h3>
        <div className="h-72 w-full">
            <Line data={lineChartData} options={lineChartOptions} />
        </div>
    </div>

    {/* 3D Retort Model Card */}
    <Retort3DCard temperature={currentTemp} processStatus={processStatus} />
</div>

{/* Monitoring Panel - Full Width */}
<div className="grid grid-cols-1 lg:grid-cols-1">
    <MonitoringPanel
        pv={stats.currentTemperature}
        sv={stats.sv}
        mv={stats.mv}
        status={processStatus === 'running' ? 'running' : processStatus === 'error' ? 'alarm' : 'stop'}
        processStep={stats.processStep}
        timerTot={stats.timerTot}
        timerStp={stats.timerStp}
        timerRem={stats.timerRem}
        isOnline={stats.isOnline}
    />
</div>
```

```jsx
{/* ── SESUDAH (ganti dengan layout baru ini) ── */}

{/* Grafik Suhu — Full Width */}
<div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
    <h3 className="text-lg font-medium text-white mb-4">Grafik Suhu</h3>
    <div className="h-[420px] w-full">
        <Line data={lineChartData} options={lineChartOptions} />
    </div>
</div>

{/* Monitoring Panel + Model 3D (side by side) */}
<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

    {/* Monitoring Panel — 2/3 lebar */}
    <div className="lg:col-span-2">
        <MonitoringPanel
            pv={stats.currentTemperature}
            sv={stats.sv}
            mv={stats.mv}
            status={processStatus === 'running' ? 'running' : processStatus === 'error' ? 'alarm' : 'stop'}
            processStep={stats.processStep}
            timerTot={stats.timerTot}
            timerStp={stats.timerStp}
            timerRem={stats.timerRem}
            isOnline={stats.isOnline}
        />
    </div>

    {/* Model 3D — 1/3 lebar, di sebelah kanan monitoring panel */}
    <div className="lg:col-span-1">
        <Retort3DCard temperature={currentTemp} processStatus={processStatus} />
    </div>

</div>
```

---

## Ringkasan Perubahan

| # | Komponen | Perubahan |
|---|----------|-----------|
| 1 | Grafik Suhu | Tinggi diubah dari `h-72` → `h-[420px]` |
| 2 | Grafik Suhu | Limit data di backend dinaikkan ke 100 record |
| 3 | Grafik Suhu | Tambahkan `maxTicksLimit: 12` di konfigurasi X-axis |
| 4 | Layout | Grafik dilepas dari grid 3-kolom, dijadikan full width sendiri |
| 5 | Layout | Monitoring Panel + Model 3D dijadikan satu baris grid baru |
| 6 | Model 3D | Dipindahkan ke kolom kanan (1/3 lebar) berdampingan dengan Monitoring Panel |

---

## File yang Perlu Diedit

1. `resources/js/Pages/Dashboard.jsx` — perubahan layout & tinggi grafik
2. `app/Http/Controllers/DashboardController.php` (atau controller yang relevan) — naikkan limit data chart

---

## Catatan Tambahan

- Pastikan `MonitoringPanel` tetap memiliki `h-full` agar tingginya menyesuaikan model 3D di sebelahnya.
- `Retort3DCard` sudah memiliki `minHeight: 340` — itu sudah cukup, tidak perlu diubah.
- Setelah perubahan, jalankan `npm run dev` dan reload browser untuk melihat hasilnya.
