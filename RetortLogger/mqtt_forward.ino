// ============================================================
//  mqtt_forward.ino - Upload satu CSV lengkap setelah sesi selesai.
//  CSV asli dipertahankan; marker .ready dihapus hanya setelah ACK impor.
// ============================================================

extern AppConfig cfg;
extern RetortState state;
extern bool sdLock(uint32_t ms);
extern void sdUnlock();
extern bool mqttIsConnected();
extern bool mqttPublishTopic(const char* topic, const char* payload);

#if USE_STORE_FORWARD && USE_SD

#include <SD.h>
#include "mbedtls/base64.h"
#include "mbedtls/sha256.h"

#define CSV_META_TOPIC  "retort/csv/meta"
#define CSV_CHUNK_TOPIC "retort/csv/chunk"
#define CSV_END_TOPIC   "retort/csv/end"
#define CSV_CHUNK_BYTES 384
#define CSV_ACK_TIMEOUT_MS 180000UL
#define CSV_CHUNK_INTERVAL_MS 75UL

volatile bool gFwdHasBacklog = false;

static char gCsvPath[64] = {0};
static char gCsvMarker[72] = {0};
static char gCsvName[48] = {0};
static char gCsvSha256[65] = {0};
static char gCsvTransferId[24] = {0};
static uint32_t gCsvSize = 0;
static uint32_t gCsvOffset = 0;
static uint32_t gCsvChunk = 0;
static bool gCsvMetaSent = false;
static bool gCsvEndSent = false;
static unsigned long gCsvEndSentAt = 0;
static unsigned long gCsvLastSendAt = 0;

static void csvResetTransfer() {
  snprintf(gCsvTransferId, sizeof(gCsvTransferId), "%08lx%08lx",
           (unsigned long)millis(), (unsigned long)esp_random());
  gCsvOffset = 0;
  gCsvChunk = 0;
  gCsvMetaSent = false;
  gCsvEndSent = false;
  gCsvEndSentAt = 0;
}

static bool csvFindReady() {
  if (!state.sdReady || !sdLock(1200)) return false;
  File dir = SD.open("/retort");
  char selected[72] = {0};
  if (dir && dir.isDirectory()) {
    File entry = dir.openNextFile();
    while (entry) {
      const char* raw = entry.name();
      const char* base = strrchr(raw, '/');
      base = base ? base + 1 : raw;
      size_t len = strlen(base);
      if (!entry.isDirectory() && len > 6 && strcmp(base + len - 6, ".ready") == 0) {
        char candidate[72];
        snprintf(candidate, sizeof(candidate), "/retort/%s", base);
        if (!selected[0] || strcmp(candidate, selected) < 0) {
          strncpy(selected, candidate, sizeof(selected) - 1);
        }
      }
      entry.close();
      entry = dir.openNextFile();
    }
    dir.close();
  }
  sdUnlock();

  if (!selected[0]) return false;
  strncpy(gCsvMarker, selected, sizeof(gCsvMarker) - 1);
  strncpy(gCsvPath, selected, sizeof(gCsvPath) - 1);
  size_t pathLen = strlen(gCsvPath);
  gCsvPath[pathLen - 6] = '\0';
  const char* base = strrchr(gCsvPath, '/');
  strncpy(gCsvName, base ? base + 1 : gCsvPath, sizeof(gCsvName) - 1);
  csvResetTransfer();
  return true;
}

static bool csvPrepareMetadata() {
  if (!sdLock(2000)) return false;
  File file = SD.open(gCsvPath, FILE_READ);
  if (!file) {
    sdUnlock();
    return false;
  }

  gCsvSize = file.size();
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0);
  uint8_t buf[512];
  while (file.available()) {
    size_t count = file.read(buf, sizeof(buf));
    if (count) mbedtls_sha256_update(&ctx, buf, count);
  }
  uint8_t digest[32];
  mbedtls_sha256_finish(&ctx, digest);
  mbedtls_sha256_free(&ctx);
  file.close();
  sdUnlock();

  for (uint8_t i = 0; i < 32; i++) {
    snprintf(gCsvSha256 + (i * 2), 3, "%02x", digest[i]);
  }
  return gCsvSize > 0;
}

static bool csvSendMeta() {
  if (!gCsvSize && !csvPrepareMetadata()) return false;
  char payload[260];
  StaticJsonDocument<256> doc;
  doc["id"] = cfg.machineId;
  doc["file"] = gCsvName;
  doc["transfer_id"] = gCsvTransferId;
  doc["size"] = gCsvSize;
  doc["sha256"] = gCsvSha256;
  size_t payloadLen = serializeJson(doc, payload, sizeof(payload));
  if (!payloadLen || payloadLen >= sizeof(payload) - 1) {
    Serial.println(F("[CSV] gagal serialize metadata"));
    return false;
  }
  if (!mqttPublishTopic(CSV_META_TOPIC, payload)) return false;
  gCsvMetaSent = true;
  Serial.printf("[CSV] meta %s (%u byte)\n", gCsvName, (unsigned)gCsvSize);
  return true;
}

static bool csvSendChunk() {
  uint8_t raw[CSV_CHUNK_BYTES];
  size_t count = 0;
  if (!sdLock(1200)) return false;
  File file = SD.open(gCsvPath, FILE_READ);
  if (file) {
    file.seek(gCsvOffset);
    count = file.read(raw, sizeof(raw));
    file.close();
  }
  sdUnlock();
  if (!count) return false;

  unsigned char encoded[CSV_CHUNK_BYTES * 2];
  size_t encodedLen = 0;
  if (mbedtls_base64_encode(encoded, sizeof(encoded) - 1, &encodedLen, raw, count) != 0) {
    return false;
  }
  encoded[encodedLen] = '\0';

  char payload[768];
  StaticJsonDocument<768> doc;
  doc["id"] = cfg.machineId;
  doc["file"] = gCsvName;
  doc["transfer_id"] = gCsvTransferId;
  doc["index"] = gCsvChunk;
  doc["data"] = reinterpret_cast<const char*>(encoded);
  size_t payloadLen = serializeJson(doc, payload, sizeof(payload));
  if (!payloadLen || payloadLen >= sizeof(payload) - 1) {
    Serial.println(F("[CSV] gagal serialize chunk"));
    return false;
  }
  if (!mqttPublishTopic(CSV_CHUNK_TOPIC, payload)) return false;
  gCsvOffset += count;
  gCsvChunk++;
  return true;
}

static bool csvSendEnd() {
  char payload[180];
  StaticJsonDocument<256> doc;
  doc["id"] = cfg.machineId;
  doc["file"] = gCsvName;
  doc["transfer_id"] = gCsvTransferId;
  doc["size"] = gCsvSize;
  doc["sha256"] = gCsvSha256;
  size_t payloadLen = serializeJson(doc, payload, sizeof(payload));
  if (!payloadLen || payloadLen >= sizeof(payload) - 1) {
    Serial.println(F("[CSV] gagal serialize penutup"));
    return false;
  }
  if (!mqttPublishTopic(CSV_END_TOPIC, payload)) return false;
  gCsvEndSent = true;
  gCsvEndSentAt = millis();
  Serial.printf("[CSV] lengkap terkirim %s, tunggu ACK impor\n", gCsvName);
  return true;
}

void forwardSetup() {
  csvResetTransfer();
}

void forwardOnAck(const char* filename, const char* transferId, const char* status, const char* message) {
  if (!filename || strcmp(filename, gCsvName) != 0) return;
  if (!transferId || strcmp(transferId, gCsvTransferId) != 0) {
    Serial.printf("[CSV] ACK lama diabaikan: %s\n", filename);
    return;
  }
  if (status && strcmp(status, "processing") == 0) {
    gCsvEndSent = true;
    gCsvEndSentAt = millis();
    Serial.printf("[CSV] diterima server, proses impor: %s\n", gCsvName);
    return;
  }
  if (status && strcmp(status, "imported") == 0) {
    if (sdLock(1200)) {
      SD.remove(gCsvMarker);
      sdUnlock();
    }
    Serial.printf("[CSV] impor sukses: %s (file asli tetap di SD)\n", gCsvName);
    gCsvPath[0] = '\0';
    gCsvMarker[0] = '\0';
    gCsvName[0] = '\0';
    gCsvSize = 0;
    csvResetTransfer();
    gFwdHasBacklog = csvFindReady();
    return;
  }
  Serial.printf("[CSV] server menolak %s: %s, ulang dari awal\n",
                gCsvName, (message && message[0]) ? message : "tanpa keterangan");
  csvResetTransfer();
}

bool forwardIsWaitingAck() {
  return gCsvEndSent;
}

void forwardOnMqttLost() {
  if (gCsvPath[0]) csvResetTransfer();
}

void forwardTick() {
  if (state.logging || !state.sdReady) return;
  if (!gCsvPath[0] && !csvFindReady()) {
    gFwdHasBacklog = false;
    return;
  }
  gFwdHasBacklog = true;
  if (!mqttIsConnected()) return;

  if (gCsvEndSent) {
    if (millis() - gCsvEndSentAt >= CSV_ACK_TIMEOUT_MS) {
      Serial.println(F("[CSV] ACK timeout, upload ulang"));
      csvResetTransfer();
    }
    return;
  }
  if (millis() - gCsvLastSendAt < CSV_CHUNK_INTERVAL_MS) return;
  gCsvLastSendAt = millis();

  if (!gCsvMetaSent) {
    csvSendMeta();
  } else if (gCsvOffset < gCsvSize) {
    csvSendChunk();
  } else {
    csvSendEnd();
  }
}

#else

volatile bool gFwdHasBacklog = false;
void forwardSetup() {}
void forwardOnAck(const char*, const char*, const char*, const char*) {}
bool forwardIsWaitingAck() { return false; }
void forwardOnMqttLost() {}
void forwardTick() {}

#endif
