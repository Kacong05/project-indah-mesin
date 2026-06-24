// ============================================================
//  config.ino  –  Preferences (NVS) load/save
// ============================================================

extern AppConfig   cfg;
extern Preferences prefs;

#define PREF_NS       "retort"
#define K_SSID        "wf_ssid"
#define K_WPASS       "wf_pass"
#define K_MQTT_HOST   "mq_host"
#define K_MQTT_PORT   "mq_port"
#define K_MQTT_USER   "mq_user"
#define K_MQTT_PASS   "mq_pass"
#define K_MQTT_PUB    "mq_pub"
#define K_MQTT_CMD    "mq_cmd"
#define K_TTEMP       "tgt_temp"
#define K_HOLD_SEC    "hold_sec"
#define K_HEAT_RATE   "heat_rate"
#define K_COOL_RATE   "cool_rate"
#define K_MACHINE_ID  "machine_id"
#define K_PASS_HASH   "pass_hash"

// Default password hash: SHA256("retort123")
static const char DEFAULT_PASS_HASH[] =
  "e5b1fc40362a7df203a27e457de2ec78792b8990f10a2afaeb0976b7996c8516";

// ============================================================
//  MQTT credentials & topics — SET MANUAL DI SINI sebelum flash.
//  Harus sama dengan user Mosquitto di VPS (retort_esp).
//  (Broker & Port tetap diatur lewat halaman Settings / web.)
// ============================================================
#define MQTT_USER       "retort_esp"
#define MQTT_PASS       "indah-Mesin.123"
#define MQTT_PUB_TOPIC  "retort/data"
#define MQTT_CMD_TOPIC  "retort/cmd"

void loadConfig() {
  prefs.begin(PREF_NS, true);  // read-only

  prefs.getString(K_SSID,      cfg.wifiSSID,     sizeof(cfg.wifiSSID));
  prefs.getString(K_WPASS,     cfg.wifiPass,     sizeof(cfg.wifiPass));
  prefs.getString(K_MQTT_HOST, cfg.mqttBroker,   sizeof(cfg.mqttBroker));
  cfg.mqttPort = prefs.getUShort(K_MQTT_PORT, 1883);

  // User/password/topic MQTT diambil dari konstanta kode (bukan web/NVS).
  strncpy(cfg.mqttUser,     MQTT_USER,      sizeof(cfg.mqttUser) - 1);
  strncpy(cfg.mqttPass,     MQTT_PASS,      sizeof(cfg.mqttPass) - 1);
  strncpy(cfg.mqttPubTopic, MQTT_PUB_TOPIC, sizeof(cfg.mqttPubTopic) - 1);
  strncpy(cfg.mqttCmdTopic, MQTT_CMD_TOPIC, sizeof(cfg.mqttCmdTopic) - 1);

  // Retort parameters
  cfg.targetTemp    = prefs.getFloat(K_TTEMP,    121.0f);
  cfg.holdingTimeSec = prefs.getUInt(K_HOLD_SEC, 1200);  // 20 menit
  cfg.heatingRate   = prefs.getFloat(K_HEAT_RATE, 1.5f);
  cfg.coolingRate   = prefs.getFloat(K_COOL_RATE, 0.8f);

  // Machine identity
  prefs.getString(K_MACHINE_ID, cfg.machineId, sizeof(cfg.machineId));
  if (cfg.machineId[0] == '\0')
    strncpy(cfg.machineId, "RT-001", sizeof(cfg.machineId) - 1);

  prefs.getString(K_PASS_HASH, cfg.passHash, sizeof(cfg.passHash));
  if (cfg.passHash[0] == '\0')
    strncpy(cfg.passHash, DEFAULT_PASS_HASH, sizeof(cfg.passHash) - 1);

  prefs.end();

  Serial.printf("[CFG] Machine=%s  SSID=%s  MQTT=%s:%d\n",
                cfg.machineId, cfg.wifiSSID, cfg.mqttBroker, cfg.mqttPort);
}

void saveConfig() {
  prefs.begin(PREF_NS, false);  // read-write
  prefs.putString(K_SSID,      cfg.wifiSSID);
  prefs.putString(K_WPASS,     cfg.wifiPass);
  prefs.putString(K_MQTT_HOST, cfg.mqttBroker);
  prefs.putUShort(K_MQTT_PORT, cfg.mqttPort);
  prefs.putFloat(K_TTEMP,      cfg.targetTemp);
  prefs.putUInt(K_HOLD_SEC,    cfg.holdingTimeSec);
  prefs.putFloat(K_HEAT_RATE,  cfg.heatingRate);
  prefs.putFloat(K_COOL_RATE,  cfg.coolingRate);
  prefs.putString(K_MACHINE_ID, cfg.machineId);
  prefs.putString(K_PASS_HASH, cfg.passHash);
  prefs.end();
  Serial.println(F("[CFG] Saved."));
}

// Overloaded helpers for saving individual fields
void saveConfigField(const char* key, const char* val) {
  prefs.begin(PREF_NS, false);
  prefs.putString(key, val);
  prefs.end();
}

void saveConfigField(const char* key, uint16_t val) {
  prefs.begin(PREF_NS, false);
  prefs.putUShort(key, val);
  prefs.end();
}

void saveConfigField(const char* key, float val) {
  prefs.begin(PREF_NS, false);
  prefs.putFloat(key, val);
  prefs.end();
}

void saveConfigField(const char* key, uint32_t val) {
  prefs.begin(PREF_NS, false);
  prefs.putUInt(key, val);
  prefs.end();
}
