// ============================================================
//  modbus_hw.ino  –  Autonics TNL-P46RR-RS-035 via RS485
//  PV (Present Value) : Read Input Register (FC04) @ 0x03E8
//  SV (Set Value)     : Read Holding Register (FC03) @ 0x0000
//  Decimal point      : Read Input Register (FC04) @ 0x03E9
//  Skala otomatis mengikuti decimal point controller.
//
//  PENTING: MAX485 butuh pin DE/RE. Kontrol arah di pre/postTransmission.
// ============================================================

#if USE_MODBUS

#include <ModbusMaster.h>

extern AppConfig   cfg;
extern RetortState state;

// Autonics TN/TNL register map
#define TNL_REG_PV    0x03E8  // FC04: +0 PV, +1 decimal point
#define TNL_REG_SV    0x0000  // FC03: Set Value (holding register)
#define TNL_SLAVE_ID  1       // Unit address default Autonics = 1

// Kode khusus PV controller (sensor error)
#define TNL_PV_OPEN   31000  // sensor terbuka / putus
#define TNL_PV_HHHH   30000  // over range
#define TNL_PV_LLLL  -30000  // under range

static ModbusMaster modbus;
static unsigned long lastModbusMs = 0;
static const unsigned long MODBUS_INTERVAL_MS = 1000;
static uint16_t lastDp = 1;  // decimal point terakhir (default 0.0)

// --- Kontrol arah MAX485 (DE+RE) ---
static void mbPreTx() {
#if PIN_RS485_DE >= 0
  digitalWrite(PIN_RS485_DE, HIGH);  // mode kirim
#endif
}
static void mbPostTx() {
#if PIN_RS485_DE >= 0
  digitalWrite(PIN_RS485_DE, LOW);   // kembali mode terima
#endif
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
  // 9600 8N1 — samakan dengan setting komunikasi pada TNL
  Serial1.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  modbus.begin(TNL_SLAVE_ID, Serial1);
  modbus.preTransmission(mbPreTx);    // DE/RE HIGH sebelum kirim
  modbus.postTransmission(mbPostTx);  // DE/RE LOW setelah kirim
  Serial.println(F("[MODBUS] Autonics TNL initialized."));
  Serial.printf("[MODBUS] RX=%d TX=%d DE=%d Slave=%d @9600 8N1\n",
                PIN_RS485_RX, PIN_RS485_TX, PIN_RS485_DE, TNL_SLAVE_ID);
}

void loopModbus() {
  unsigned long now = millis();
  if (now - lastModbusMs < MODBUS_INTERVAL_MS) return;
  lastModbusMs = now;

  // --- 1) Baca PV + decimal point (FC04) ---
  uint8_t r = modbus.readInputRegisters(TNL_REG_PV, 2);
  if (r != modbus.ku8MBSuccess) {
    Serial.printf("[MODBUS] PV read err: 0x%02X (%s)\n", r,
      r == 0xE2 ? "timeout - cek wiring/DE/baud/slaveID" :
      r == 0x02 ? "illegal address - cek alamat register" :
      r == 0x01 ? "illegal function - coba FC03" : "lihat manual");
    return;
  }
  int16_t  pvRaw = (int16_t)modbus.getResponseBuffer(0);
  uint16_t dp    = modbus.getResponseBuffer(1);
  if (dp <= 3) lastDp = dp;       // beberapa unit tak punya reg ini → pakai terakhir
  float div = dpDivisor(lastDp);

  if (pvRaw == TNL_PV_OPEN || pvRaw == TNL_PV_HHHH || pvRaw == TNL_PV_LLLL) {
    Serial.printf("[MODBUS] PV sensor err: %d\n", pvRaw);
  } else {
    state.temperature = (float)pvRaw / div;
  }

  // --- 2) Baca SV (FC03 holding register), transaksi terpisah ---
  uint8_t rs = modbus.readHoldingRegisters(TNL_REG_SV, 1);
  if (rs == modbus.ku8MBSuccess) {
    int16_t svRaw = (int16_t)modbus.getResponseBuffer(0);
    state.setpoint = (float)svRaw / div;
  } else {
    Serial.printf("[MODBUS] SV read err: 0x%02X (pakai SV terakhir)\n", rs);
  }

  Serial.printf("[MODBUS] PV=%.1f SV=%.1f dp=%u\n",
                state.temperature, state.setpoint, lastDp);

  updatePhaseFromData();
}

#else

void setupModbus() {}
void loopModbus() {}

#endif
