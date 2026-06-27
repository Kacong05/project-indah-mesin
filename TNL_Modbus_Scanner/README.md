# TNL Modbus Scanner

Sketch Arduino **standalone** untuk memindai alamat Modbus RTU Autonics TNL dan
memverifikasi trigger **DI-1** (terminal 18–21 / kontak selenoid retort).

Tidak mengubah firmware `RetortLogger/`. Flash sketch ini saat uji wiring saja,
lalu flash kembali RetortLogger untuk operasi normal.

---

## Hardware

Sama dengan RetortLogger:

| Fungsi | GPIO |
|--------|------|
| RS485 RX | 16 |
| RS485 TX | 15 |
| RS485 DE | −1 (auto-direction) |

Wiring TNL: terminal **13 → A+**, **14 → B−** (tukar jika tidak ada respons).

---

## Cara pakai

1. Arduino IDE → buka folder `TNL_Modbus_Scanner/TNL_Modbus_Scanner.ino`
2. Board: ESP32 Dev Module (atau ESP32-S3 sesuai board Anda)
3. Upload
4. Serial Monitor **115200 baud**
5. Saat boot: scan otomatis semua range
6. Setiap **2 detik**: poll live — pasang/lepas jumper 18–21, amati perubahan

---

## Alamat yang dipindai

| Fokus | FC | PDU | Modbus addr | Keterangan |
|-------|-----|-----|-------------|------------|
| **DI-1 (trigger)** | 02 | `0x0023` | **10036** | 0=terbuka, 1=tertutup (jumper/selenoid) |
| RUN/STOP | 03 | `0x0000` | 40001 | 0=RUN, 1=STOP |
| Heating MV | 04 | `0x03EC` | 31001 | 0–1000 = 0–100,0% |
| DI status (alt) | 04 | `0x03F1` | 31058 | bit0 = DI-1 |
| Pattern (P) | 04 | `0x03FB` | 31020 | Pattern aktif 1–10 |
| Step (S) | 04 | `0x03FC` | 31021 | Step aktif 1–20 |
| TOT | 04 | `0x03FD` | 31022 | `Program_Process_Time` |
| STP (sisa) | 04 | `0x03FF` | 31024 | `Program_Rest_Time` |
| STEP_TIM_1 | 03 | `0x00CD` | 40206 | Durasi step 1 (pattern) |

---

## Interpretasi hasil

| Output live | Arti |
|-------------|------|
| `DI-1 ... ON (jumper tertutup)` | Kontak 18–21 OK, sama seperti selenoid nanti |
| `DI-1 ... OFF (jumper terbuka)` | Kontak terbuka |
| `ESP trigger (RUN\|\|MV>0) -> AKTIF` | RetortLogger **akan** mulai rekam (produksi) |
| Semua `FAIL` | Cek RS485, baud, slave ID, tukar A+/B− |

> **Catatan:** RetortLogger mulai rekam saat **MV > 0**, berhenti saat **STOP + MV=0**.
> DI-1 (18–21) hanya interlock di panel TNL — MV harus naik saat kontak tertutup.

---

## Konfigurasi

Edit bagian atas `.ino` jika perlu:

```cpp
#define MB_SLAVE   1      // unit address TNL
#define MB_BAUD    9600   // coba SERIAL_8N2 jika gagal
```

---

## Setelah uji

Flash kembali `RetortLogger/RetortLogger.ino` untuk operasi logger penuh.
