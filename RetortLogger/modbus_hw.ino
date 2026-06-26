// ============================================================
//  modbus_hw.ino  –  Autonics TNL-P46RR-RS-035 via RS485
//  PV (Present Value) : Read Input Register (FC04) @ 0x03E8
//  SV (Set Value)     : Read Holding Register (FC03) @ 0x0000
//  Decimal point      : Read Input Register (FC04) @ 0x03E9
//  Skala otomatis mengikuti decimal point controller.
//
//  Raw Modbus RTU (tanpa lib) + timeout pendek 150ms agar tak pernah
//  mem-block 1 detik. Board RS485 auto-direction (DE=-1).
//  Dipanggil dari loggerTask (core 1) tiap 1 detik, bukan dari loop().
// ============================================================

#if USE_MODBUS

extern AppConfig   cfg;
extern RetortState state;

// Autonics TN/TNL register map
#define TNL_REG_PV    0x03E8  // FC04: +0 PV, +1 decimal point
#define TNL_REG_SV    0x0000  // FC03: Set Value (holding register)
#define TNL_SLAVE_ID  1       // Unit address default Autonics = 1
#define MB_BAUD       9600
#define MB_FORMAT     SERIAL_8N1   // terbukti terbaca (TNL default 8N2 juga OK)
#define MB_TIMEOUT_MS 150          // batas tunggu jawaban (cukup utk 9600bps)

// Kode khusus PV controller (sensor error)
#define TNL_PV_OPEN   31000  // sensor terbuka / putus
#define TNL_PV_HHHH   30000  // over range
#define TNL_PV_LLLL  -30000  // under range

static uint16_t lastDp = 1;  // decimal point terakhir (default 0.0)

// --- Kontrol arah MAX485 (DE+RE). Board ini auto-direction (DE=-1). ---
static inline void mbTx() {
#if PIN_RS485_DE >= 0
  digitalWrite(PIN_RS485_DE, HIGH);
#endif
}
static inline void mbRx() {
#if PIN_RS485_DE >= 0
  digitalWrite(PIN_RS485_DE, LOW);
#endif
}

// CRC16 Modbus (poly 0xA001).
static uint16_t mbCrc(const uint8_t* buf, uint8_t len) {
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

// Raw Modbus RTU read: kirim request, tunggu jawaban dgn timeout PENDEK.
// Mengganti ModbusMaster (timeout default 2 dtk → bisa bikin telat 1 detik).
// Return true bila sukses; isi out[0..count-1].
static bool mbRead(uint8_t fc, uint16_t addr, uint8_t count, uint16_t* out) {
  uint8_t req[8];
  req[0] = TNL_SLAVE_ID;
  req[1] = fc;
  req[2] = (addr >> 8) & 0xFF;
  req[3] = addr & 0xFF;
  req[4] = 0x00;
  req[5] = count;
  uint16_t c = mbCrc(req, 6);
  req[6] = c & 0xFF;
  req[7] = (c >> 8) & 0xFF;

  while (Serial1.available()) Serial1.read();  // buang sisa
  mbTx();
  Serial1.write(req, 8);
  Serial1.flush();   // tunggu byte keluar
  mbRx();

  const uint8_t need = 5 + count * 2;  // id+fc+bc + data + crc(2)
  uint8_t  resp[40];
  uint8_t  got = 0;
  uint32_t start = millis();
  while (millis() - start < MB_TIMEOUT_MS) {
    while (Serial1.available() && got < sizeof(resp)) resp[got++] = Serial1.read();
    if (got >= need) break;
  }
  if (got < need)              return false;
  if (resp[0] != TNL_SLAVE_ID) return false;
  if (resp[1] != fc)           return false;  // exception / fc salah
  if (resp[2] != count * 2)    return false;
  uint16_t calc  = mbCrc(resp, 3 + count * 2);
  uint16_t rxcrc = resp[3 + count * 2] | (resp[4 + count * 2] << 8);
  if (calc != rxcrc)           return false;
  for (uint8_t i = 0; i < count; i++)
    out[i] = (resp[3 + i * 2] << 8) | resp[4 + i * 2];
  return true;
}

static float dpDivisor(uint16_t dp) {
  float div = 1.0f;
  for (uint16_t i = 0; i < dp && i < 3; i++) div *= 10.0f;
  return div;
}

// Auto-deteksi fase dari data logger (PV vs SV)
#define PHASE_BAND_C   5.0f    // ±5°C dari SV dianggap HOLDING
#define PHASE_TREND_C  0.2f    // perubahan min per siklus utk dianggap naik/turun
#define PHASE_IDLE_C   40.0f   // di bawah ini & turun → IDLE
static bool  havePrevPv = false;
static float prevPv     = 0.0f;

// Tentukan fase berdasar nilai aktual & tren suhu dari controller.
static void updatePhaseFromData() {
  float pv = state.temperature;
  float sv = state.setpoint;
  if (sv <= 1.0f) return;  // SV belum valid

  float trend = havePrevPv ? (pv - prevPv) : 0.0f;
  prevPv = pv;
  havePrevPv = true;

  if (pv >= sv - PHASE_BAND_C) {
    state.phase = PHASE_HOLDING;
  } else if (trend > PHASE_TREND_C) {
    state.phase = PHASE_HEATING;
  } else if (trend < -PHASE_TREND_C) {
    state.phase = (pv <= PHASE_IDLE_C) ? PHASE_IDLE : PHASE_COOLING;
  }
  // Selain itu (suhu stabil di luar band): pertahankan fase terakhir
}

void setupModbus() {
#if PIN_RS485_DE >= 0
  pinMode(PIN_RS485_DE, OUTPUT);
  digitalWrite(PIN_RS485_DE, LOW);  // default mode terima
#endif
  Serial1.begin(MB_BAUD, MB_FORMAT, PIN_RS485_RX, PIN_RS485_TX);
  Serial.println(F("[MODBUS] Autonics TNL initialized (raw RTU)."));
  Serial.printf("[MODBUS] RX=%d TX=%d DE=%d Slave=%d @%d 8N1 timeout=%dms\n",
                PIN_RS485_RX, PIN_RS485_TX, PIN_RS485_DE,
                TNL_SLAVE_ID, MB_BAUD, MB_TIMEOUT_MS);
}

// Satu kali poll PV + SV. Dipanggil dari loggerTask tiap 1 detik.
// Tidak ada timing internal: kadensi diatur task (vTaskDelayUntil).
void loopModbus() {
  // --- 1) Baca PV + decimal point (FC04 @0x03E8, 2 register) ---
  uint16_t pv[2];
  if (mbRead(0x04, TNL_REG_PV, 2, pv)) {
    int16_t  pvRaw = (int16_t)pv[0];
    uint16_t dp    = pv[1];
    if (dp <= 3) lastDp = dp;  // sebagian unit tak punya reg ini → pakai terakhir
    float div = dpDivisor(lastDp);
    if (pvRaw == TNL_PV_OPEN || pvRaw == TNL_PV_HHHH || pvRaw == TNL_PV_LLLL) {
      Serial.printf("[MODBUS] PV sensor err: %d\n", pvRaw);
    } else {
      state.temperature = (float)pvRaw / div;
    }
  } else {
    // Gagal sekali: pertahankan nilai terakhir, jangan block.
    Serial.println(F("[MODBUS] PV read miss (pakai nilai terakhir)"));
  }

  // --- 2) Baca SV (FC03 @0x0000, 1 register) ---
  uint16_t sv[1];
  if (mbRead(0x03, TNL_REG_SV, 1, sv)) {
    int16_t svRaw = (int16_t)sv[0];
    state.setpoint = (float)svRaw / dpDivisor(lastDp);
  }

  updatePhaseFromData();
}

#else

void setupModbus() {}
void loopModbus() {}

#endif
