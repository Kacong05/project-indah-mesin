// ============================================================
//  modbus_hw.ino  –  RS485 Modbus RTU (disabled by default)
//  Active when USE_MODBUS = true
//  Library: ModbusMaster (Doc Walker)
//  Hardware: ESP32-S3 UART1 -> MAX485 -> Slave device
// ============================================================

#if USE_MODBUS

#include <ModbusMaster.h>

// ---- Pin definitions (see CONFIGURATION.md) ----------------
#define MB_RX_PIN    18   // UART1 RX
#define MB_TX_PIN    17   // UART1 TX
#define MB_DE_RE_PIN 16   // DE+RE of MAX485 (active HIGH = transmit)
#define MB_BAUD      9600
#define MB_SLAVE_ID  1

// Modbus register map (adjust for your sensor/PLC)
#define MB_REG_TEMP   0x0000  // Holding register: temperature x10 (e.g. 1213 = 121.3°C)

static ModbusMaster modbus;

static void preTransmit()  { digitalWrite(MB_DE_RE_PIN, HIGH); }
static void postTransmit() { digitalWrite(MB_DE_RE_PIN, LOW);  }

void modbusSetup() {
  pinMode(MB_DE_RE_PIN, OUTPUT);
  digitalWrite(MB_DE_RE_PIN, LOW);

  Serial1.begin(MB_BAUD, SERIAL_8N1, MB_RX_PIN, MB_TX_PIN);
  modbus.begin(MB_SLAVE_ID, Serial1);
  modbus.preTransmission(preTransmit);
  modbus.postTransmission(postTransmit);

  Serial.println(F("[MODBUS] Initialized."));
}

float modbusReadTemp() {
  uint8_t result = modbus.readHoldingRegisters(MB_REG_TEMP, 1);
  if (result == modbus.ku8MBSuccess) {
    uint16_t raw = modbus.getResponseBuffer(0);
    return (float)raw / 10.0f;
  }
  Serial.printf("[MODBUS] Read error: 0x%02X\n", result);
  return -1.0f;  // sentinel: read failed
}

void modbusLoop() {
  // Placeholder for polling multiple registers / writing outputs
}

#else  // USE_MODBUS = false – provide stub bodies

void modbusSetup() {}
float modbusReadTemp() { return 0.0f; }
void modbusLoop() {}

#endif
