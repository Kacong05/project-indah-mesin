// ============================================================
//  modbus_hw.ino  –  Autonics TNL-P46RR-RS-035 via RS485
//  Read Input Registers (FC04), 1 transaksi membaca 4 register:
//    0x03E8 = Present Value (PV / Actual)
//    0x03E9 = Decimal point (0:0, 1:0.0, 2:0.00, 3:0.000)
//    0x03EA = Display unit
//    0x03EB = Set Value (SV / Setting)
//  Skala otomatis mengikuti decimal point controller.
// ============================================================

#if USE_MODBUS

#include <ModbusMaster.h>

extern AppConfig   cfg;
extern RetortState state;

// Autonics TN/TNL — Read Input Registers (FC04)
#define TNL_REG_PV   0x03E8  // base: PV, +1 dp, +2 unit, +3 SV
#define TNL_REG_COUNT 4
#define TNL_SLAVE_ID 1       // Unit address default Autonics = 1

// Kode khusus PV controller (sensor error)
#define TNL_PV_OPEN   31000  // sensor terbuka / putus
#define TNL_PV_HHHH   30000  // over range
#define TNL_PV_LLLL  -30000  // under range

static ModbusMaster modbus;
static unsigned long lastModbusMs = 0;
static const unsigned long MODBUS_INTERVAL_MS = 1000;

void setupModbus() {
  // 9600 8N1 — samakan dengan setting komunikasi pada TNL
  Serial1.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  modbus.begin(TNL_SLAVE_ID, Serial1);
  Serial.println(F("[MODBUS] Autonics TNL initialized."));
  Serial.printf("[MODBUS] RX=%d TX=%d Slave=%d\n",
                PIN_RS485_RX, PIN_RS485_TX, TNL_SLAVE_ID);
}

void loopModbus() {
  unsigned long now = millis();
  if (now - lastModbusMs < MODBUS_INTERVAL_MS) return;
  lastModbusMs = now;

  // Satu transaksi FC04 membaca PV, decimal point, unit, dan SV.
  uint8_t result = modbus.readInputRegisters(TNL_REG_PV, TNL_REG_COUNT);
  if (result != modbus.ku8MBSuccess) {
    Serial.printf("[MODBUS] read err: 0x%02X\n", result);
    return;
  }

  int16_t  pvRaw = (int16_t)modbus.getResponseBuffer(0);
  uint16_t dp    = modbus.getResponseBuffer(1);  // 0..3
  int16_t  svRaw = (int16_t)modbus.getResponseBuffer(3);

  // Divisor sesuai decimal point: 1, 10, 100, 1000
  float div = 1.0f;
  for (uint16_t i = 0; i < dp && i < 3; i++) div *= 10.0f;

  // PV: abaikan jika kode error sensor (pertahankan nilai terakhir)
  if (pvRaw == TNL_PV_OPEN || pvRaw == TNL_PV_HHHH || pvRaw == TNL_PV_LLLL) {
    Serial.printf("[MODBUS] PV sensor err: %d\n", pvRaw);
  } else {
    state.temperature = (float)pvRaw / div;
  }
  state.setpoint = (float)svRaw / div;
}

#else

void setupModbus() {}
void loopModbus() {}

#endif
