// ============================================================
//  ModbusWireTest.ino
//  Tes koneksi RS485 A+ / B- ke Autonics TNL-P46RR-RS-035
//  Mode 2-kabel TANPA GROUND (hanya terminal RS485 A+ dan B- onboard).
//
//  Sketch ini otomatis:
//    1) SNIFFER  — dengar byte mentah di line (tanpa kirim apa pun)
//                  -> kalau ada byte muncul = A/B sudah benar polaritasnya
//    2) SCAN     — coba semua slave ID (1..32) di beberapa baud rate
//                  -> menemukan ID & baud yang benar secara otomatis
//    3) MONITOR  — setelah ketemu, baca PV terus-menerus
//
//  Cara pakai:
//    1. Upload sketch ini (bukan RetortLogger)
//    2. Buka Serial Monitor @ 115200
//    3. Ikuti petunjuk yang tercetak
//
//  Library: ModbusMaster (Doc Walker) via Library Manager
//  Board  : ESP32-S3 IoT Logger RTC RS485 Modbus
// ============================================================

#include <ModbusMaster.h>

// --- Pin RS485 onboard ESP32-S3 IoT Logger (sesuai label casing) ---
#define PIN_RS485_RX  15   // RX2
#define PIN_RS485_TX  16   // TX2
#define PIN_RS485_DE  -1   // tidak diekspos; onboard auto-direction/internal DE

// --- Parameter scan ---
#define TNL_REG_PV    0x03E8   // FC04: PV
#define SCAN_ID_MIN   1
#define SCAN_ID_MAX   32       // naikkan ke 247 untuk scan penuh (lebih lama)
#define PROBE_TIMEOUT_MS 40    // tunggu jawaban tiap probe (40ms cukup utk 9600+)

// Baud rate yang dicoba berurutan (paling umum dulu)
const uint32_t BAUDS[] = { 9600, 19200, 4800, 38400, 57600, 115200 };
const uint8_t  BAUD_N  = sizeof(BAUDS) / sizeof(BAUDS[0]);

// Format data/parity/stop yang dicoba. Autonics TNL sering pakai parity
// (Even/Odd), BUKAN cuma None. Inilah penyebab umum "PC bisa, ESP tidak".
struct SerialFmt { uint32_t cfg; const char* name; };
const SerialFmt FMTS[] = {
  { SERIAL_8N1, "8N1" },
  { SERIAL_8E1, "8E1" },
  { SERIAL_8O1, "8O1" },
  { SERIAL_8N2, "8N2" },
};
const uint8_t FMT_N = sizeof(FMTS) / sizeof(FMTS[0]);

ModbusMaster modbus;

// --- Kandidat pin DE/RE (kontrol arah) untuk auto-deteksi ---
// Banyak board RS485 (SP3485/MAX485) BUTUH GPIO ini digerakkan saat TX.
// -1 = coba mode auto/tanpa DE. Pin RTC(8,9), SD(10-13), UART485(15,16),
// USB(19,20), U0(43,44), strapping(0,3,45,46) sengaja TIDAK dicoba.
const int DE_CANDIDATES[] = { -1, 17, 18, 21, 4, 5, 6, 7, 1, 2, 38, 39, 40, 41, 42, 47, 48 };
const uint8_t DE_N = sizeof(DE_CANDIDATES) / sizeof(DE_CANDIDATES[0]);

// --- Kandidat pasangan UART (TX, RX) untuk transceiver RS485 ---
// Tiap board menaruh transceiver di pin berbeda. Label "TX2/RX2" di casing
// belum tentu = pin internal RS485. Coba yang paling umum lebih dulu.
struct UartPins { int tx; int rx; };
const UartPins UARTS[] = {
  { 16, 15 },  // label board (asumsi awal)
  { 17, 18 },  // SANGAT umum (Waveshare/khurs ESP32-S3 RS485)
  { 18, 17 },
  { 15, 16 },
  { 17, 16 },
  { 16, 17 },
  {  4,  5 },
  {  5,  4 },
};
const uint8_t UART_N = sizeof(UARTS) / sizeof(UARTS[0]);

// Pin UART RS485 aktif (runtime; diubah saat scan).
int gTxPin = PIN_RS485_TX;
int gRxPin = PIN_RS485_RX;
int foundTx = PIN_RS485_TX;
int foundRx = PIN_RS485_RX;

// Pin DE yang sedang aktif (dipakai callback TX/RX). -1 = tanpa kontrol.
int gDePin = -1;

static void deSelect(int pin) {
  gDePin = pin;
  if (pin >= 0) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); }  // default RX
}
static void mbPreTx() {
  if (gDePin >= 0) digitalWrite(gDePin, HIGH);  // mode kirim
}
static void mbPostTx() {
  if (gDePin >= 0) digitalWrite(gDePin, LOW);   // kembali terima
}

// Hasil temuan
bool     found     = false;
uint8_t  foundId   = 0;
uint32_t foundBaud = 0;
uint32_t foundCfg  = SERIAL_8N1;
const char* foundFmtName = "8N1";
int      foundDe   = -1;

static void beginBus(uint32_t baud, uint32_t cfg, uint8_t id) {
  Serial1.begin(baud, cfg, gRxPin, gTxPin);
  modbus.begin(id, Serial1);
  modbus.preTransmission(mbPreTx);
  modbus.postTransmission(mbPostTx);
}

// 1) Dengar byte mentah selama beberapa detik (tanpa mengirim).
//    Autonics TNL hanya bicara jika diminta (master/slave), jadi biasanya
//    senyap. Tapi jika ada device lain / noise, ini membantu deteksi polaritas.
static void sniffRaw(uint32_t baud, uint32_t ms) {
  Serial.printf("\n[SNIFFER] Dengar line @%lu 8N1 selama %lu ms...\n", baud, ms);
  if (gDePin >= 0) digitalWrite(gDePin, LOW);  // paksa mode terima
  Serial1.begin(baud, SERIAL_8N1, gRxPin, gTxPin);
  while (Serial1.available()) Serial1.read();  // buang sisa

  uint32_t start = millis();
  uint32_t count = 0;
  while (millis() - start < ms) {
    if (Serial1.available()) {
      uint8_t b = Serial1.read();
      Serial.printf("%02X ", b);
      if ((++count % 16) == 0) Serial.println();
    }
  }
  Serial.println();
  if (count == 0) {
    Serial.println(F("[SNIFFER] 0 byte. Wajar untuk TNL (diam sampai diminta)."));
  } else {
    Serial.printf("[SNIFFER] %lu byte terdengar -> polaritas A/B kemungkinan OK.\n", count);
  }
}

// CRC16 Modbus (poly 0xA001).
static uint16_t crc16(const uint8_t* buf, uint8_t len) {
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= buf[i];
    for (uint8_t b = 0; b < 8; b++) {
      if (crc & 1) { crc >>= 1; crc ^= 0xA001; }
      else         { crc >>= 1; }
    }
  }
  return crc;
}

// Probe RTU mentah: kirim FC04 baca 1 register, tunggu jawaban singkat.
// Jauh lebih cepat dari ModbusMaster (timeout default 2 dtk). Return:
//   2 = device menjawab data benar, 1 = menjawab exception (BUS OK), 0 = diam.
static uint8_t probeRaw(uint8_t id, int16_t* pvOut) {
  uint8_t req[8];
  req[0] = id;
  req[1] = 0x04;
  req[2] = (TNL_REG_PV >> 8) & 0xFF;
  req[3] = TNL_REG_PV & 0xFF;
  req[4] = 0x00;
  req[5] = 0x01;
  uint16_t c = crc16(req, 6);
  req[6] = c & 0xFF;
  req[7] = (c >> 8) & 0xFF;

  while (Serial1.available()) Serial1.read();  // buang sisa
  mbPreTx();
  Serial1.write(req, 8);
  Serial1.flush();   // tunggu byte selesai keluar
  mbPostTx();

  uint8_t  resp[16];
  uint8_t  got = 0;
  uint32_t start = millis();
  while (millis() - start < PROBE_TIMEOUT_MS) {
    while (Serial1.available() && got < sizeof(resp)) {
      resp[got++] = Serial1.read();
    }
  }
  if (got < 3 || resp[0] != id) return 0;        // tidak menjawab
  if (resp[1] == 0x84) return 1;                 // exception (BUS OK)
  if (resp[1] == 0x04 && got >= 5) {
    if (pvOut) *pvOut = (int16_t)((resp[3] << 8) | resp[4]);
    return 2;                                    // data valid
  }
  return 1;  // ada jawaban dari id ini -> bus OK
}

// Catat hasil temuan ke global + cetak.
static void recordFound(uint8_t id, uint32_t baud, const SerialFmt& f, int16_t pv, bool isData) {
  found = true; foundId = id; foundBaud = baud;
  foundCfg = f.cfg; foundFmtName = f.name;
  foundDe = gDePin; foundTx = gTxPin; foundRx = gRxPin;
  if (isData)
    Serial.printf("\n[FOUND] TX=%d RX=%d DE=%d ID=%u baud=%lu fmt=%s  PV(raw)=%d\n",
                  gTxPin, gRxPin, gDePin, id, baud, f.name, pv);
  else
    Serial.printf("\n[FOUND] TX=%d RX=%d DE=%d ID=%u baud=%lu fmt=%s (exception, BUS OK)\n",
                  gTxPin, gRxPin, gDePin, id, baud, f.name);
}

// Probe rentang ID pada satu kombinasi baud+format (pakai pin aktif).
static bool probeRange(uint32_t baud, const SerialFmt& f, uint8_t idMax) {
  Serial1.begin(baud, f.cfg, gRxPin, gTxPin);
  delay(5);
  for (uint8_t id = SCAN_ID_MIN; id <= idMax; id++) {
    int16_t pv = 0;
    uint8_t r = probeRaw(id, &pv);
    if (r == 2) { recordFound(id, baud, f, pv, true);  return true; }
    if (r == 1) { recordFound(id, baud, f, 0,  false); return true; }
    Serial.print(".");
  }
  return false;
}

// 2a) DISCOVERY: tebak pasangan pin (TX, RX) + DE dengan probe cepat
//     (baud 9600/19200, parity N/E, ID 1..3). Begitu controller menjawab,
//     kombinasi pin dikunci. Ini ~2-3 menit.
static bool discoverPins() {
  const uint32_t dBauds[] = { 9600, 19200 };
  const SerialFmt dFmts[] = { { SERIAL_8N1, "8N1" }, { SERIAL_8E1, "8E1" } };
  for (uint8_t ui = 0; ui < UART_N; ui++) {
    gTxPin = UARTS[ui].tx; gRxPin = UARTS[ui].rx;
    Serial.printf("\n[PIN-SCAN] UART TX=%d RX=%d", gTxPin, gRxPin);
    for (uint8_t di = 0; di < DE_N; di++) {
      int de = DE_CANDIDATES[di];
      if (de == gTxPin || de == gRxPin) continue;  // jangan pakai pin sama
      deSelect(de);
      Serial.printf("\n  DE=%d ", de);
      for (uint8_t bi = 0; bi < 2; bi++) {
        for (uint8_t fi = 0; fi < 2; fi++) {
          if (probeRange(dBauds[bi], dFmts[fi], 3)) {
            Serial.printf("\n[PIN-OK] TX=%d RX=%d DE=%d (controller menjawab)\n",
                          gTxPin, gRxPin, de);
            return true;
          }
        }
      }
    }
  }
  return false;
}

// 2b) FULL SCAN: setelah pin diketahui, cari ID+baud+format yang persis.
static bool scanBus() {
  for (uint8_t fi = 0; fi < FMT_N; fi++) {
    for (uint8_t bi = 0; bi < BAUD_N; bi++) {
      Serial.printf("\n[SCAN] TX=%d RX=%d DE=%d %s baud %lu ",
                    gTxPin, gRxPin, gDePin, FMTS[fi].name, BAUDS[bi]);
      if (probeRange(BAUDS[bi], FMTS[fi], SCAN_ID_MAX)) return true;
    }
  }
  return false;
}

// Orkestrasi: temukan pin (TX/RX/DE) dulu, lalu scan lengkap pada pin itu.
static bool findDevice() {
  if (discoverPins()) {
    int lockedDe = gDePin, lockedTx = gTxPin, lockedRx = gRxPin;
    Serial.println(F("\n[SCAN] Pin terkunci, cari ID/baud/format persis..."));
    if (scanBus()) return true;
    // discovery sudah menemukan jawaban; anggap sukses walau full-scan lewat
    deSelect(lockedDe); gTxPin = lockedTx; gRxPin = lockedRx;
    return found;
  }
  return false;
}

// Heartbeat visual: kedipkan pin TX (GPIO16 -> LED TX2) sebagai GPIO biasa.
// Membuktikan sketch BENAR-BENAR jalan tanpa bergantung Serial USB / CDC.
static void bootHeartbeat() {
  pinMode(PIN_RS485_TX, OUTPUT);
  for (int i = 0; i < 10; i++) {
    digitalWrite(PIN_RS485_TX, HIGH);
    delay(100);
    digitalWrite(PIN_RS485_TX, LOW);
    delay(100);
  }
}

void setup() {
  // PALING AWAL: bukti hidup secara visual (LED TX2 berkedip 10x).
  // Jika LED TX2 berkedip di sini = sketch jalan, masalah hanya di Serial USB.
  // Jika tidak berkedip sama sekali = upload gagal / board tidak run.
  bootHeartbeat();

  Serial.begin(115200);
  delay(600);
  Serial.println();
  Serial.println(F("=== Modbus RS485 Wire Test (auto-detect pin) ==="));
  Serial.println(F("Target: Autonics TNL-P46RR-RS-035"));
  Serial.println(F("Auto-scan pasangan pin (TX,RX) + DE + baud + parity + ID."));
  Serial.println(F("Wiring: terminal RS485 A+ dan B- board ke TNL (A+->A+, B-->B-)"));

  // Langkah 1: sniffer cepat di 9600 (deteksi ada-tidaknya sinyal)
  sniffRaw(9600, 1500);

  // Langkah 2: auto-deteksi pin TX/RX/DE -> lalu slave ID + baud + format
  Serial.println(F("\n[SCAN] Auto-deteksi pin TX/RX/DE (butuh ~2-3 menit)..."));
  if (findDevice()) {
    deSelect(foundDe); gTxPin = foundTx; gRxPin = foundRx;
    beginBus(foundBaud, foundCfg, foundId);  // set ke hasil temuan untuk monitor
    Serial.println(F("\n>>> KONEKSI BERHASIL. Lanjut mode MONITOR PV. <<<"));
    Serial.printf(">>> Setting: TX=%d RX=%d DE=%d  ID=%u  baud=%lu  format=%s <<<\n",
                  foundTx, foundRx, foundDe, foundId, foundBaud, foundFmtName);
    Serial.println(F(">>> Pakai nilai ini di RetortLogger (PIN_RS485_*, TNL_SLAVE_ID, MB_BAUD, Serial1). <<<"));
  } else {
    Serial.println(F("\n[GAGAL] Tak ada jawaban di semua pin/DE/ID/baud/parity."));
    Serial.println(F("Software PC BISA baca di terminal sama -> controller & kabel OK."));
    Serial.println(F("Yang masih mungkin di sisi ESP:"));
    Serial.println(F("  1. A+/B- masih kebalik (tukar sekali lagi)"));
    Serial.println(F("  2. Slave ID controller > 3 (discovery cek ID 1..3 saja)"));
    Serial.println(F("  3. Modul RS485 belum dapat power (cek jumper/VCC board)"));
    Serial.println(F("  4. Pin RS485 board di luar daftar -> kirim foto/skema board"));
    Serial.println(F("  5. Pastikan PC software DITUTUP saat tes (1 master di bus)"));
  }
}

void loop() {
  if (!found) {
    // Belum ketemu: ulangi scan terus-menerus supaya kamu bisa TUKAR A/B
    // (atau cek wiring) sambil board tetap jalan, tanpa upload ulang.
    static unsigned long retryMs = 0;
    if (millis() - retryMs >= 3000) {
      retryMs = millis();
      Serial.println(F("\n[RETRY] Scan ulang... (silakan tukar A+/B- jika belum ketemu)"));
      if (findDevice()) {
        deSelect(foundDe); gTxPin = foundTx; gRxPin = foundRx;
        beginBus(foundBaud, foundCfg, foundId);
        Serial.printf("\n>>> BERHASIL. TX=%d RX=%d DE=%d ID=%u baud=%lu fmt=%s. Mode MONITOR PV. <<<\n",
                      foundTx, foundRx, foundDe, foundId, foundBaud, foundFmtName);
      }
    }
    return;
  }

  static unsigned long lastMs = 0;
  if (millis() - lastMs < 2000) return;
  lastMs = millis();

  uint8_t r = modbus.readInputRegisters(TNL_REG_PV, 2);
  if (r == modbus.ku8MBSuccess) {
    int16_t  pvRaw = (int16_t)modbus.getResponseBuffer(0);
    uint16_t dp    = modbus.getResponseBuffer(1);
    float div = 1.0f;
    for (uint16_t i = 0; i < dp && i < 3; i++) div *= 10.0f;
    Serial.printf("[OK] ID=%u @%lu  PV=%.1f (raw=%d dp=%u)\n",
                  foundId, foundBaud, pvRaw / div, pvRaw, dp);
  } else {
    Serial.printf("[ERR] 0x%02X (koneksi sempat putus)\n", r);
  }
}
