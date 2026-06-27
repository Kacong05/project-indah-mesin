// ============================================================
//  mqtt_forward.ino  –  Store-and-forward MQTT dari log SD
//  Offset NVS hanya maju setelah ACK dari bridge (retort/ack).
//  Tanpa ACK: data bisa hilang di web walau mqtt.publish() sukses.
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
#define FWD_ACK_TIMEOUT_MS 7000
#define FWD_ACK_MAX_RETRIES 2
#define FWD_POST_ACK_BURST  10      // setelah ack ISO cocok → kirim N baris tanpa tunggu
#define FWD_SAVE_EVERY      1

static char     gFwdPath[48] = {0};
static uint32_t gFwdOffset   = 0;
static uint16_t gFwdUnsaved  = 0;
volatile bool   gFwdHasBacklog = false;

static bool          gFwdWaitingAck = false;
static uint32_t      gFwdPendingOffset = 0;
static char          gFwdPendingIso[28] = {0};
static char          gFwdPendingPayload[340] = {0};
static unsigned long gFwdPendingSince = 0;
static uint8_t       gFwdAckRetries = 0;
static uint8_t       gFwdPostAckBurst = 0;  // sisa quota kirim tanpa tunggu setelah ack ISO

static void fwdSaveOffset() {
  prefs.begin(PREF_NS, false);
  prefs.putString(K_FWD_PATH, gFwdPath);
  prefs.putUInt(K_FWD_OFF, gFwdOffset);
  prefs.end();
  gFwdUnsaved = 0;
}

static uint32_t fwdFileSize(const char* path) {
  if (!path || !path[0]) return 0;
  if (!sdLock(1200)) return 0;
  File f = SD.open(path, FILE_READ);
  uint32_t sz = f ? f.size() : 0;
  if (f) f.close();
  sdUnlock();
  return sz;
}

static bool fwdHasPending() {
  if (gFwdPath[0] == '\0') return false;
  if (gFwdWaitingAck) return true;
  return gFwdOffset < fwdFileSize(gFwdPath);
}

static void fwdSchedulePostAckBurst() {
  gFwdPostAckBurst = FWD_POST_ACK_BURST;
}

void forwardSetup() {
  prefs.begin(PREF_NS, true);
  String p = prefs.getString(K_FWD_PATH, "");
  gFwdOffset = prefs.getUInt(K_FWD_OFF, 0);
  prefs.end();
  p.toCharArray(gFwdPath, sizeof(gFwdPath));
  gFwdWaitingAck = false;
  gFwdHasBacklog = fwdHasPending();
  Serial.printf("[FWD] resume path=%s offset=%u pending=%s\n",
                gFwdPath[0] ? gFwdPath : "(none)", gFwdOffset,
                gFwdHasBacklog ? "yes" : "no");
}

// Dipanggil dari mqtt_client saat bridge kirim retort/ack setelah simpan DB.
bool forwardIsWaitingAck() { return gFwdWaitingAck; }

// MQTT putus saat tunggu ACK → jangan macet 7–14s; ulang dari offset NVS (burst catch-up).
void forwardOnMqttLost() {
  if (!gFwdWaitingAck) return;
  Serial.println(F("[FWD] mqtt lost — batalkan tunggu ACK, lanjut burst"));
  gFwdWaitingAck = false;
  gFwdAckRetries = 0;
  gFwdPendingIso[0] = '\0';
  gFwdPostAckBurst = 0;
  gFwdHasBacklog = fwdHasPending();
}

static bool fwdIsoSameSecond(const char* a, const char* b) {
  if (!a || !b || !a[0] || !b[0]) return false;
  if (strcmp(a, b) == 0) return true;
  // Cocokkan per detik (abaikan microsecond / variasi timezone suffix).
  if (strlen(a) >= 19 && strlen(b) >= 19 && strncmp(a, b, 19) == 0) return true;
  return false;
}

void forwardOnAck(const char* iso) {
  if (!gFwdWaitingAck || !iso || iso[0] == '\0') return;
  if (!fwdIsoSameSecond(iso, gFwdPendingIso)) {
    Serial.printf("[FWD] ack mismatch got=%s pending=%s\n", iso, gFwdPendingIso);
    return;
  }

  gFwdOffset = gFwdPendingOffset;
  gFwdWaitingAck = false;
  gFwdAckRetries = 0;
  gFwdPendingIso[0] = '\0';
  fwdSaveOffset();
  gFwdHasBacklog = fwdHasPending();
  fwdSchedulePostAckBurst();
  Serial.printf("[FWD] ack OK %s → offset %u, burst %u\n",
                iso, gFwdOffset, (unsigned)FWD_POST_ACK_BURST);
}

#if USE_MQTT_ACK

static void fwdAdvanceWithoutAck() {
  Serial.printf("[FWD] no ack — maju offset anyway (cek bridge/ACL retort/ack)\n");
  gFwdOffset = gFwdPendingOffset;
  gFwdWaitingAck = false;
  gFwdAckRetries = 0;
  gFwdPendingIso[0] = '\0';
  fwdSaveOffset();
  gFwdHasBacklog = fwdHasPending();
  fwdSchedulePostAckBurst();
}

#endif

static void fwdAdoptFile(const char* path) {
  if (gFwdWaitingAck) return;  // selesaikan pending dulu
  strncpy(gFwdPath, path, sizeof(gFwdPath) - 1);
  gFwdPath[sizeof(gFwdPath) - 1] = '\0';
  gFwdOffset = 0;
  fwdSaveOffset();
  Serial.printf("[FWD] file baru: %s\n", gFwdPath);
}

static bool parseWibClockToIso(const char* wib, char* isoOut, size_t isoLen) {
  int d = 0, mo = 0, y = 0, h = 0, mi = 0, s = 0;
  if (sscanf(wib, "%d-%d-%d %d:%d:%d", &d, &mo, &y, &h, &mi, &s) < 6)
    return false;
  snprintf(isoOut, isoLen, "%04d-%02d-%02dT%02d:%02d:%02d+07:00", y, mo, d, h, mi, s);
  return true;
}

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

// Bangun payload; simpan iso ke isoOut untuk matching ack.
static bool fwdBuildPayload(const char* line, char* out, size_t outLen,
                            char* isoOut, size_t isoLen) {
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
    if (parseWibClockToIso(fields[0], isoBuf, sizeof(isoBuf))) iso = isoBuf;
    else if (!parseHumanTsToIso(fields[0], isoBuf, sizeof(isoBuf))) return false;
    else iso = isoBuf;
    phase = phaseName(state.phase);
    snprintf(mvStr, sizeof(mvStr), "%.1f", mvSimEffectivePercent());
    run = state.ctrlRun;
    logging = true;
  }

  strncpy(isoOut, iso, isoLen - 1);
  isoOut[isoLen - 1] = '\0';

  char ps[8];
  tnlFormatPs(ps, sizeof(ps));

  snprintf(out, outLen,
    "{\"id\":\"%s\",\"iso\":\"%s\",\"phase\":\"%s\","
    "\"actual\":%s,\"setting\":%s,\"mv\":%s,"
    "\"ps\":\"%s\",\"tot\":\"%s\",\"stp\":\"%s\","
    "\"pattern\":%u,\"step\":%u,"
    "\"run\":%s,\"logging\":%s,\"backfill\":true}",
    cfg.machineId, iso, phase,
    actual, setting, mvStr,
    ps, state.totMs, state.stpMs,
    (unsigned)state.pattern, (unsigned)state.step,
    run ? "true" : "false",
    logging ? "true" : "false");
  return true;
}

static int fwdReadLine(char* out, size_t outLen, uint32_t fromOffset, uint32_t* nextOffset) {
  if (!sdLock(1200)) return 0;

  File f = SD.open(gFwdPath, FILE_READ);
  if (!f) { sdUnlock(); return -1; }

  uint32_t size = f.size();
  if (fromOffset >= size) { f.close(); sdUnlock(); return 0; }

  f.seek(fromOffset);
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

static bool fwdSendOneLine(bool waitAck) {
  char line[180];
  char payload[340];
  char iso[28];
  uint32_t nextOffset = gFwdOffset;

  for (;;) {
    int r = fwdReadLine(line, sizeof(line), gFwdOffset, &nextOffset);
    if (r <= 0) return false;

    if (strncmp(line, "Tanggal", 7) == 0) {
      gFwdOffset = nextOffset;
      fwdSaveOffset();
      continue;
    }

    if (!fwdBuildPayload(line, payload, sizeof(payload), iso, sizeof(iso))) {
      Serial.printf("[FWD] parse fail: %.40s\n", line);
      return false;
    }

    if (!mqttPublishRaw(payload)) return false;

#if USE_MQTT_ACK
    if (waitAck) {
      gFwdWaitingAck = true;
      gFwdPendingOffset = nextOffset;
      gFwdAckRetries = 0;
      strncpy(gFwdPendingIso, iso, sizeof(gFwdPendingIso) - 1);
      gFwdPendingIso[sizeof(gFwdPendingIso) - 1] = '\0';
      strncpy(gFwdPendingPayload, payload, sizeof(gFwdPendingPayload) - 1);
      gFwdPendingSince = millis();
    } else {
      gFwdOffset = nextOffset;
      fwdSaveOffset();
    }
#else
    gFwdOffset = nextOffset;
    if (++gFwdUnsaved >= FWD_SAVE_EVERY) fwdSaveOffset();
#endif
    return true;
  }
}

void forwardTick() {
  if (!mqttIsConnected()) {
    gFwdHasBacklog = fwdHasPending();
    return;
  }

  const char* livePath = sdCurrentLogPath();

  if (!gFwdWaitingAck && livePath && livePath[0] && gFwdPath[0] != '\0' &&
      strcmp(livePath, gFwdPath) != 0 && !fwdHasPending()) {
    fwdAdoptFile(livePath);
  } else if (!gFwdWaitingAck && livePath && livePath[0] && gFwdPath[0] == '\0') {
    fwdAdoptFile(livePath);
  }

  if (gFwdPath[0] == '\0') {
    gFwdHasBacklog = false;
    if (!gFwdWaitingAck) mqttPublishState();
    return;
  }

  // Tunggu ack bridge; timeout → retry, lalu maju offset (anti macet selamanya)
  if (gFwdWaitingAck) {
#if USE_MQTT_ACK
    if (millis() - gFwdPendingSince < FWD_ACK_TIMEOUT_MS) return;
    gFwdAckRetries++;
    if (gFwdAckRetries >= FWD_ACK_MAX_RETRIES) {
      fwdAdvanceWithoutAck();
      return;
    }
    Serial.printf("[FWD] ack timeout %s — retry %u/%u\n",
                  gFwdPendingIso, gFwdAckRetries, FWD_ACK_MAX_RETRIES);
    mqttPublishRaw(gFwdPendingPayload);
    gFwdPendingSince = millis();
#else
    fwdAdvanceWithoutAck();
#endif
    return;
  }

  gFwdHasBacklog = fwdHasPending();

  // Setelah ack ISO (atau timeout): kirim quota baris tanpa tunggu, lalu jangkar berikutnya.
  if (gFwdPostAckBurst > 0 && gFwdHasBacklog) {
    uint8_t sent = 0;
    while (gFwdPostAckBurst > 0) {
      if (!fwdSendOneLine(false)) break;
      gFwdPostAckBurst--;
      sent++;
      gFwdHasBacklog = fwdHasPending();
      if (!gFwdHasBacklog) break;
    }
    if (sent >= 1) {
      Serial.printf("[FWD] post-ack %u baris (sisa quota %u)\n", sent, gFwdPostAckBurst);
    }
    if (gFwdHasBacklog && gFwdPostAckBurst == 0) {
      if (fwdSendOneLine(true)) {
        Serial.println(F("[FWD] anchor → tunggu ack ISO"));
      }
    }
    return;
  }

  if (gFwdHasBacklog) {
    if (fwdSendOneLine(true)) {
      Serial.println(F("[FWD] anchor → tunggu ack ISO"));
    }
    return;
  }

  gFwdPostAckBurst = 0;
  if (!state.logging && !gFwdHasBacklog) mqttPublishState();
}

#else

volatile bool gFwdHasBacklog = false;

void forwardSetup() {}
void forwardOnAck(const char*) {}
bool forwardIsWaitingAck() { return false; }
void forwardOnMqttLost() {}
void forwardTick() { mqttPublishState(); }

#endif
