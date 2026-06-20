// ============================================================
//  RetortLogger.ino  –  Industrial Retort Logger (ESP32-S3)
//  Main entry point
// ============================================================

// ---- FEATURE FLAGS -----------------------------------------
// Set to true when the hardware is physically present.
#define USE_FAKE_SENSOR true   // Simulated retort temperature
#define USE_MODBUS      false  // RS485 Modbus RTU slave/master
#define USE_RTC         false  // DS3231M real-time clock
#define USE_SD          false  // MicroSD card logging
#define USE_OTA         false  // Over-the-air firmware update
// ------------------------------------------------------------

#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>

// ---- GLOBAL SHARED STATE -----------------------------------
Preferences prefs;

// Retort process state
typedef struct {
  float    tempC;          // Current temperature °C
  float    setpoint;       // Target setpoint for current phase
  uint8_t  phase;          // 0=idle 1=heating 2=holding 3=cooling
  uint32_t phaseStartMs;   // millis() when phase began
  uint32_t totalLoggedMs;  // total process time accumulated
  bool     running;        // process active flag
  char     timestamp[20];  // "YYYY-MM-DD HH:MM:SS"
} RetortState;

RetortState retort = {0};

// Config loaded from Preferences / AP portal
typedef struct {
  char wifiSSID[64];
  char wifiPass[64];
  char mqttHost[64];
  uint16_t mqttPort;
  char mqttUser[32];
  char mqttPass[32];
  char mqttTopicPub[64];
  char mqttTopicCmd[64];
  char deviceID[32];
  uint16_t sampleIntervalMs;   // default 1000
  float heatSetpoint;          // default 121.0 °C
  uint32_t holdDurationMs;     // default 20 min
  float coolThresholdC;        // default 40.0 °C
} AppConfig;

AppConfig cfg = {0};

// ---- TIMING ------------------------------------------------
static uint32_t lastSampleMs  = 0;
static uint32_t lastMqttMs    = 0;
static uint32_t lastStatusMs  = 0;

// ---- FORWARD DECLARATIONS (defined in other .ino tabs) -----
// config.ino
void loadConfig();
void saveConfig();

// wifi_ap.ino
void wifiApSetup();
void wifiStaConnect();
void wifiLoop();
bool wifiConnected();

// mqtt_client.ino
void mqttSetup();
void mqttLoop();
void mqttPublish(const RetortState* s);
void mqttHandleCommand(const char* topic, const char* payload);

// retort_sim.ino
void simUpdate(RetortState* s, AppConfig* c);
void simStartProcess(RetortState* s);
void simStopProcess(RetortState* s);

// modbus_hw.ino
void modbusSetup();
float modbusReadTemp();
void modbusLoop();

// rtc_hw.ino
void rtcSetup();
void rtcGetTimestamp(char* buf, size_t len);

// sd_logger.ino
void sdSetup();
void sdLog(const RetortState* s);
void sdReplay(uint32_t offsetMs);

// ota_update.ino
void otaSetup();
void otaLoop();

// ============================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println(F("\n[BOOT] RetortLogger v1.0"));

  loadConfig();

#if USE_RTC
  rtcSetup();
#endif

#if USE_MODBUS
  modbusSetup();
#endif

#if USE_SD
  sdSetup();
#endif

  wifiApSetup();       // always start AP for captive portal
  wifiStaConnect();    // attempt STA connection

#if USE_OTA
  otaSetup();
#endif

  mqttSetup();

  retort.phase   = 0;
  retort.running = false;
  retort.tempC   = 25.0f;

  Serial.println(F("[BOOT] Setup complete."));
}

// ============================================================
void loop() {
  uint32_t now = millis();

  wifiLoop();

#if USE_OTA
  otaLoop();
#endif

  mqttLoop();

  // Sample sensor at configured interval
  if (now - lastSampleMs >= cfg.sampleIntervalMs) {
    lastSampleMs = now;

#if USE_RTC
    rtcGetTimestamp(retort.timestamp, sizeof(retort.timestamp));
#else
    // Fallback: elapsed seconds since boot
    uint32_t sec = now / 1000;
    snprintf(retort.timestamp, sizeof(retort.timestamp),
             "00:00:%02lu:%02lu:%02lu",
             sec / 3600, (sec % 3600) / 60, sec % 60);
#endif

#if USE_FAKE_SENSOR
    simUpdate(&retort, &cfg);
#endif

#if USE_MODBUS
    retort.tempC = modbusReadTemp();
    modbusLoop();
#endif

#if USE_SD
    sdLog(&retort);
#endif

    mqttPublish(&retort);

    // Serial status every 5 s
    if (now - lastStatusMs >= 5000) {
      lastStatusMs = now;
      Serial.printf("[STATUS] Phase=%d Temp=%.1f°C SP=%.1f ts=%s\n",
                    retort.phase, retort.tempC,
                    retort.setpoint, retort.timestamp);
    }
  }
}
