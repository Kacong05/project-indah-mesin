// ============================================================
//  sd_logger.ino  –  MicroSD CSV logging
//  Pin: CS=10, MOSI=11, CLK=12, MISO=13
//  CSV: Tanggal Jam, Actual, Setting
// ============================================================

#if USE_SD

#include <SD.h>
#include <SPI.h>

extern AppConfig   cfg;
extern RetortState state;

#define SD_LOG_DIR "/retort"

static File logFile;
static char logPath[48] = {0};
static unsigned long lastLogMs = 0;
static const unsigned long LOG_INTERVAL_MS = 1000;

static void ensureDir() {
  if (!SD.exists(SD_LOG_DIR)) SD.mkdir(SD_LOG_DIR);
}

static void openNewLog() {
  char ts[24];
  getTimestamp(ts, sizeof(ts));
  // Bersihkan jadi filename-safe
  char clean[20] = {0};
  int ci = 0;
  for (int i = 0; ts[i] && ci < 19; i++) {
    if (ts[i] >= '0' && ts[i] <= '9') clean[ci++] = ts[i];
    else if ((ts[i] == ' ' || ts[i] == '/') && ci > 0) clean[ci++] = '_';
  }
  if (clean[0] == '\0') snprintf(clean, sizeof(clean), "%lu", millis());
  snprintf(logPath, sizeof(logPath), "%s/%s.csv", SD_LOG_DIR, clean);
  ensureDir();
  logFile = SD.open(logPath, FILE_APPEND);
  if (logFile) {
    if (logFile.size() == 0) {
      logFile.println(F("Tanggal Jam,Actual,Setting"));
    }
    Serial.printf("[SD] Log: %s\n", logPath);
  }
}

void setupSDLogger() {
  SPI.begin(PIN_SD_CLK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
  if (!SD.begin(PIN_SD_CS)) {
    Serial.println(F("[SD] Mount failed!"));
    state.sdReady = false;
    return;
  }
  state.sdReady = true;
  uint64_t t = SD.totalBytes();
  uint64_t u = SD.usedBytes();
  Serial.printf("[SD] OK. Total=%lluMB Free=%lluMB\n",
                t / 1048576ULL, (t - u) / 1048576ULL);
  // File log dibuka saat sesi dimulai (Start), bukan saat boot.
}

// Mulai sesi log: buat file CSV baru.
void sdStartLog() {
  if (!state.sdReady) return;
  if (logFile) { logFile.flush(); logFile.close(); }
  openNewLog();
}

// Akhiri sesi log: tutup file.
void sdStopLog() {
  if (logFile) {
    logFile.flush();
    logFile.close();
    Serial.printf("[SD] Log closed: %s\n", logPath);
  }
}

void loopSDLogger() {
  if (!state.sdReady || !state.logging || !logFile) return;
  unsigned long now = millis();
  if (now - lastLogMs < LOG_INTERVAL_MS) return;
  lastLogMs = now;
  sdLogEntry();
}

void sdLogEntry() {
  if (!state.sdReady || !logFile) return;
  char ts[24];
  getTimestamp(ts, sizeof(ts));
  // CSV: Tanggal Jam, Actual, Setting
  logFile.printf("%s,%.1f,%.1f\n", ts, state.temperature, state.setpoint);
  logFile.flush();
  // Rotasi di 5MB
  if (logFile.size() > 5UL * 1024UL * 1024UL) {
    logFile.close();
    openNewLog();
  }
}

#else

void setupSDLogger() {}
void loopSDLogger() {}
void sdLogEntry() {}
void sdStartLog() {}
void sdStopLog() {}

#endif
