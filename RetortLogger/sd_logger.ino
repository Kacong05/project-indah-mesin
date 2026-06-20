// ============================================================
//  sd_logger.ino  –  MicroSD logging + replay (disabled by default)
//  Active when USE_SD = true
//  Library: SD (built-in Arduino/ESP32)
//  Hardware: SPI – CS=GPIO10, MOSI=GPIO11, CLK=GPIO12, MISO=GPIO13
// ============================================================

#if USE_SD

#include <SD.h>
#include <SPI.h>

#define SD_CS_PIN   10
#define SD_LOG_DIR  "/retort"
#define SD_MAX_FILE_BYTES  (5UL * 1024UL * 1024UL)  // 5 MB per log file

extern AppConfig   cfg;
extern RetortState retort;

static char currentLogPath[48];  // e.g. /retort/20240101_120000.csv
static File logFile;

// ---- Helpers -----------------------------------------------
static void buildLogPath(const char* timestamp) {
  // Converts "YYYY-MM-DD HH:MM:SS" -> "/retort/YYYYMMDD_HHMMSS.csv"
  char ts[20];
  strncpy(ts, timestamp, sizeof(ts));
  ts[sizeof(ts)-1] = '\0';
  // strip non-digits
  char clean[16] = {0};
  uint8_t ci = 0;
  for (uint8_t i = 0; ts[i] && ci < 15; i++) {
    if (ts[i] >= '0' && ts[i] <= '9') clean[ci++] = ts[i];
    else if (ts[i] == ' ' && ci > 0)  clean[ci++] = '_';
  }
  snprintf(currentLogPath, sizeof(currentLogPath),
           "%s/%s.csv", SD_LOG_DIR, clean);
}

static void openLogFile() {
  if (!SD.exists(SD_LOG_DIR)) SD.mkdir(SD_LOG_DIR);

  logFile = SD.open(currentLogPath, FILE_APPEND);
  if (!logFile) {
    Serial.printf("[SD] Cannot open %s\n", currentLogPath);
    return;
  }
  // Write CSV header if file is empty
  if (logFile.size() == 0) {
    logFile.println("timestamp,phase,temp_c,setpoint_c,running");
  }
  Serial.printf("[SD] Logging to %s\n", currentLogPath);
}

// ---- Public API --------------------------------------------
void sdSetup() {
  SPI.begin(12, 13, 11, SD_CS_PIN);  // SCK, MISO, MOSI, CS
  if (!SD.begin(SD_CS_PIN)) {
    Serial.println(F("[SD] Mount failed! Check card."));
    return;
  }
  Serial.printf("[SD] Card OK. Free: %lluMB\n",
                (SD.totalBytes() - SD.usedBytes()) / (1024UL * 1024UL));

  buildLogPath("boot_0000_0000");  // placeholder; overwritten on first log
  openLogFile();
}

void sdLog(const RetortState* s) {
  static bool fileNamed = false;

  // Name the file after the first valid timestamp
  if (!fileNamed && s->timestamp[0] != '\0' && s->timestamp[0] != '0') {
    if (logFile) logFile.close();
    buildLogPath(s->timestamp);
    openLogFile();
    fileNamed = true;
  }

  if (!logFile) return;

  // Rotate file if it exceeds limit
  if (logFile.size() >= SD_MAX_FILE_BYTES) {
    logFile.close();
    buildLogPath(s->timestamp);
    openLogFile();
  }

  logFile.printf("%s,%d,%.2f,%.2f,%d\n",
                 s->timestamp,
                 s->phase,
                 s->tempC,
                 s->setpoint,
                 s->running ? 1 : 0);
  logFile.flush();
}

// Replay: read last CSV file line-by-line, publish each row via MQTT
// offsetMs: skip rows before this elapsed millisecond (0 = all)
void sdReplay(uint32_t offsetMs) {
  // List files in /retort, open the last one alphabetically
  File dir = SD.open(SD_LOG_DIR);
  if (!dir) {
    Serial.println(F("[SD] Replay: no log dir."));
    return;
  }

  char lastName[48] = {0};
  File entry = dir.openNextFile();
  while (entry) {
    if (!entry.isDirectory()) {
      strncpy(lastName, entry.name(), sizeof(lastName) - 1);
    }
    entry.close();
    entry = dir.openNextFile();
  }
  dir.close();

  if (lastName[0] == '\0') {
    Serial.println(F("[SD] Replay: no files found."));
    return;
  }

  char replayPath[64];
  snprintf(replayPath, sizeof(replayPath), "%s/%s", SD_LOG_DIR, lastName);
  File f = SD.open(replayPath, FILE_READ);
  if (!f) return;

  Serial.printf("[SD] Replaying %s\n", replayPath);
  uint32_t lineNum = 0;
  char lineBuf[128];

  while (f.available()) {
    uint8_t i = 0;
    while (f.available() && i < sizeof(lineBuf) - 1) {
      char c = (char)f.read();
      if (c == '\n') break;
      lineBuf[i++] = c;
    }
    lineBuf[i] = '\0';
    lineNum++;
    if (lineNum == 1) continue;  // skip header

    // Publish raw CSV row as MQTT message
    mqttClient_publishRaw(lineBuf);
    delay(cfg.sampleIntervalMs);  // pace replay to original rate
  }
  f.close();
  Serial.println(F("[SD] Replay complete."));
}

// Internal: publish raw string on pub topic
// Declared here to avoid circular dependency
static void mqttClient_publishRaw(const char* line) {
  // Calls mqttPublish indirectly via MQTT client
  // mqttClient is in mqtt_client.ino; use the global extern
  extern PubSubClient mqttClient;
  extern AppConfig cfg;
  mqttClient.publish(cfg.mqttTopicPub, line, false);
}

#else  // USE_SD = false – stubs

void sdSetup() {}
void sdLog(const RetortState* s) { (void)s; }
void sdReplay(uint32_t offsetMs) { (void)offsetMs; }

#endif
