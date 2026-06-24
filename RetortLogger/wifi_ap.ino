// ============================================================
//  wifi_ap.ino  –  AP mode + Captive Portal + STA connection
// ============================================================

extern AppConfig   cfg;
extern RetortState state;
extern DNSServer   dnsServer;

static const IPAddress AP_IP(192, 168, 4, 1);
static const IPAddress AP_MASK(255, 255, 255, 0);
static unsigned long lastStaAttemptMs = 0;
static const unsigned long STA_RETRY_MS = 10000;
static bool configApActive = false;

static void startConfigAP() {
  if (configApActive) return;
  WiFi.softAPConfig(AP_IP, AP_IP, AP_MASK);
  WiFi.softAP("RetortLogger-Config");
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(53, "*", AP_IP);
  configApActive = true;
  Serial.printf("[WiFi] Config AP on  IP=%s\n",
                WiFi.softAPIP().toString().c_str());
}

static void stopConfigAP() {
  if (!configApActive) return;
  dnsServer.stop();
  WiFi.softAPdisconnect(true);
  configApActive = false;
  Serial.println(F("[WiFi] Config AP off (STA aktif)"));
}

static void staConnect() {
  if (cfg.wifiSSID[0] == '\0') return;
  Serial.printf("[WiFi] STA connect → %s\n", cfg.wifiSSID);
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(cfg.wifiSSID, cfg.wifiPass);
  lastStaAttemptMs = millis();
}

static void onWiFiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println(F("[WiFi] STA associated"));
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.printf("[WiFi] STA IP=%s\n",
                    WiFi.localIP().toString().c_str());
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.printf("[WiFi] STA putus, reason=%d\n",
                    info.wifi_sta_disconnected.reason);
      // 2=no AP found, 15=wrong password, 201=no AP
      state.wifiConnected = false;
      startConfigAP();
      break;
    default:
      break;
  }
}

void setupWiFiAP() {
  WiFi.onEvent(onWiFiEvent);
  WiFi.mode(WIFI_AP_STA);
  WiFi.persistent(true);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);
  // Daya penuh — 11 dBm terlalu lemah untuk WiFi pabrik / jarak jauh
  WiFi.setTxPower(WIFI_POWER_19_5dBm);

  startConfigAP();

  if (cfg.wifiSSID[0] != '\0') {
    staConnect();
  } else {
    Serial.println(F("[WiFi] SSID kosong — isi lewat Settings AP"));
  }
}

void loopWiFiAP() {
  if (configApActive) {
    dnsServer.processNextRequest();
  }

  bool connected = (WiFi.status() == WL_CONNECTED);

  if (connected && !state.wifiConnected) {
    state.wifiConnected = true;
    stopConfigAP();
    Serial.printf("[WiFi] STA OK  IP=%s  RSSI=%d\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else if (!connected && state.wifiConnected) {
    state.wifiConnected = false;
    Serial.println(F("[WiFi] STA lost"));
    startConfigAP();
  }

  if (!connected && cfg.wifiSSID[0] != '\0') {
    if (millis() - lastStaAttemptMs > STA_RETRY_MS) {
      Serial.println(F("[WiFi] Retry STA..."));
      staConnect();
    }
  }
}
