// ============================================================
//  config.ino  –  Preferences load/save + default values
// ============================================================

#include <Preferences.h>

// Keys match CONFIGURATION.md §Preferences
#define PREF_NS          "retort"
#define KEY_WIFI_SSID    "wifi_ssid"
#define KEY_WIFI_PASS    "wifi_pass"
#define KEY_MQTT_HOST    "mqtt_host"
#define KEY_MQTT_PORT    "mqtt_port"
#define KEY_MQTT_USER    "mqtt_user"
#define KEY_MQTT_PASS    "mqtt_pass"
#define KEY_MQTT_PUB     "mqtt_pub"
#define KEY_MQTT_CMD     "mqtt_cmd"
#define KEY_DEVICE_ID    "device_id"
#define KEY_SAMPLE_MS    "sample_ms"
#define KEY_HEAT_SP      "heat_sp"
#define KEY_HOLD_DUR     "hold_dur"
#define KEY_COOL_THR     "cool_thr"

// Declared in RetortLogger.ino
extern AppConfig cfg;
extern Preferences prefs;

void loadConfig() {
  prefs.begin(PREF_NS, true);  // read-only

  prefs.getString(KEY_WIFI_SSID, cfg.wifiSSID, sizeof(cfg.wifiSSID));
  prefs.getString(KEY_WIFI_PASS, cfg.wifiPass, sizeof(cfg.wifiPass));
  prefs.getString(KEY_MQTT_HOST, cfg.mqttHost, sizeof(cfg.mqttHost));
  cfg.mqttPort = prefs.getUShort(KEY_MQTT_PORT, 1883);
  prefs.getString(KEY_MQTT_USER, cfg.mqttUser, sizeof(cfg.mqttUser));
  prefs.getString(KEY_MQTT_PASS, cfg.mqttPass, sizeof(cfg.mqttPass));

  // Defaults for MQTT topics
  prefs.getString(KEY_MQTT_PUB, cfg.mqttTopicPub, sizeof(cfg.mqttTopicPub));
  if (cfg.mqttTopicPub[0] == '\0')
    strncpy(cfg.mqttTopicPub, "retort/data", sizeof(cfg.mqttTopicPub));

  prefs.getString(KEY_MQTT_CMD, cfg.mqttTopicCmd, sizeof(cfg.mqttTopicCmd));
  if (cfg.mqttTopicCmd[0] == '\0')
    strncpy(cfg.mqttTopicCmd, "retort/cmd", sizeof(cfg.mqttTopicCmd));

  prefs.getString(KEY_DEVICE_ID, cfg.deviceID, sizeof(cfg.deviceID));
  if (cfg.deviceID[0] == '\0') {
    uint8_t mac[6];
    WiFi.macAddress(mac);
    snprintf(cfg.deviceID, sizeof(cfg.deviceID),
             "retort_%02X%02X%02X", mac[3], mac[4], mac[5]);
  }

  cfg.sampleIntervalMs = prefs.getUShort(KEY_SAMPLE_MS, 1000);
  cfg.heatSetpoint     = prefs.getFloat(KEY_HEAT_SP,    121.0f);
  cfg.holdDurationMs   = prefs.getUInt(KEY_HOLD_DUR,    1200000UL); // 20 min
  cfg.coolThresholdC   = prefs.getFloat(KEY_COOL_THR,    40.0f);

  prefs.end();

  Serial.printf("[CFG] SSID=%s MQTT=%s:%d DevID=%s\n",
                cfg.wifiSSID, cfg.mqttHost, cfg.mqttPort, cfg.deviceID);
}

void saveConfig() {
  prefs.begin(PREF_NS, false);  // read-write

  prefs.putString(KEY_WIFI_SSID, cfg.wifiSSID);
  prefs.putString(KEY_WIFI_PASS, cfg.wifiPass);
  prefs.putString(KEY_MQTT_HOST, cfg.mqttHost);
  prefs.putUShort(KEY_MQTT_PORT, cfg.mqttPort);
  prefs.putString(KEY_MQTT_USER, cfg.mqttUser);
  prefs.putString(KEY_MQTT_PASS, cfg.mqttPass);
  prefs.putString(KEY_MQTT_PUB,  cfg.mqttTopicPub);
  prefs.putString(KEY_MQTT_CMD,  cfg.mqttTopicCmd);
  prefs.putString(KEY_DEVICE_ID, cfg.deviceID);
  prefs.putUShort(KEY_SAMPLE_MS, cfg.sampleIntervalMs);
  prefs.putFloat(KEY_HEAT_SP,    cfg.heatSetpoint);
  prefs.putUInt(KEY_HOLD_DUR,    cfg.holdDurationMs);
  prefs.putFloat(KEY_COOL_THR,   cfg.coolThresholdC);

  prefs.end();
  Serial.println(F("[CFG] Saved to Preferences."));
}
