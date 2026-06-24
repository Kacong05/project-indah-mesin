// ============================================================
//  RetortLogger.ino  –  Entry point, feature flags, setup(), loop()
//  Industrial Retort Logger berbasis ESP32
//  Menggunakan ESPAsyncWebServer + DNSServer (Captive Portal)
// ============================================================

#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include "mbedtls/sha256.h"

// --- Feature Flags ---
#define USE_FAKE_SENSOR true   // Gunakan sensor simulasi
#define USE_MODBUS      true   // RS485 Modbus RTU
#define USE_RTC         true   // DS3231M RTC
#define USE_SD          true   // MicroSD logging
#define USE_OTA         true  // OTA update

// --- Constants ---
#define SESSION_TIMEOUT_MS   600000UL  // 10 menit auto logout
#define DASHBOARD_POLL_MS    2000      // Update dashboard setiap 2 detik

// --- Data Structures ---
struct AppConfig {
  // WiFi
  char wifiSSID[33];
  char wifiPass[65];
  // MQTT
  char mqttBroker[65];
  uint16_t mqttPort;
  char mqttUser[33];
  char mqttPass[65];
  char mqttPubTopic[65];
  char mqttCmdTopic[65];
  // Retort Parameters
  float targetTemp;       // Target temperature (°C)
  uint32_t holdingTimeSec; // Holding time (detik)
  float heatingRate;      // Heating rate (°C/s)
  float coolingRate;      // Cooling rate (°C/s)
  // Machine Identity
  char machineId[33];
  char passHash[65];      // SHA256 hex string
};

enum RetortPhase : uint8_t {
  PHASE_IDLE = 0,
  PHASE_HEATING,
  PHASE_HOLDING,
  PHASE_COOLING
};

struct RetortState {
  RetortPhase phase;
  float temperature;
  float pressure;
  unsigned long phaseStartMs;
  bool wifiConnected;
  bool mqttConnected;
  bool sdReady;
};

// --- Globals ---
AppConfig   cfg;
RetortState state;
Preferences prefs;
DNSServer   dnsServer;
AsyncWebServer server(80);

// Session management
char sessionToken[65]       = {0};
unsigned long sessionStart  = 0;

// --- Utility: SHA256 hash ke hex string ---
void sha256Hex(const char* input, char* output) {
  unsigned char hash[32];
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0);
  mbedtls_sha256_update(&ctx, (const unsigned char*)input, strlen(input));
  mbedtls_sha256_finish(&ctx, hash);
  mbedtls_sha256_free(&ctx);
  for (int i = 0; i < 32; i++) {
    sprintf(output + (i * 2), "%02x", hash[i]);
  }
  output[64] = '\0';
}

// --- Utility: Generate random session token ---
void generateSession() {
  uint32_t r1 = esp_random();
  uint32_t r2 = esp_random();
  uint32_t r3 = esp_random();
  uint32_t r4 = esp_random();
  char raw[64];
  snprintf(raw, sizeof(raw), "%08lx%08lx%08lx%08lx%lu",
           (unsigned long)r1, (unsigned long)r2,
           (unsigned long)r3, (unsigned long)r4, millis());
  sha256Hex(raw, sessionToken);
  sessionStart = millis();
}

// --- Utility: Validate session token ---
bool isSessionValid(AsyncWebServerRequest* request) {
  if (sessionToken[0] == '\0') return false;
  if (millis() - sessionStart > SESSION_TIMEOUT_MS) {
    sessionToken[0] = '\0';
    return false;
  }
  if (!request->hasHeader("Cookie")) return false;
  String cookie = request->header("Cookie");
  // Cari "session=<token>"
  int idx = cookie.indexOf("session=");
  if (idx < 0) return false;
  String val = cookie.substring(idx + 8);
  int semi = val.indexOf(';');
  if (semi > 0) val = val.substring(0, semi);
  val.trim();
  if (val.equals(sessionToken)) {
    sessionStart = millis();  // Refresh timeout
    return true;
  }
  return false;
}

// --- Utility: Redirect ke login ---
void redirectToLogin(AsyncWebServerRequest* request) {
  request->redirect("/login");
}

// --- Utility: Phase name ---
const char* phaseName(RetortPhase p) {
  switch (p) {
    case PHASE_HEATING: return "HEATING";
    case PHASE_HOLDING: return "HOLDING";
    case PHASE_COOLING: return "COOLING";
    default:            return "IDLE";
  }
}

// --- Forward declarations (dari file .ino lain) ---
void loadConfig();
void saveConfig();
void saveConfigField(const char* key, const char* val);
void saveConfigField(const char* key, uint16_t val);
void saveConfigField(const char* key, float val);
void saveConfigField(const char* key, uint32_t val);

void setupWiFiAP();
void loopWiFiAP();

void setupMQTT();
void loopMQTT();
void mqttPublishState();

void setupRetortSim();
void loopRetortSim();
void startProcess();
void stopProcess();

void setupModbus();
void loopModbus();

void setupRTC();
void loopRTC();
void getTimestamp(char* buf, size_t len);

void setupSDLogger();
void loopSDLogger();
void sdLogEntry();

void setupOTA();
void loopOTA();

void setupWebAuth();
void setupWebDashboard();
void setupWebSettings();
void setupWebLogs();
void setupWebStorage();

// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println(F("\n=== Industrial Retort Logger ==="));

  // Init state
  state.phase       = PHASE_IDLE;
  state.temperature  = 25.0f;
  state.pressure     = 1.013f;
  state.phaseStartMs = 0;
  state.wifiConnected = false;
  state.mqttConnected = false;
  state.sdReady       = false;

  loadConfig();
  setupWiFiAP();

  // Web server routes
  setupWebAuth();
  setupWebDashboard();
  setupWebSettings();
  setupWebLogs();
  setupWebStorage();
  server.begin();
  Serial.println(F("[WEB] AsyncWebServer started."));

  setupMQTT();

#if USE_FAKE_SENSOR
  setupRetortSim();
#endif
#if USE_MODBUS
  setupModbus();
#endif
#if USE_RTC
  setupRTC();
#endif
#if USE_SD
  setupSDLogger();
#endif
#if USE_OTA
  setupOTA();
#endif

  Serial.println(F("=== Setup Complete ==="));
}

// ============================================================
void loop() {
  loopWiFiAP();
  loopMQTT();

#if USE_FAKE_SENSOR
  loopRetortSim();
#endif
#if USE_MODBUS
  loopModbus();
#endif
#if USE_RTC
  loopRTC();
#endif
#if USE_SD
  loopSDLogger();
#endif
#if USE_OTA
  loopOTA();
#endif
}
