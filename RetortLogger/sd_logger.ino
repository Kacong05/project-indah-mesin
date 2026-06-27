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
extern volatile bool gLogStartReq;
extern volatile bool gLogStopReq;
extern char gLastTs[24];
extern char gLastIso[26];
extern bool sdLock(uint32_t ms);
extern void sdUnlock();
extern float mvSimEffectivePercent();
extern const char* phaseName(RetortPhase p);

#define SD_LOG_DIR "/retort"

static File logFile;
static char logPath[48] = {0};

// Path file log aktif (untuk store-and-forward MQTT). "" jika belum ada.
const char* sdCurrentLogPath() { return logPath; }

static void ensureDir() {
  if (!SD.exists(SD_LOG_DIR)) SD.mkdir(SD_LOG_DIR);
}

static void openNewLog() {
  // Nama file sortable & tak ambigu: "YYYYMMDD_HHMMSS.csv" (24 jam).
  // Aman dibaca RTC di sini karena openNewLog dipanggil dari loggerTask
  // (task yang sama yang memiliki akses I2C/RTC → tak ada race).
  char clean[20] = {0};
  getTimestampFile(clean, sizeof(clean));
  if (clean[0] == '\0') snprintf(clean, sizeof(clean), "%lu", millis());
  snprintf(logPath, sizeof(logPath), "%s/%s.csv", SD_LOG_DIR, clean);
  ensureDir();
  logFile = SD.open(logPath, FILE_APPEND);
  if (logFile) {
    if (logFile.size() == 0) {
      // Kolom 1-3 (Tanggal Jam, Actual, Setting) dipertahankan agar kompatibel
      // dengan pembaca lama; kolom tambahan dipakai store-and-forward MQTT.
      logFile.println(F("Tanggal Jam,Actual,Setting,ISO,Phase,MV,Run,Logging"));
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
  ensureDir();
  uint64_t t = SD.totalBytes();
  uint64_t u = SD.usedBytes();
  Serial.printf("[SD] OK. Total=%lluMB Free=%lluMB\n",
                t / 1048576ULL, (t - u) / 1048576ULL);
  // File log dibuka saat sesi dimulai (Start), bukan saat boot.
}

// Mulai/akhiri sesi log dipanggil dari web/MQTT (core lain). JANGAN sentuh SD
// di sini — cukup set flag. Pembukaan/penutupan file dilakukan task logger
// (lewat sdServiceLog) agar SEMUA akses SD terjadi di satu konteks.
void sdStartLog() { gLogStartReq = true; }
void sdStopLog()  { gLogStopReq  = true; }

// loop() utama tidak lagi menulis SD (pindah ke task logger).
void loopSDLogger() {}

// Tulis satu baris CSV. Dipanggil sdServiceLog (sudah memegang kunci SD).
void sdLogEntry() {
  if (!state.sdReady || !logFile) return;
  // CSV: Tanggal Jam, Actual, Setting, ISO, Phase, MV, Run, Logging
  // ISO + Phase + MV + Run + Logging dipakai forwarder untuk merekonstruksi
  // payload MQTT identik dengan publish live (recorded_at = ISO baris ini).
  logFile.printf("%s,%.1f,%.1f,%s,%s,%.1f,%d,%d\n",
                 gLastTs, state.temperature, state.setpoint,
                 gLastIso, phaseName(state.phase), mvSimEffectivePercent(),
                 state.ctrlRun ? 1 : 0, state.logging ? 1 : 0);
  logFile.flush();
  // Rotasi di 5MB
  if (logFile.size() > 5UL * 1024UL * 1024UL) {
    logFile.close();
    openNewLog();
  }
}

// Dipanggil tiap 1 detik dari loggerTask. Menangani start/stop rekam dan
// menulis baris CSV, SEMUA di bawah kunci SD (aman terhadap akses web).
void sdServiceLog() {
  if (!state.sdReady) return;
  if (!sdLock(800)) return;  // bus dipakai web sebentar → coba siklus berikutnya

  if (gLogStartReq) {
    gLogStartReq = false;
    if (logFile) { logFile.flush(); logFile.close(); }
    openNewLog();
  }
  if (gLogStopReq) {
    gLogStopReq = false;
    if (logFile) {
      logFile.flush();
      logFile.close();
      Serial.printf("[SD] Log closed: %s\n", logPath);
    }
  }
  if (state.logging && logFile) {
    sdLogEntry();
  }

  sdUnlock();
}

#else

void setupSDLogger() {}
void loopSDLogger() {}
void sdLogEntry() {}
void sdServiceLog() {}
void sdStartLog() {}
void sdStopLog() {}

#endif
