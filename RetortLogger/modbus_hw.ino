// ============================================================
//  modbus_hw.ino  –  RS485 Modbus RTU
//  Aktif jika USE_MODBUS = true
//  Library: ModbusMaster (Doc Walker)
// ============================================================

#if USE_MODBUS

#include <ModbusMaster.h>

extern AppConfig   cfg;
extern RetortState state;

// Pin definitions – sesuaikan dengan hardware
#define MB_RX_PIN    18
#define MB_TX_PIN    17
#define MB_DE_RE_PIN 16
#define MB_BAUD      9600
#define MB_SLAVE_ID  1

// Register map (sesuaikan dengan PLC/sensor)
#define MB_REG_TEMP     0x0000  // Temperature x10
#define MB_REG_PRESSURE 0x0001  // Pressure x1000

static ModbusMaster modbus;
static unsigned long lastModbusRead = 0;
static const unsigned long MODBUS_INTERVAL_MS = 1000;

static void preTransmit()  { digitalWrite(MB_DE_RE_PIN, HIGH); }
static void postTransmit() { digitalWrite(MB_DE_RE_PIN, LOW);  }

void setupModbus() {
  pinMode(MB_DE_RE_PIN, OUTPUT);
  digitalWrite(MB_DE_RE_PIN, LOW);

  Serial1.begin(MB_BAUD, SERIAL_8N1, MB_RX_PIN, MB_TX_PIN);
  modbus.begin(MB_SLAVE_ID, Serial1);
  modbus.preTransmission(preTransmit);
  modbus.postTransmission(postTransmit);

  Serial.println(F("[MODBUS] Initialized."));
}

void loopModbus() {
  unsigned long now = millis();
  if (now - lastModbusRead < MODBUS_INTERVAL_MS) return;
  lastModbusRead = now;

  // Read temperature
  uint8_t result = modbus.readHoldingRegisters(MB_REG_TEMP, 1);
  if (result == modbus.ku8MBSuccess) {
    uint16_t raw = modbus.getResponseBuffer(0);
    state.temperature = (float)raw / 10.0f;
  }

  // Read pressure
  result = modbus.readHoldingRegisters(MB_REG_PRESSURE, 1);
  if (result == modbus.ku8MBSuccess) {
    uint16_t raw = modbus.getResponseBuffer(0);
    state.pressure = (float)raw / 1000.0f;
  }
}

#if !USE_FAKE_SENSOR
void startProcess() {
  if (state.phase != PHASE_IDLE) return;
  state.phase = PHASE_HEATING;
  state.phaseStartMs = millis();
  Serial.println(F("[MODBUS] START -> HEATING"));
  // TODO(hardware): Kirim command start ke PLC via Modbus write
}

void stopProcess() {
  state.phase = PHASE_IDLE;
  state.phaseStartMs = 0;
  Serial.println(F("[MODBUS] STOP"));
  // TODO(hardware): Kirim command stop ke PLC via Modbus write
}
#endif

#else  // USE_MODBUS = false – stubs

void setupModbus() {}
void loopModbus() {}

#endif
