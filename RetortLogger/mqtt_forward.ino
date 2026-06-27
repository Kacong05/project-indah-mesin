// ============================================================
//  mqtt_forward.ino  –  Store-and-forward MQTT dari log SD
//  Tujuan: data tidak hilang saat jaringan/MQTT putus.
//  Aktif bila USE_STORE_FORWARD = true.
// ============================================================

extern AppConfig   cfg;
extern RetortState state;
extern Preferences prefs;
extern char gLastIso[26];
extern bool sdLock(uint32_t ms);
extern void sdUnlock();
extern bool mqttIsConnected();
extern bool mqttPublishRaw(const char* payload);
extern void mqttPublishState();
extern const char* sdCurrentLogPath();
extern float mvSimEffectivePercent();

#if USE_STORE_FORWARD && USE_SD

#include <SD.h>

#define K_FWD_PATH "fwd_path"
#define K_FWD_OFF  "fwd_off"
#define FWD_BURST_LIVE    5    // baris per tick saat live (≈1 dtk)
#define FWD_BURST_CATCHUP 50   // baris per tick saat mengejar backlog
#define FWD_SAVE_EVERY    5    // simpan offset ke NVS tiap N baris sukses

static char     gFwdPath[48] = {0};
static uint32_t gFwdOffset   = 0;
static uint16_t gFwdUnsaved  = 0;
volatile bool   gFwdHasBacklog = false;

static void fwdSaveOffset() {
  prefs.begin(PREF_NS, false);
  prefs.putString(K_FWD_PATH, gFwdPath);
  prefs.putUInt(K_FWD_OFF, gFwdOffset);
  prefs.end();
  gFwdUnsaved = 0;
}

static uint32_t fwdFileSize(const char* path) {
  if (!path || !path[0]) return 0;
  if (!sdLock(800)) return 0;
  File f = SD.open(path, FILE_READ);
  uint32_t sz = f ? f.size() : 0;
  if (f) f.close();
  sdUnlock();
  return sz;
}

static bool fwdHasPending() {
  if (gFwdPath[0] == '\0') return false;
  return gFwdOffset < fwdFileSize(gFwdPath);
}

void forwardSetup() {
  prefs.begin(PREF_NS, true);
  String p = prefs.getString(K_FWD_PATH, "");
  gFwdOffset = prefs.getUInt(K_FWD_OFF, 0);
  prefs.end();
  p.toCharArray(gFwdPath, sizeof(gFwdPath));
  gFwdHasBacklog = fwdHasPending();
  Serial.printf("[FWD] resume path=%s offset=%u pending=%s\n",
                gFwdPath[0] ? gFwdPath : "(none)", gFwdOffset,
                gFwdHasBacklog ? "yes" : "no");
}

static void fwdAdoptFile(const char* path) {
  strncpy(gFwdPath, path, sizeof(gFwdPath) - 1);
  gFwdPath[sizeof(gFwdPath) - 1] = '\0';
  gFwdOffset = 0;
  fwdSaveOffset();
  Serial.printf("[FWD] file baru: %s\n", gFwdPath);
}

// Parse "M/D/YYYY h:mm:ssAM" → ISO +07:00 (baris CSV lama tanpa kolom ISO).
static bool parseHumanTsToIso(const char* human, char* isoOut, size_t isoLen) {
  int mo = 0, d = 0, y = 0, h = 0, mi = 0, s = 0;
  char ampm[4] = {0};
  if (sscanf(human, "%d/%d/%d %d:%d:%d%3s", &mo, &d, &y, &h, &mi, &s, ampm) < 6)
    return false;
  if (ampm[0] == 'P' || ampm[0] == 'p') { if (h < 12) h += 12; }
  else if (ampm[0] == 'A' || ampm[0] == 'a') { if (h == 12) h = 0; }
  snprintf(isoOut, isoLen, "%04d-%02d-%02dT%02d:%02d:%02d+07:00", y, mo, d, h, mi, s);
  return true;
}

// Bangun payload JSON dari baris CSV (8 kolom penuh ATAU 3 kolom legacy).
static bool fwdBuildPayload(const char* line, char* out, size_t outLen) {
  char buf[180];
  strncpy(buf, line, sizeof(buf) - 1);
  buf[sizeof(buf) - 1] = '\0';

  char* fields[8] = {0};
  uint8_t n = 0;
  char* tok = strtok(buf, ",");
  while (tok && n < 8) {
    fields[n++] = tok;
    tok = strtok(NULL, ",");
  }
  if (n < 3) return false;

  char isoBuf[28];
  const char* iso;
  const char* phase;
  const char* actual = fields[1];
  const char* setting = fields[2];
  char mvStr[12];
  bool run;
  bool logging;

  if (n >= 8) {
    iso = fields[3];
    phase = fields[4];
    snprintf(mvStr, sizeof(mvStr), "%s", fields[5]);
    run = atoi(fields[6]) != 0;
    logging = atoi(fields[7]) != 0;
  } else {
    if (!parseHumanTsToIso(fields[0], isoBuf, sizeof(isoBuf))) return false;
    iso = isoBuf;
    phase = phaseName(state.phase);
    snprintf(mvStr, sizeof(mvStr), "%.1f", mvSimEffectivePercent());
    run = state.ctrlRun;
    logging = true;  // baris legacy = sesi rekam aktif
  }

  snprintf(out, outLen,
    "{\"id\":\"%s\",\"iso\":\"%s\",\"phase\":\"%s\","
    "\"actual\":%s,\"setting\":%s,\"mv\":%s,"
    "\"run\":%s,\"logging\":%s}",
    cfg.machineId, iso, phase,
    actual, setting, mvStr,
    run ? "true" : "false",
    logging ? "true" : "false");
  return true;
}

static int fwdReadLine(char* out, size_t outLen, uint32_t* nextOffset) {
  if (!sdLock(800)) return 0;

  File f = SD.open(gFwdPath, FILE_READ);
  if (!f) { sdUnlock(); return -1; }

  uint32_t size = f.size();
  if (gFwdOffset >= size) { f.close(); sdUnlock(); return 0; }

  f.seek(gFwdOffset);
  size_t i = 0;
  bool gotNewline = false;
  while (f.available() && i < outLen - 1) {
    char c = f.read();
    if (c == '\n') { gotNewline = true; break; }
    if (c != '\r') out[i++] = c;
  }
  out[i] = '\0';
  *nextOffset = f.position();
  f.close();
  sdUnlock();

  return gotNewline ? 1 : 0;
}

void forwardTick() {
  if (!mqttIsConnected()) {
    gFwdHasBacklog = fwdHasPending();
    return;
  }

  const char* livePath = sdCurrentLogPath();

  // Jangan buang file lama — selesaikan kirim backlog dulu baru adopsi file baru.
  if (livePath && livePath[0] && gFwdPath[0] != '\0' &&
      strcmp(livePath, gFwdPath) != 0 && !fwdHasPending()) {
    fwdAdoptFile(livePath);
  } else if (livePath && livePath[0] && gFwdPath[0] == '\0') {
    fwdAdoptFile(livePath);
  }

  if (gFwdPath[0] == '\0') {
    gFwdHasBacklog = false;
    mqttPublishState();
    return;
  }

  gFwdHasBacklog = fwdHasPending();
  uint8_t burstMax = gFwdHasBacklog ? FWD_BURST_CATCHUP : FWD_BURST_LIVE;

  char line[180];
  char payload[320];
  bool sentAny = false;

  for (uint8_t burst = 0; burst < burstMax; burst++) {
    uint32_t nextOffset = gFwdOffset;
    int r = fwdReadLine(line, sizeof(line), &nextOffset);
    if (r <= 0) break;

    if (strncmp(line, "Tanggal", 7) == 0) {
      gFwdOffset = nextOffset;
      if (++gFwdUnsaved >= FWD_SAVE_EVERY) fwdSaveOffset();
      continue;
    }

    if (!fwdBuildPayload(line, payload, sizeof(payload))) {
      Serial.printf("[FWD] skip parse fail: %.40s...\n", line);
      break;  // JANGAN maju offset — coba lagi tick berikutnya
    }

    if (!mqttPublishRaw(payload)) break;

    sentAny = true;
    gFwdOffset = nextOffset;
    if (++gFwdUnsaved >= FWD_SAVE_EVERY) fwdSaveOffset();
  }

  gFwdHasBacklog = fwdHasPending();

  if (!sentAny) {
    if (gFwdUnsaved > 0) fwdSaveOffset();
    if (!state.logging && !gFwdHasBacklog) mqttPublishState();
  }
}

#else

volatile bool gFwdHasBacklog = false;

void forwardSetup() {}
void forwardTick() { mqttPublishState(); }

#endif
