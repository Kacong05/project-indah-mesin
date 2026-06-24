// ============================================================
//  mqtt_client.ino  –  MQTT publish + subscribe + command handler
//  Library: PubSubClient (knolleary)
// ============================================================

#include <PubSubClient.h>

extern AppConfig   cfg;
extern RetortState state;

static WiFiClient   mqttWifi;
static PubSubClient mqtt(mqttWifi);

static unsigned long lastMqttReconnect = 0;
static const unsigned long MQTT_RECONNECT_MS = 5000;
static unsigned long lastMqttPublish = 0;
static const unsigned long MQTT_PUBLISH_MS = 2000;

// Forward declarations
void startProcess();
void stopProcess();

// --- Callback perintah MQTT ---
static void mqttCallback(char* topic, byte* payload, unsigned int len) {
  if (len == 0 || len > 64) return;
  char cmd[65];
  memcpy(cmd, payload, len);
  cmd[len] = '\0';

  Serial.printf("[MQTT] Cmd: %s\n", cmd);

  if (strcmp(cmd, "START") == 0) {
    startProcess();
  } else if (strcmp(cmd, "STOP") == 0) {
    stopProcess();
  } else if (strcmp(cmd, "STATUS") == 0) {
    mqttPublishState();
  } else {
    Serial.printf("[MQTT] Unknown: %s\n", cmd);
  }
}

// --- Reconnect ---
static bool mqttReconnect() {
  if (WiFi.status() != WL_CONNECTED) return false;
  Serial.printf("[MQTT] Connecting %s:%d ...\n", cfg.mqttBroker, cfg.mqttPort);

  bool ok;
  if (cfg.mqttUser[0] != '\0') {
    ok = mqtt.connect(cfg.machineId, cfg.mqttUser, cfg.mqttPass);
  } else {
    ok = mqtt.connect(cfg.machineId);
  }

  if (ok) {
    mqtt.subscribe(cfg.mqttCmdTopic);
    state.mqttConnected = true;
    Serial.printf("[MQTT] Connected. Sub: %s\n", cfg.mqttCmdTopic);
  } else {
    state.mqttConnected = false;
    Serial.printf("[MQTT] Failed rc=%d\n", mqtt.state());
  }
  return ok;
}

// --- Public API ---
void setupMQTT() {
  if (cfg.mqttBroker[0] == '\0') {
    Serial.println(F("[MQTT] No broker configured – disabled."));
    return;
  }
  mqtt.setServer(cfg.mqttBroker, cfg.mqttPort);
  mqtt.setCallback(mqttCallback);
  mqtt.setKeepAlive(30);
  mqtt.setBufferSize(512);
}

void loopMQTT() {
  if (cfg.mqttBroker[0] == '\0') return;

  if (!mqtt.connected()) {
    state.mqttConnected = false;
    unsigned long now = millis();
    if (now - lastMqttReconnect >= MQTT_RECONNECT_MS) {
      lastMqttReconnect = now;
      mqttReconnect();
    }
    return;
  }
  mqtt.loop();

  // Periodic publish
  unsigned long now = millis();
  if (now - lastMqttPublish >= MQTT_PUBLISH_MS) {
    lastMqttPublish = now;
    mqttPublishState();
  }
}

void mqttPublishState() {
  if (!mqtt.connected()) return;

  char ts[24];
  getTimestamp(ts, sizeof(ts));

  char buf[256];
  int n = snprintf(buf, sizeof(buf),
    "{\"id\":\"%s\",\"ts\":\"%s\",\"phase\":\"%s\","
    "\"temp\":%.2f,\"pres\":%.3f,\"target\":%.1f}",
    cfg.machineId, ts, phaseName(state.phase),
    state.temperature, state.pressure, cfg.targetTemp);

  if (n > 0 && n < (int)sizeof(buf)) {
    mqtt.publish(cfg.mqttPubTopic, buf, false);
  }
}
