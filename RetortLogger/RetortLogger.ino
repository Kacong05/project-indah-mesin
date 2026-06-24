// ============================================================
//  RetortLogger.ino  –  Entry point, feature flags, setup(), loop()
//  Industrial Retort Logger - ESP32-S3
//  Autonics TNL-P46RR-RS-035 Temperature Controller
// ============================================================

#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include "mbedtls/sha256.h"

// --- Feature Flags ---
#define USE_FAKE_SENSOR true  // Simulasi sensor (set true HANYA tanpa Modbus)
#define USE_MODBUS      false   // RS485 Modbus RTU - Autonics TNL
#define USE_RTC         true   // DS3231M RTC
#define USE_SD          true   // MicroSD logging
#define USE_OTA         false  // OTA update

// --- Pin Assignments ---
#define PIN_RTC_SDA     8
#define PIN_RTC_SCL     9
#define PIN_SD_CS       10
#define PIN_SD_MOSI     11
#define PIN_SD_CLK      12
#define PIN_SD_MISO     13
#define PIN_RS485_RX    15
#define PIN_RS485_TX    16

// --- Constants ---
#define SESSION_TIMEOUT_MS   600000UL  // 10 menit
#define DASHBOARD_POLL_MS    2000

// --- Data Structures ---
struct AppConfig {
  char wifiSSID[33];
  char wifiPass[65];
  char mqttBroker[65];
  uint16_t mqttPort;
  char mqttUser[33];
  char mqttPass[65];
  char mqttPubTopic[65];
  char mqttCmdTopic[65];
  float targetTemp;
  uint32_t holdingTimeSec;
  float heatingRate;
  float coolingRate;
  char machineId[33];
  char passHash[65];
};

enum RetortPhase : uint8_t {
  PHASE_IDLE = 0,
  PHASE_HEATING,
  PHASE_HOLDING,
  PHASE_COOLING
};

struct RetortState {
  RetortPhase phase;
  float temperature;  // PV (actual)
  float setpoint;     // SV (setting)
  float pressure;
  unsigned long phaseStartMs;
  bool wifiConnected;
  bool mqttConnected;
  bool sdReady;
  bool logging;       // true = sesi perekaman CSV aktif
};

// --- Globals ---
AppConfig   cfg;
RetortState state;
Preferences prefs;
DNSServer   dnsServer;
AsyncWebServer server(80);

char sessionToken[65]      = {0};
unsigned long sessionStart = 0;

// --- SHA256 ---
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

// --- Session ---
void generateSession() {
  char raw[64];
  snprintf(raw, sizeof(raw), "%08lx%08lx%lu",
           (unsigned long)esp_random(), (unsigned long)esp_random(), millis());
  sha256Hex(raw, sessionToken);
  sessionStart = millis();
}

bool isSessionValid(AsyncWebServerRequest* req) {
  if (sessionToken[0] == '\0') return false;
  if (millis() - sessionStart > SESSION_TIMEOUT_MS) {
    sessionToken[0] = '\0';
    return false;
  }
  if (!req->hasHeader("Cookie")) return false;
  String c = req->header("Cookie");
  int i = c.indexOf("session=");
  if (i < 0) return false;
  String v = c.substring(i + 8);
  int s = v.indexOf(';');
  if (s > 0) v = v.substring(0, s);
  v.trim();
  if (v.equals(sessionToken)) {
    sessionStart = millis();
    return true;
  }
  return false;
}

void redirectToLogin(AsyncWebServerRequest* req) {
  req->redirect("/login");
}

const char* phaseName(RetortPhase p) {
  switch (p) {
    case PHASE_HEATING: return "HEATING";
    case PHASE_HOLDING: return "HOLDING";
    case PHASE_COOLING: return "COOLING";
    default:            return "IDLE";
  }
}

// --- Forward Declarations ---
void loadConfig();
void saveConfig();
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
void sdStartLog();
void sdStopLog();
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
  delay(300);
  Serial.println(F("\n=== RetortLogger ==="));

  // Turunkan clock CPU: 160 MHz cukup cepat untuk web + Modbus,
  // mengurangi panas & konsumsi daya ESP32-S3.
  setCpuFrequencyMhz(160);

  state.phase        = PHASE_IDLE;
  state.temperature  = 25.0f;
  state.setpoint     = 121.0f;
  state.pressure     = 1.013f;
  state.phaseStartMs = 0;
  state.wifiConnected = false;
  state.mqttConnected = false;
  state.sdReady       = false;
  state.logging       = false;

  loadConfig();
  state.setpoint = cfg.targetTemp;

  setupWiFiAP();
  setupWebAuth();
  setupWebDashboard();
  setupWebSettings();
  setupWebLogs();
  setupWebStorage();
  server.begin();

  setupMQTT();

#if USE_RTC
  setupRTC();
#endif
#if USE_SD
  setupSDLogger();
#endif
#if USE_MODBUS
  setupModbus();
#endif
#if USE_FAKE_SENSOR
  setupRetortSim();
#endif
#if USE_OTA
  setupOTA();
#endif

  Serial.println(F("=== Ready ==="));
}

void loop() {
  loopWiFiAP();
  loopMQTT();
#if USE_RTC
  loopRTC();
#endif
#if USE_MODBUS
  loopModbus();
#endif
#if USE_FAKE_SENSOR
  loopRetortSim();
#endif
#if USE_SD
  loopSDLogger();
#endif
#if USE_OTA
  loopOTA();
#endif
}
