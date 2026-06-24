// ============================================================
//  wifi_ap.ino  –  AP mode + Captive Portal + STA connection
// ============================================================

extern AppConfig   cfg;
extern RetortState state;
extern DNSServer   dnsServer;

static const IPAddress AP_IP(192, 168, 4, 1);
static const IPAddress AP_MASK(255, 255, 255, 0);
static unsigned long lastStaAttemptMs = 0;
static const unsigned long STA_RETRY_MS = 30000;

void setupWiFiAP() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAPConfig(AP_IP, AP_IP, AP_MASK);
  WiFi.softAP("RetortLogger-Config");  // Open AP for captive portal
  
  // DNS: redirect semua request ke IP AP untuk captive portal
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(53, "*", AP_IP);
  
  Serial.printf("[WiFi] AP started: RetortLogger-Config  IP=%s\n",
                WiFi.softAPIP().toString().c_str());

  // STA connect jika SSID dikonfigurasi
  if (cfg.wifiSSID[0] != '\0') {
    Serial.printf("[WiFi] Connecting to STA: %s\n", cfg.wifiSSID);
    WiFi.begin(cfg.wifiSSID, cfg.wifiPass);
    lastStaAttemptMs = millis();
  }
}

void loopWiFiAP() {
  dnsServer.processNextRequest();

  bool connected = (WiFi.status() == WL_CONNECTED);

  if (connected && !state.wifiConnected) {
    state.wifiConnected = true;
    Serial.printf("[WiFi] STA Connected! IP=%s\n",
                  WiFi.localIP().toString().c_str());
  } else if (!connected && state.wifiConnected) {
    state.wifiConnected = false;
    Serial.println(F("[WiFi] STA Disconnected."));
  }

  // Auto-reconnect STA
  if (!connected && cfg.wifiSSID[0] != '\0') {
    if (millis() - lastStaAttemptMs > STA_RETRY_MS) {
      Serial.println(F("[WiFi] Retrying STA..."));
      WiFi.disconnect();
      WiFi.begin(cfg.wifiSSID, cfg.wifiPass);
      lastStaAttemptMs = millis();
    }
  }
}
