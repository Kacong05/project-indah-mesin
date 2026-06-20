// ============================================================
//  wifi_ap.ino  –  AP Mode + Captive Portal + STA connection
// ============================================================

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>

#define AP_SSID        "RetortLogger-Config"
#define AP_PASS        "retort123"   // min 8 chars for WPA2
#define AP_IP          "192.168.4.1"
#define DNS_PORT       53
#define HTTP_PORT      80
#define STA_TIMEOUT_MS 10000

extern AppConfig cfg;

static WebServer  server(HTTP_PORT);
static DNSServer  dnsServer;
static bool       apActive   = false;
static bool       staConnected = false;
static uint32_t   staAttemptMs = 0;

// ---- HTML helpers ------------------------------------------
static const char HTML_HEAD[] PROGMEM =
  "<!DOCTYPE html><html><head><meta charset='utf-8'>"
  "<meta name='viewport' content='width=device-width,initial-scale=1'>"
  "<style>body{font-family:sans-serif;max-width:420px;margin:40px auto;padding:0 16px}"
  "h1{color:#1a73e8}input,select{width:100%;padding:8px;margin:6px 0;box-sizing:border-box}"
  "button{background:#1a73e8;color:#fff;padding:10px 24px;border:0;border-radius:4px;cursor:pointer}"
  ".ok{color:green}.err{color:red}</style></head><body>";

static const char HTML_FOOT[] PROGMEM = "</body></html>";

// ---- Route handlers ----------------------------------------
static void handleRoot() {
  String html = FPSTR(HTML_HEAD);
  html += "<h1>RetortLogger Config</h1>"
          "<form method='POST' action='/save'>"
          "<b>Wi-Fi</b><br>"
          "<input name='ssid' placeholder='SSID' maxlength='63' value='";
  html += cfg.wifiSSID;
  html += "'><input name='pass' placeholder='Password' maxlength='63' type='password'>"
          "<br><b>MQTT</b><br>"
          "<input name='mhost' placeholder='Broker host/IP' maxlength='63' value='";
  html += cfg.mqttHost;
  html += "'><input name='mport' type='number' placeholder='Port' min='1' max='65535' value='";
  html += cfg.mqttPort;
  html += "'><input name='muser' placeholder='User (optional)' maxlength='31' value='";
  html += cfg.mqttUser;
  html += "'><input name='mpass' placeholder='Password (optional)' maxlength='31' type='password'>"
          "<input name='mpub' placeholder='Publish topic' maxlength='63' value='";
  html += cfg.mqttTopicPub;
  html += "'><input name='mcmd' placeholder='Command topic' maxlength='63' value='";
  html += cfg.mqttTopicCmd;
  html += "'><br><b>Process</b><br>"
          "<input name='sp' type='number' step='0.1' placeholder='Heat setpoint °C' value='";
  html += cfg.heatSetpoint;
  html += "'><input name='hold' type='number' placeholder='Hold duration (min)' value='";
  html += cfg.holdDurationMs / 60000;
  html += "'><input name='cool' type='number' step='0.1' placeholder='Cool threshold °C' value='";
  html += cfg.coolThresholdC;
  html += "'><input name='si' type='number' placeholder='Sample interval (ms)' min='100' max='60000' value='";
  html += cfg.sampleIntervalMs;
  html += "'><br><br><button type='submit'>Save &amp; Restart</button></form>";
  html += FPSTR(HTML_FOOT);
  server.send(200, "text/html", html);
}

// Validate string length, copy to dest if valid
static bool copyIfValid(const char* src, char* dst, size_t maxLen) {
  size_t len = strlen(src);
  if (len == 0 || len >= maxLen) return false;
  strncpy(dst, src, maxLen - 1);
  dst[maxLen - 1] = '\0';
  return true;
}

static void handleSave() {
  bool changed = false;

  if (server.hasArg("ssid"))
    changed |= copyIfValid(server.arg("ssid").c_str(), cfg.wifiSSID, sizeof(cfg.wifiSSID));
  if (server.hasArg("pass") && server.arg("pass").length() > 0)
    copyIfValid(server.arg("pass").c_str(), cfg.wifiPass, sizeof(cfg.wifiPass));
  if (server.hasArg("mhost"))
    copyIfValid(server.arg("mhost").c_str(), cfg.mqttHost, sizeof(cfg.mqttHost));
  if (server.hasArg("mport")) {
    int p = server.arg("mport").toInt();
    if (p > 0 && p <= 65535) cfg.mqttPort = (uint16_t)p;
  }
  if (server.hasArg("muser"))
    copyIfValid(server.arg("muser").c_str(), cfg.mqttUser, sizeof(cfg.mqttUser));
  if (server.hasArg("mpass") && server.arg("mpass").length() > 0)
    copyIfValid(server.arg("mpass").c_str(), cfg.mqttPass, sizeof(cfg.mqttPass));
  if (server.hasArg("mpub"))
    copyIfValid(server.arg("mpub").c_str(), cfg.mqttTopicPub, sizeof(cfg.mqttTopicPub));
  if (server.hasArg("mcmd"))
    copyIfValid(server.arg("mcmd").c_str(), cfg.mqttTopicCmd, sizeof(cfg.mqttTopicCmd));
  if (server.hasArg("sp")) {
    float v = server.arg("sp").toFloat();
    if (v > 50.0f && v < 200.0f) cfg.heatSetpoint = v;
  }
  if (server.hasArg("hold")) {
    uint32_t v = (uint32_t)server.arg("hold").toInt();
    if (v > 0 && v <= 120) cfg.holdDurationMs = v * 60000UL;
  }
  if (server.hasArg("cool")) {
    float v = server.arg("cool").toFloat();
    if (v > 20.0f && v < 100.0f) cfg.coolThresholdC = v;
  }
  if (server.hasArg("si")) {
    int v = server.arg("si").toInt();
    if (v >= 100 && v <= 60000) cfg.sampleIntervalMs = (uint16_t)v;
  }

  saveConfig();

  String html = FPSTR(HTML_HEAD);
  html += "<h1>Saved</h1><p class='ok'>Configuration saved. Restarting...</p>";
  html += FPSTR(HTML_FOOT);
  server.send(200, "text/html", html);

  delay(1500);
  ESP.restart();
}

// Captive portal redirect
static void handleCaptive() {
  server.sendHeader("Location", "http://" AP_IP, true);
  server.send(302, "text/plain", "");
}

// ---- Public API --------------------------------------------
void wifiApSetup() {
  IPAddress apIP(192, 168, 4, 1);
  IPAddress subnet(255, 255, 255, 0);

  WiFi.mode(WIFI_AP_STA);
  WiFi.softAPConfig(apIP, apIP, subnet);
  WiFi.softAP(AP_SSID, AP_PASS);
  apActive = true;

  dnsServer.start(DNS_PORT, "*", apIP);

  server.on("/",          HTTP_GET,  handleRoot);
  server.on("/save",      HTTP_POST, handleSave);
  server.onNotFound(handleCaptive);
  server.begin();

  Serial.printf("[AP] SSID=%s  IP=%s\n", AP_SSID, AP_IP);
}

void wifiStaConnect() {
  if (cfg.wifiSSID[0] == '\0') {
    Serial.println(F("[STA] No SSID – staying in AP-only mode."));
    return;
  }
  Serial.printf("[STA] Connecting to %s ...\n", cfg.wifiSSID);
  WiFi.begin(cfg.wifiSSID, cfg.wifiPass);
  staAttemptMs = millis();
}

bool wifiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

void wifiLoop() {
  dnsServer.processNextRequest();
  server.handleClient();

  static bool wasConnected = false;

  if (!wasConnected && wifiConnected()) {
    wasConnected = true;
    Serial.printf("[STA] Connected! IP=%s\n", WiFi.localIP().toString().c_str());
  }

  // Retry STA if disconnected and SSID is configured
  if (!wifiConnected() && cfg.wifiSSID[0] != '\0') {
    if (millis() - staAttemptMs > 30000) {
      wasConnected = false;
      Serial.println(F("[STA] Retrying connection..."));
      WiFi.disconnect();
      WiFi.begin(cfg.wifiSSID, cfg.wifiPass);
      staAttemptMs = millis();
    }
  }
}
