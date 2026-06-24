// ============================================================
//  sd_logger.ino  –  MicroSD CSV logging
//  Aktif jika USE_SD = true
//  Library: SD (built-in)
// ============================================================

#if USE_SD

#include <SD.h>
#include <SPI.h>

extern AppConfig   cfg;
extern RetortState state;

#define SD_CS_PIN   5
#define SD_LOG_DIR  "/retort"

static File logFile;
static char logPath[48] = {0};
static unsigned long lastLogMs = 0;
static const unsigned long LOG_INTERVAL_MS = 1000;

static void ensureLogDir() {
  if (!SD.exists(SD_LOG_DIR)) {
    SD.mkdir(SD_LOG_DIR);
  }
}

static void openNewLogFile() {
  char ts[24];
  getTimestamp(ts, sizeof(ts));

  // Bersihkan timestamp menjadi filename-safe
  char clean[20] = {0};
  int ci = 0;
  for (int i = 0; ts[i] && ci < 19; i++) {
    if (ts[i] >= '0' && ts[i] <= '9') clean[ci++] = ts[i];
    else if (ts[i] == ' ' && ci > 0) clean[ci++] = '_';
  }
  if (clean[0] == '\0') {
    snprintf(clean, sizeof(clean), "%lu", millis());
  }
  snprintf(logPath, sizeof(logPath), "%s/%s.csv", SD_LOG_DIR, clean);

  ensureLogDir();
  logFile = SD.open(logPath, FILE_APPEND);
  if (logFile) {
    if (logFile.size() == 0) {
      logFile.println(F("timestamp,phase,temp,pressure"));
    }
    Serial.printf("[SD] Logging to: %s\n", logPath);
  } else {
    Serial.printf("[SD] Failed to open: %s\n", logPath);
  }
}

void setupSDLogger() {
  if (!SD.begin(SD_CS_PIN)) {
    Serial.println(F("[SD] Mount failed!"));
    state.sdReady = false;
    return;
  }
  state.sdReady = true;

  uint64_t total = SD.totalBytes();
  uint64_t used  = SD.usedBytes();
  Serial.printf("[SD] Ready. Total=%lluMB Used=%lluMB Free=%lluMB\n",
                total / 1048576ULL, used / 1048576ULL,
                (total - used) / 1048576ULL);

  ensureLogDir();
  openNewLogFile();
}

void loopSDLogger() {
  if (!state.sdReady) return;

  unsigned long now = millis();
  if (now - lastLogMs < LOG_INTERVAL_MS) return;
  lastLogMs = now;

  sdLogEntry();
}

void sdLogEntry() {
  if (!state.sdReady || !logFile) return;

  char ts[24];
  getTimestamp(ts, sizeof(ts));

  logFile.printf("%s,%d,%.2f,%.3f\n",
                 ts, (int)state.phase,
                 state.temperature, state.pressure);
  logFile.flush();

  // Rotasi file di 5MB
  if (logFile.size() > 5UL * 1024UL * 1024UL) {
    logFile.close();
    openNewLogFile();
  }
}

#else  // USE_SD = false – stubs

void setupSDLogger() {}
void loopSDLogger() {}
void sdLogEntry() {}

#endif
