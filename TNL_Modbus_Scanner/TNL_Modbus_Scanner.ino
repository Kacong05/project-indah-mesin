/*
 * TNL_Modbus_Scanner.ino
 * Scan alamat Modbus RTU Autonics TNL — respons ke Serial Monitor.
 * Fokus: trigger DI-1 (terminal 18–21 / kontak selenoid) + MV/RUN.
 *
 * Hardware: sama dengan RetortLogger
 *   RS485 RX=GPIO16  TX=GPIO15  DE=-1 (auto-direction)
 *   Baud 9600 8N1
 *
 * Serial Monitor: 115200 baud
 *   - setup(): scan sekali
 *   - loop(): poll alamat penting tiap 2 detik (uji jumper ON/OFF)
 */

#define PIN_RS485_RX    16
#define PIN_RS485_TX    15
#define PIN_RS485_DE    -1

#define MB_BAUD         9600
#define MB_SLAVE        1
#define MB_TIMEOUT_MS   200

#define SCAN_FC02_START 0x0020
#define SCAN_FC02_END   0x0028
#define SCAN_FC03_START 0x0000
#define SCAN_FC03_END   0x0010
#define SCAN_FC04_START 0x03E0
#define SCAN_FC04_END   0x0402

static uint16_t mbCrc(const uint8_t* buf, uint8_t len) {
  uint16_t crc = 0xFFFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= buf[i];
    for (uint8_t b = 0; b < 8; b++) {
      if (crc & 1) { crc >>= 1; crc ^= 0xA001; }
      else         crc >>= 1;
    }
  }
  return crc;
}

static void mbTx() {
#if PIN_RS485_DE >= 0
  digitalWrite(PIN_RS485_DE, HIGH);
#endif
}

static void mbRx() {
#if PIN_RS485_DE >= 0
  digitalWrite(PIN_RS485_DE, LOW);
#endif
}

static void printHex(const uint8_t* buf, uint8_t len) {
  for (uint8_t i = 0; i < len; i++) {
    if (buf[i] < 0x10) Serial.print('0');
    Serial.print(buf[i], HEX);
    if (i + 1 < len) Serial.print(' ');
  }
}

static uint8_t mbRawExchange(const uint8_t* req, uint8_t reqLen,
                             uint8_t* resp, uint8_t respMax,
                             uint32_t timeoutMs) {
  while (Serial1.available()) Serial1.read();
  mbTx();
  Serial1.write(req, reqLen);
  Serial1.flush();
  mbRx();

  uint8_t got = 0;
  uint32_t start = millis();
  while (millis() - start < timeoutMs) {
    while (Serial1.available() && got < respMax)
      resp[got++] = Serial1.read();
    if (got >= 5) {
      delay(5);
      while (Serial1.available() && got < respMax)
        resp[got++] = Serial1.read();
      break;
    }
  }
  return got;
}

static void buildReq(uint8_t slave, uint8_t fc, uint16_t addr,
                     uint16_t qty, uint8_t* req) {
  req[0] = slave;
  req[1] = fc;
  req[2] = (addr >> 8) & 0xFF;
  req[3] = addr & 0xFF;
  req[4] = (qty >> 8) & 0xFF;
  req[5] = qty & 0xFF;
  uint16_t c = mbCrc(req, 6);
  req[6] = c & 0xFF;
  req[7] = (c >> 8) & 0xFF;
}

static bool readBits(uint8_t slave, uint8_t fc, uint16_t addr, uint16_t qty,
                     uint8_t* bitsOut) {
  if (fc != 0x01 && fc != 0x02) return false;
  uint8_t req[8], resp[64];
  buildReq(slave, fc, addr, qty, req);
  uint8_t got = mbRawExchange(req, 8, resp, sizeof(resp), MB_TIMEOUT_MS);
  if (got < 5) return false;
  if (resp[0] != slave) return false;
  if (resp[1] & 0x80) return false;
  if (resp[1] != fc) return false;
  uint8_t bc = resp[2];
  if (got < (uint8_t)(3 + bc + 2)) return false;
  uint16_t calc = mbCrc(resp, 3 + bc);
  uint16_t rx   = resp[3 + bc] | (resp[4 + bc] << 8);
  if (calc != rx) return false;
  for (uint16_t i = 0; i < qty && i < 16; i++) {
    uint8_t byteIdx = i / 8;
    uint8_t bitIdx  = i % 8;
    bitsOut[i] = (resp[3 + byteIdx] >> bitIdx) & 1;
  }
  return true;
}

static bool readRegs(uint8_t slave, uint8_t fc, uint16_t addr, uint16_t qty,
                     uint16_t* out) {
  if (fc != 0x03 && fc != 0x04) return false;
  uint8_t req[8], resp[64];
  buildReq(slave, fc, addr, qty, req);
  uint8_t got = mbRawExchange(req, 8, resp, sizeof(resp), MB_TIMEOUT_MS);
  if (got < 5) return false;
  if (resp[0] != slave) return false;
  if (resp[1] & 0x80) return false;
  if (resp[1] != fc) return false;
  uint8_t bc = resp[2];
  if (bc != qty * 2) return false;
  if (got < (uint8_t)(3 + bc + 2)) return false;
  uint16_t calc = mbCrc(resp, 3 + bc);
  uint16_t rx   = resp[3 + bc] | (resp[4 + bc] << 8);
  if (calc != rx) return false;
  for (uint16_t i = 0; i < qty; i++)
    out[i] = (resp[3 + i * 2] << 8) | resp[4 + i * 2];
  return true;
}

static void tryRead(const char* label, uint8_t fc, uint16_t addr, uint16_t qty) {
  uint8_t req[8];
  buildReq(MB_SLAVE, fc, addr, qty, req);

  Serial.printf("[PROBE] %s | FC=%02X PDU=0x%04X qty=%u | TX: ",
                label, fc, addr, qty);
  printHex(req, 8);
  Serial.println();

  if (fc == 0x01 || fc == 0x02) {
    uint8_t bits[16] = {0};
    if (readBits(MB_SLAVE, fc, addr, qty, bits)) {
      uint16_t modAddr = (fc == 0x02) ? (10001 + addr) : (1 + addr);
      Serial.printf("        OK  bits=");
      for (uint16_t i = 0; i < qty; i++) Serial.printf("%u", bits[i]);
      Serial.printf("  Modbus addr=%u", modAddr);
      if (addr == 0x0023)
        Serial.printf("  -> DI-1 %s (jumper 18-21 %s)",
                      bits[0] ? "ON" : "OFF",
                      bits[0] ? "tertutup" : "terbuka");
      Serial.println();
    } else {
      Serial.println("        FAIL");
    }
    return;
  }

  uint16_t regs[8] = {0};
  if (readRegs(MB_SLAVE, fc, addr, qty, regs)) {
    Serial.printf("        OK  ");
    for (uint16_t i = 0; i < qty; i++)
      Serial.printf("r[%u]=0x%04X(%u) ", i, regs[i], regs[i]);
    Serial.println();
  } else {
    Serial.println("        FAIL");
  }
}

static void scanRange(const char* fcName, uint8_t fc,
                      uint16_t start, uint16_t end, uint16_t qty) {
  Serial.printf("\n===== SCAN %s FC=%02X PDU 0x%04X..0x%04X =====\n",
                fcName, fc, start, end);
  uint16_t hit = 0;
  for (uint16_t addr = start; addr <= end; addr++) {
    if (fc == 0x01 || fc == 0x02) {
      uint8_t bits[16] = {0};
      if (readBits(MB_SLAVE, fc, addr, qty, bits)) {
        hit++;
        uint16_t modAddr = (fc == 0x02) ? (10001 + addr) : (1 + addr);
        Serial.printf("  OK  PDU=0x%04X Modbus=%u bit=", addr, modAddr);
        for (uint16_t i = 0; i < qty; i++) Serial.printf("%u", bits[i]);
        Serial.println();
      }
    } else {
      uint16_t regs[4] = {0};
      if (readRegs(MB_SLAVE, fc, addr, qty, regs)) {
        hit++;
        Serial.printf("  OK  PDU=0x%04X val=0x%04X (%u)\n", addr, regs[0], regs[0]);
      }
    }
    delay(30);
  }
  Serial.printf("----- %u alamat merespons -----\n", hit);
}

static void scanSlaveIds() {
  Serial.println("\n===== SCAN SLAVE ID (FC04 @ 0x03E8 PV) =====");
  for (uint8_t sid = 1; sid <= 5; sid++) {
    uint16_t pv = 0;
    if (readRegs(sid, 0x04, 0x03E8, 1, &pv))
      Serial.printf("  Slave %u -> OK  PV raw=0x%04X (%u)\n", sid, pv, pv);
    else
      Serial.printf("  Slave %u -> no response\n", sid);
    delay(30);
  }
}

static void printLiveRow(const char* label, bool ok, const char* detail) {
  Serial.printf("[LIVE] %-30s ", label);
  if (!ok) Serial.println("--");
  else Serial.println(detail);
}

void setup() {
  Serial.begin(115200);
  delay(800);
#if PIN_RS485_DE >= 0
  pinMode(PIN_RS485_DE, OUTPUT);
  digitalWrite(PIN_RS485_DE, LOW);
#endif
  Serial1.begin(MB_BAUD, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);

  Serial.println();
  Serial.println("========================================");
  Serial.println("  TNL Modbus Scanner — trigger DI-1");
  Serial.printf("  Slave=%u  Baud=%u  RX=%d TX=%d\n",
                MB_SLAVE, MB_BAUD, PIN_RS485_RX, PIN_RS485_TX);
  Serial.println("  Terminal 18-21 = DI-1 (jumper = selenoid)");
  Serial.println("========================================");

  scanSlaveIds();
  scanRange("Discrete Inputs", 0x02, SCAN_FC02_START, SCAN_FC02_END, 1);
  scanRange("Holding Registers", 0x03, SCAN_FC03_START, SCAN_FC03_END, 1);
  scanRange("Input Registers", 0x04, SCAN_FC04_START, SCAN_FC04_END, 1);

  Serial.println("\n===== PROBE ALAMAT PENTING (trigger + MV) =====");
  tryRead("DI-1 (trigger 18-21)",     0x02, 0x0023, 1);
  tryRead("RUN/STOP",                 0x03, 0x0000, 1);
  tryRead("PV",                       0x04, 0x03E8, 1);
  tryRead("SV",                       0x04, 0x03EB, 1);
  tryRead("Heating MV",               0x04, 0x03EC, 1);
  tryRead("Cooling MV",               0x04, 0x03ED, 1);
  tryRead("DI status word (alt)",     0x04, 0x03F1, 1);
  tryRead("Blok PV..MV (6 reg)",      0x04, 0x03E8, 6);
  tryRead("Pattern (P/S)",            0x04, 0x03FB, 1);
  tryRead("Step (P/S)",               0x04, 0x03FC, 1);
  tryRead("TOT Program_Process_Time", 0x04, 0x03FD, 1);
  tryRead("Wait Program_Wait_Time",   0x04, 0x03FE, 1);
  tryRead("Rest Program_Rest_Time",   0x04, 0x03FF, 1);
  tryRead("STEP_TIM_1 (FC03)",        0x03, 0x00CD, 1);

  Serial.println("\n===== SCAN SELESAI =====");
  Serial.println("Loop: poll live tiap 2 dtk — pasang/lepas jumper, lihat DI-1 & MV");
  Serial.println("RetortLogger trigger produksi: mulai MV>0, stop STOP+MV0\n");
}

static void formatTnlMs(uint16_t raw, char* out, size_t outLen) {
  uint16_t m = raw / 100;
  uint16_t s = raw % 100;
  if (s > 59) s = 59;
  snprintf(out, outLen, "%02u:%02u", m, s);
}

void loop() {
  delay(2000);

  uint8_t  diBit = 0;
  uint16_t runReg = 0, hmv = 0, cmv = 0, diWord = 0, pv = 0;
  uint16_t pat = 0, step = 0, totRaw = 0, restRaw = 0, stepTim = 0;
  bool okDi   = readBits(MB_SLAVE, 0x02, 0x0023, 1, &diBit);
  bool okRun  = readRegs(MB_SLAVE, 0x03, 0x0000, 1, &runReg);
  bool okHmv  = readRegs(MB_SLAVE, 0x04, 0x03EC, 1, &hmv);
  bool okCmv  = readRegs(MB_SLAVE, 0x04, 0x03ED, 1, &cmv);
  bool okDiW  = readRegs(MB_SLAVE, 0x04, 0x03F1, 1, &diWord);
  bool okPv   = readRegs(MB_SLAVE, 0x04, 0x03E8, 1, &pv);
  bool okPat  = readRegs(MB_SLAVE, 0x04, 0x03FB, 1, &pat);
  bool okStep = readRegs(MB_SLAVE, 0x04, 0x03FC, 1, &step);
  bool okTot  = readRegs(MB_SLAVE, 0x04, 0x03FD, 1, &totRaw);
  bool okRest = readRegs(MB_SLAVE, 0x04, 0x03FF, 1, &restRaw);
  if (okStep && step >= 1 && step <= 20) {
    readRegs(MB_SLAVE, 0x03, (uint16_t)(0x00CD + (step - 1) * 2), 1, &stepTim);
  }

  char buf[80];

  if (okDi) {
    snprintf(buf, sizeof(buf),
             "bit=%u Modbus=10036 -> %s (jumper %s)",
             diBit, diBit ? "ON" : "OFF", diBit ? "tertutup" : "terbuka");
  }
  printLiveRow("DI-1 FC02 @ 0x0023", okDi, okDi ? buf : "");

  uint16_t mvRaw = (hmv >= cmv) ? hmv : cmv;
  bool ctrlRun = okRun && (runReg == 0);
  bool mvStart  = mvRaw > 0;
  bool idleSafe = okRun && !ctrlRun && mvRaw == 0;

  if (okRun) {
    snprintf(buf, sizeof(buf), "raw=%u -> %s", runReg, ctrlRun ? "RUN" : "STOP");
  }
  printLiveRow("RUN/STOP FC03 @ 0x0000", okRun, okRun ? buf : "");

  if (okHmv || okCmv) {
    snprintf(buf, sizeof(buf), "H=%u C=%u max=%u -> %.1f%%",
             hmv, cmv, mvRaw, mvRaw / 10.0f);
  }
  printLiveRow("MV FC04 0x03EC/ED", okHmv || okCmv, (okHmv || okCmv) ? buf : "");

  if (okDiW) {
    snprintf(buf, sizeof(buf), "word=0x%04X bit0(DI-1)=%u", diWord, diWord & 1);
  }
  printLiveRow("DI status FC04 @ 0x03F1", okDiW, okDiW ? buf : "");

  if (okPv) {
    snprintf(buf, sizeof(buf), "raw=0x%04X (%u)", pv, pv);
  }
  printLiveRow("PV FC04 @ 0x03E8", okPv, okPv ? buf : "");

  if (okPat && okStep) {
    char totStr[8], stpStr[8];
    formatTnlMs(totRaw, totStr, sizeof(totStr));
    int stpSec = (stepTim / 100) * 60 + (stepTim % 100) - (restRaw / 100) * 60 - (restRaw % 100);
    if (stpSec < 0) stpSec = 0;
    formatTnlMs((uint16_t)((stpSec / 60) * 100 + (stpSec % 60)), stpStr, sizeof(stpStr));
    snprintf(buf, sizeof(buf), "P/S=%u-%02u  TOT=%s  STP=%s (raw tot=0x%04X rest=0x%04X)",
             pat, step, totStr, stpStr, totRaw, restRaw);
  }
  printLiveRow("Program P/S TOT STP", okPat && okStep && okTot, (okPat && okStep && okTot) ? buf : "");

  Serial.printf("[LIVE] Mulai rekam (MV>0)           -> %s\n",
                mvStart ? "YA" : "tidak (atur DI-1 TNL agar MV naik)");
  Serial.printf("[LIVE] Idle aman (STOP+MV0)         -> %s\n",
                idleSafe ? "YA" : "set STOP saat tidak batch");

  Serial.println("---");
}
