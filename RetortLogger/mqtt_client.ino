// ============================================================
//  mqtt_client.ino  –  MQTT publish + subscribe + commands
//  Library: PubSubClient
// ============================================================

#include <PubSubClient.h>

extern AppConfig   cfg;
extern RetortState state;
extern int gLastMqttState;

static WiFiClient   mqttWifi;
static PubSubClient mqtt(mqttWifi);

static unsigned long lastRecon = 0;
static unsigned long lastPub = 0;

static void mqttCb(char* topic, byte* payload, unsigned int len) {
  if (len == 0 || len > 64) return;
  char cmd[65];
  memcpy(cmd, payload, len);
  cmd[len] = '\0';
  Serial.printf("[MQTT] Cmd: %s\n", cmd);

  // Format: START, STOP, STATUS atau START:RT-001 (hanya mesin yang cocok)
  char* colon = strchr(cmd, ':');
  if (colon) {
    *colon = '\0';
    if (strcasecmp(colon + 1, cfg.machineId) != 0) {
      Serial.printf("[MQTT] Cmd ignored (target %s, this %s)\n", colon + 1, cfg.machineId);
      return;
    }
  }

  if (strcmp(cmd, "START") == 0) startProcess();
  else if (strcmp(cmd, "STOP") == 0) stopProcess();
  else if (strcmp(cmd, "STATUS") == 0) mqttPublishState();
}

static bool mqttRecon() {
  if (WiFi.status() != WL_CONNECTED) return false;
  bool ok;
  if (cfg.mqttUser[0]) ok = mqtt.connect(cfg.machineId, cfg.mqttUser, cfg.mqttPass);
  else ok = mqtt.connect(cfg.machineId);
  if (ok) {
    mqtt.subscribe(cfg.mqttCmdTopic);
    state.mqttConnected = true;
    gLastMqttState = 0;
    Serial.printf("[MQTT] Connected. Sub: %s\n", cfg.mqttCmdTopic);
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
  mqtt.setBufferSize(512);
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
  if (now - lastPub >= 2000) { lastPub = now; mqttPublishState(); }
}

void mqttPublishState() {
  if (!mqtt.connected()) return;
  char ts[24];
  getTimestamp(ts, sizeof(ts));
  char buf[256];
  snprintf(buf, sizeof(buf),
    "{\"id\":\"%s\",\"ts\":\"%s\",\"phase\":\"%s\","
    "\"actual\":%.1f,\"setting\":%.1f,\"logging\":%s}",
    cfg.machineId, ts, phaseName(state.phase),
    state.temperature, state.setpoint,
    state.logging ? "true" : "false");
  mqtt.publish(cfg.mqttPubTopic, buf, false);
}
