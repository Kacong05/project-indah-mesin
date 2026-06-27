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

static unsigned long lastRecon = 0;
static unsigned long lastPub = 0;

static void mqttHandleAck(const char* json) {
  const char* p = strstr(json, "\"iso\":\"");
  if (!p) return;
  p += 7;
  const char* end = strchr(p, '"');
  if (!end || (size_t)(end - p) >= 28) return;
  char iso[28] = {0};
  memcpy(iso, p, end - p);
  forwardOnAck(iso);
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
    mqtt.subscribe(cfg.mqttCmdTopic);
    mqtt.subscribe(MQTT_ACK_TOPIC);
    state.mqttConnected = true;
    gLastMqttState = 0;
    Serial.printf("[MQTT] Connected. Sub: %s + %s\n", cfg.mqttCmdTopic, MQTT_ACK_TOPIC);
  } else {
    state.mqttConnected = false;
    gLastMqttState = mqtt.state();
    Serial.printf("[MQTT] Gagal, state=%d (broker=%s:%d)\n",
                  gLastMqttState, cfg.mqttBroker, cfg.mqttPort);
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
  mqtt.setSocketTimeout(2);
}

void loopMQTT() {
  if (cfg.mqttBroker[0] == '\0') return;
  if (!mqtt.connected()) {
    state.mqttConnected = false;
    unsigned long now = millis();
    if (now - lastRecon >= 5000) { lastRecon = now; mqttRecon(); }
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
  char buf[420];
  snprintf(buf, sizeof(buf),
    "{\"id\":\"%s\",\"ts\":\"%s\",\"iso\":\"%s\",\"phase\":\"%s\","
    "\"actual\":%.1f,\"setting\":%.1f,\"mv\":%.1f,"
    "\"ps\":\"%s\",\"tot\":\"%s\",\"stp\":\"%s\","
    "\"run\":%s,\"logging\":%s}",
    cfg.machineId, gLastTs, gLastIso, phaseName(state.phase),
    state.temperature, state.setpoint, mvSimEffectivePercent(),
    ps, state.totMs, state.stpMs,
    state.ctrlRun ? "true" : "false",
    state.logging ? "true" : "false");
  mqtt.publish(cfg.mqttPubTopic, buf, false);
}
