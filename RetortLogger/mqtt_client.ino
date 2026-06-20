// ============================================================
//  mqtt_client.ino  –  MQTT publish + subscribe + commands
//  Library: PubSubClient (knolleary)
// ============================================================

#include <PubSubClient.h>
#include <WiFi.h>

extern AppConfig   cfg;
extern RetortState retort;

static WiFiClient   wifiClient;
static PubSubClient mqttClient(wifiClient);

static char mqttPayloadBuf[256];
static uint32_t lastReconnectMs = 0;
#define MQTT_RECONNECT_INTERVAL_MS 5000

// ---- MQTT command handler ----------------------------------
// Commands arrive on cfg.mqttTopicCmd
// Payload: plain text keyword
static void onMqttMessage(char* topic, byte* payload, unsigned int len) {
  if (len == 0 || len >= sizeof(mqttPayloadBuf)) return;

  memcpy(mqttPayloadBuf, payload, len);
  mqttPayloadBuf[len] = '\0';

  Serial.printf("[MQTT] CMD topic=%s payload=%s\n", topic, mqttPayloadBuf);
  mqttHandleCommand(topic, mqttPayloadBuf);
}

// ---- Connect / reconnect -----------------------------------
static bool mqttReconnect() {
  if (!wifiConnected()) return false;

  Serial.printf("[MQTT] Connecting to %s:%d ...\n", cfg.mqttHost, cfg.mqttPort);

  bool ok;
  if (cfg.mqttUser[0] != '\0') {
    ok = mqttClient.connect(cfg.deviceID, cfg.mqttUser, cfg.mqttPass);
  } else {
    ok = mqttClient.connect(cfg.deviceID);
  }

  if (ok) {
    mqttClient.subscribe(cfg.mqttTopicCmd);
    Serial.printf("[MQTT] Connected. Subscribed to %s\n", cfg.mqttTopicCmd);
  } else {
    Serial.printf("[MQTT] Failed rc=%d\n", mqttClient.state());
  }
  return ok;
}

// ---- Public API --------------------------------------------
void mqttSetup() {
  if (cfg.mqttHost[0] == '\0') {
    Serial.println(F("[MQTT] No broker host configured – MQTT disabled."));
    return;
  }
  mqttClient.setServer(cfg.mqttHost, cfg.mqttPort);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setKeepAlive(30);
  mqttClient.setBufferSize(512);
}

void mqttLoop() {
  if (cfg.mqttHost[0] == '\0') return;

  if (!mqttClient.connected()) {
    uint32_t now = millis();
    if (now - lastReconnectMs >= MQTT_RECONNECT_INTERVAL_MS) {
      lastReconnectMs = now;
      mqttReconnect();
    }
    return;
  }
  mqttClient.loop();
}

// Publish retort state as JSON
// Topic: cfg.mqttTopicPub
// Payload: {"id":"retort_XXXX","ts":"...","phase":1,"temp":85.3,"sp":121.0,"running":true}
void mqttPublish(const RetortState* s) {
  if (!mqttClient.connected()) return;

  int n = snprintf(mqttPayloadBuf, sizeof(mqttPayloadBuf),
    "{\"id\":\"%s\",\"ts\":\"%s\",\"phase\":%d,"
    "\"temp\":%.2f,\"sp\":%.2f,\"running\":%s}",
    cfg.deviceID,
    s->timestamp,
    s->phase,
    s->tempC,
    s->setpoint,
    s->running ? "true" : "false");

  if (n > 0 && n < (int)sizeof(mqttPayloadBuf)) {
    mqttClient.publish(cfg.mqttTopicPub, mqttPayloadBuf, false);
  }
}

// Process commands from MQTT
void mqttHandleCommand(const char* topic, const char* payload) {
  // "START"  – begin retort process
  // "STOP"   – abort process
  // "STATUS" – publish current state immediately
  // "REPLAY" – replay last SD session (if USE_SD)

  if (strcmp(payload, "START") == 0) {
    simStartProcess(&retort);
  } else if (strcmp(payload, "STOP") == 0) {
    simStopProcess(&retort);
  } else if (strcmp(payload, "STATUS") == 0) {
    mqttPublish(&retort);
  } else if (strcmp(payload, "REPLAY") == 0) {
#if USE_SD
    sdReplay(0);
#else
    mqttClient.publish(cfg.mqttTopicPub, "{\"error\":\"SD not enabled\"}", false);
#endif
  } else {
    Serial.printf("[MQTT] Unknown command: %s\n", payload);
  }
}
