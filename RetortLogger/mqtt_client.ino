// ============================================================
//  mqtt_client.ino  –  MQTT publish + subscribe + commands + ack
//  Library: PubSubClient
// ============================================================

#include <PubSubClient.h>

extern AppConfig   cfg;
extern RetortState state;
extern int gLastMqttState;
extern char gLastTs[32];
extern char gLastIso[26];

extern volatile bool gFwdHasBacklog;

static WiFiClient   mqttWifi;
static PubSubClient mqtt(mqttWifi);

// Cepat dulu (3s), naik ke sedang (8s) setelah gagal berulang; timeout socket titik tengah 6s.
#define MQTT_SOCKET_TIMEOUT_S   6
#define MQTT_RECON_FAST_MS      3000
#define MQTT_RECON_MED_MS       8000
#define MQTT_FAIL_TO_MED        4

static unsigned long lastRecon = 0;
static unsigned long lastPub   = 0;
static uint8_t       mqttFailStreak = 0;

static unsigned long mqttReconIntervalMs() {
  return (mqttFailStreak >= MQTT_FAIL_TO_MED) ? MQTT_RECON_MED_MS : MQTT_RECON_FAST_MS;
}

static void mqttHandleAck(const char* json) {
  const char* p = strstr(json, "\"iso\":\"");
  if (!p) return;
  p += 7;
  const char* end = strchr(p, '"');
  if (!end || (size_t)(end - p) >= 28) return;
  char iso[28] = {0};
  memcpy(iso, p, end - p);
  forwardOnAck(iso);
#if USE_STORE_FORWARD
  // Langsung pump batch post-ack (10 baris) tanpa nunggu loop berikutnya.
  for (uint8_t i = 0; i < 3 && gFwdHasBacklog && !forwardIsWaitingAck(); i++) {
    forwardTick();
  }
#endif
}

static void mqttCb(char* topic, byte* payload, unsigned int len) {
  if (len == 0 || len > 320) return;
  char buf[321];
  memcpy(buf, payload, len);
  buf[len] = '\0';

  if (strcmp(topic, MQTT_ACK_TOPIC) == 0) {
    mqttHandleAck(buf);
    return;
  }

  if (strcmp(topic, cfg.mqttCmdTopic) != 0) return;

  Serial.printf("[MQTT] Cmd: %s\n", buf);

  char* colon = strchr(buf, ':');
  if (colon) {
    *colon = '\0';
    if (strcasecmp(colon + 1, cfg.machineId) != 0) {
      Serial.printf("[MQTT] Cmd ignored (target %s, this %s)\n", colon + 1, cfg.machineId);
      return;
    }
  }

  if (strcmp(buf, "START") == 0) startProcess();
  else if (strcmp(buf, "STOP") == 0) stopProcess();
  else if (strcmp(buf, "STATUS") == 0) mqttPublishState();
}

static bool mqttRecon() {
  if (WiFi.status() != WL_CONNECTED) return false;
  bool ok;
  if (cfg.mqttUser[0]) ok = mqtt.connect(cfg.machineId, cfg.mqttUser, cfg.mqttPass);
  else ok = mqtt.connect(cfg.machineId);
  if (ok) {
    mqttFailStreak = 0;
    mqtt.subscribe(cfg.mqttCmdTopic);
    mqtt.subscribe(MQTT_ACK_TOPIC);
    state.mqttConnected = true;
    gLastMqttState = 0;
    Serial.printf("[MQTT] Connected. Sub: %s + %s\n", cfg.mqttCmdTopic, MQTT_ACK_TOPIC);
  } else {
    if (mqttFailStreak < 255) mqttFailStreak++;
    state.mqttConnected = false;
    gLastMqttState = mqtt.state();
    Serial.printf("[MQTT] Gagal, state=%d (broker=%s:%d, retry=%us)\n",
                  gLastMqttState, cfg.mqttBroker, cfg.mqttPort,
                  (unsigned)(mqttReconIntervalMs() / 1000));
  }
  return ok;
}

void setupMQTT() {
  if (cfg.mqttBroker[0] == '\0') {
    Serial.println(F("[MQTT] No broker – disabled."));
    return;
  }
  mqtt.setServer(cfg.mqttBroker, cfg.mqttPort);
  mqtt.setCallback(mqttCb);
  mqtt.setKeepAlive(30);
  mqtt.setBufferSize(768);
  mqtt.setSocketTimeout(MQTT_SOCKET_TIMEOUT_S);
  // Percobaan connect pertama segera setelah WiFi siap (tanpa tunggu interval).
  lastRecon = millis() - mqttReconIntervalMs();
}

void loopMQTT() {
  if (cfg.mqttBroker[0] == '\0') return;
  if (!mqtt.connected()) {
    state.mqttConnected = false;
#if USE_STORE_FORWARD
    forwardOnMqttLost();
#endif
    unsigned long now = millis();
    if (now - lastRecon >= mqttReconIntervalMs()) { lastRecon = now; mqttRecon(); }
    return;
  }
  mqtt.loop();
  unsigned long now = millis();
  if (!gFwdHasBacklog && !forwardIsWaitingAck() && (now - lastPub < 1000)) return;
  lastPub = now;

#if USE_STORE_FORWARD
  forwardTick();
#else
  mqttPublishState();
#endif
}

bool mqttIsConnected() { return mqtt.connected(); }

bool mqttPublishRaw(const char* payload) {
  if (!mqtt.connected()) return false;
  return mqtt.publish(cfg.mqttPubTopic, payload, false);
}

void mqttPublishState() {
  if (!mqtt.connected()) return;
  char ps[8];
  tnlFormatPs(ps, sizeof(ps));
  char buf[460];
  snprintf(buf, sizeof(buf),
    "{\"id\":\"%s\",\"ts\":\"%s\",\"iso\":\"%s\",\"phase\":\"%s\","
    "\"actual\":%.1f,\"setting\":%.1f,\"mv\":%.1f,"
    "\"ps\":\"%s\",\"tot\":\"%s\",\"stp\":\"%s\","
    "\"pattern\":%u,\"step\":%u,"
    "\"run\":%s,\"logging\":%s,\"backfill\":false}",
    cfg.machineId, gLastTs, gLastIso, phaseName(state.phase),
    state.temperature, state.setpoint, mvSimEffectivePercent(),
    ps, state.totMs, state.stpMs,
    (unsigned)state.pattern, (unsigned)state.step,
    state.ctrlRun ? "true" : "false",
    state.logging ? "true" : "false");
  mqtt.publish(cfg.mqttPubTopic, buf, false);
}
