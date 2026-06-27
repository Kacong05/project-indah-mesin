// ============================================================
//  RetortLogger.ino  –  Entry point, feature flags, setup(), loop()
//  Industrial Retort Logger - ESP32-S3
//  Autonics TNL-P46RR-RS-035 Temperature Controller
// ============================================================

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include "mbedtls/sha256.h"

// --- Feature Flags ---
#define USE_FAKE_SENSOR false  // Simulasi sensor (set true HANYA tanpa Modbus)
#define USE_MODBUS      true   // RS485 Modbus RTU - Autonics TNL
#define USE_RTC         true   // DS3231M RTC
#define USE_SD          true   // MicroSD logging
#define USE_OTA         false  // OTA update
// --- Trigger & MV: default PRODUKSI (sama uji jumper & retort sungguhan) ---
// Mulai rekam: MV>0 (DI-1/selenoid → TNL). Stop: STOP+MV0. Tanpa reflash ke retort.
#define USE_MV_SIMULATION false  // true = tombol dashboard paksa MV 50% (dev only)
#define USE_TNL_DI_TRIGGER false // true = fake MV dari DI (dev only — jangan dipakai produksi)
#if USE_TNL_DI_TRIGGER
#define TNL_REG_DI_STATUS 0x03F1
#define TNL_DI_BIT        0
#endif
// Store-and-forward: replay baris SD yang belum terkirim saat MQTT reconnect.
#define USE_STORE_FORWARD true
// Tunggu retort/ack dari bridge sebelum maju offset SD. false = mode lama (publish=OK).
#define USE_MQTT_ACK      true

// --- Pin Assignments ---
#define PIN_RTC_SDA     8
#define PIN_RTC_SCL     9
#define PIN_SD_CS       10
#define PIN_SD_MOSI     11
#define PIN_SD_CLK      12
#define PIN_SD_MISO     13
#define PIN_RS485_TX    15   // pinout resmi: TX2=GPIO15 (-> MAX485 DI)
#define PIN_RS485_RX    16   // pinout resmi: RX2=GPIO16 (<- MAX485 RO)
#define PIN_RS485_DE    -1   // board auto-direction (tak ada pin DE)

// --- Constants ---
#define SESSION_TIMEOUT_MS   28800000UL  // 8 jam (dashboard industri)
#define DASHBOARD_POLL_MS    2000
#define K_WEB_SESS           "web_sess"

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
  float mv;           // MV output kontrol (%) — Heating/Cooling MV terbesar
  bool ctrlRun;       // status RUN/STOP controller (true = RUN)
  uint8_t pattern;    // TNL Program_PATN_CURR (FC04 0x03FB)
  uint8_t step;       // TNL Program_Step_CURR (FC04 0x03FC)
  char totMs[8];      // TNL Program_Process_Time — mirror TOT M:S
  char stpMs[8];      // waktu step berjalan — mirror STP M:S
  unsigned long phaseStartMs;
  bool wifiConnected;
  bool mqttConnected;
  bool sdReady;
  bool logging;       // true = sesi perekaman CSV aktif (auto-trigger)
};

// --- Globals ---
AppConfig   cfg;
RetortState state;
Preferences prefs;
DNSServer   dnsServer;
AsyncWebServer server(80);

char sessionToken[65]      = {0};
unsigned long sessionStart = 0;

// --- Sinkronisasi task logger (akuisisi data) vs loop (jaringan/web) ---
// Modbus + tulis SD dijalankan di task khusus berprioritas tinggi (core 1)
// agar pengambilan data per-detik TIDAK pernah tertahan oleh WiFi/MQTT/web.
SemaphoreHandle_t gSdMutex = NULL;     // lindungi akses SD lintas task/core
volatile bool gLogStartReq = false;    // permintaan mulai rekam (dari web/MQTT)
volatile bool gLogStopReq  = false;    // permintaan stop rekam
char gLastTs[32] = "--/--/---- --:--:-- WIB";  // timestamp WIB (sama dengan gLastClock)
char gLastIso[26] = "1970-01-01T00:00:00+07:00";  // ISO cache (recorded_at akurat)
char gLastClock[32] = "--/--/---- --:--:-- WIB";  // jam dashboard (24 jam WIB)

// Ambil/lepas kunci SD. Timeout supaya task logger tak menunggu terlalu lama.
bool sdLock(uint32_t ms) {
  return gSdMutex && xSemaphoreTake(gSdMutex, pdMS_TO_TICKS(ms)) == pdTRUE;
}
void sdUnlock() {
  if (gSdMutex) xSemaphoreGive(gSdMutex);
}

// Diagnostik koneksi (ditampilkan di dashboard)
int gLastStaDiscReason = 0;  // kode putus WiFi STA (15=password salah)
int gLastMqttState     = 0;  // PubSubClient state saat gagal (-2=jaringan, 4=user, 5=ACL)

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

// --- Session (NVS: tetap valid setelah reboot ESP / colok Modbus) ---
void saveWebSession() {
  if (sessionToken[0] == '\0') return;
  prefs.begin("retort", false);
  prefs.putString(K_WEB_SESS, sessionToken);
  prefs.end();
}

void loadWebSession() {
  prefs.begin("retort", true);
  String t = prefs.getString(K_WEB_SESS, "");
  prefs.end();
  if (t.length() == 64) {
    t.toCharArray(sessionToken, sizeof(sessionToken));
    sessionStart = millis();
    Serial.println(F("[AUTH] Session dipulihkan (NVS)"));
  }
}

void clearWebSession() {
  sessionToken[0] = '\0';
  sessionStart = 0;
  prefs.begin("retort", false);
  prefs.remove(K_WEB_SESS);
  prefs.end();
}

void generateSession() {
  char raw[64];
  snprintf(raw, sizeof(raw), "%08lx%08lx%lu",
           (unsigned long)esp_random(), (unsigned long)esp_random(), millis());
  sha256Hex(raw, sessionToken);
  sessionStart = millis();
  saveWebSession();
}

static bool tokenMatchesSession(const String& v) {
  if (v.length() == 0 || v.length() > 64) return false;
  if (!v.equals(sessionToken)) return false;
  sessionStart = millis();
  return true;
}

bool isSessionValid(AsyncWebServerRequest* req) {
  if (sessionToken[0] == '\0') return false;
  if (millis() - sessionStart > SESSION_TIMEOUT_MS) {
    clearWebSession();
    return false;
  }
  // Cookie dulu — andal bila sessionStorage HP stale/kosong
  if (req->hasHeader("Cookie")) {
    String c = req->header("Cookie");
    int i = c.indexOf("session=");
    if (i >= 0) {
      String v = c.substring(i + 8);
      int s = v.indexOf(';');
      if (s > 0) v = v.substring(0, s);
      v.trim();
      if (tokenMatchesSession(v)) return true;
    }
  }
  if (req->hasHeader("X-Session")) {
    if (tokenMatchesSession(req->header("X-Session"))) return true;
  }
  if (req->hasParam("t")) {
    if (tokenMatchesSession(req->getParam("t")->value())) return true;
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

// Format P/S mirror TNL: "pattern-step" (contoh "2-01").
void tnlFormatPs(char* out, size_t outLen) {
  snprintf(out, outLen, "%u-%02u", (unsigned)state.pattern, (unsigned)state.step);
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
void getTimestampClock(char* buf, size_t len);
void getTimestampFile(char* buf, size_t len);
void getTimestampIso(char* buf, size_t len);
void fillTimestampFromRtc(char* clockBuf, size_t clockLen, char* isoBuf, size_t isoLen);
void rtcSyncNtp(bool force);
bool rtcIsOk();
bool rtcNtpIsSynced();
void setupSDLogger();
void loopSDLogger();
void sdLogEntry();
void sdServiceLog();
void sdStartLog();
void sdStopLog();
void setupOTA();
void loopOTA();
void setupWebAuth();
void setupWebDashboard();
void setupWebSettings();
void setupWebLogs();
void setupWebStorage();
void mvSimLoad();
void mvSimSetActive(bool on);
bool mvSimIsAvailable();
bool mvSimIsActive();
bool tnlDiIsActive();
float mvSimEffectivePercent();
uint16_t mvSimEffectiveRaw(uint16_t hardwareRaw);
bool mvSimTriggerStart(uint16_t hardwareMvRaw, uint16_t mvOnRaw);
bool mvSimTriggerEnd(bool ctrlRun, uint16_t hardwareMvRaw, uint16_t mvOnRaw);
bool mqttIsConnected();
bool mqttPublishRaw(const char* payload);
const char* sdCurrentLogPath();
void forwardSetup();
void forwardTick();
void forwardOnAck(const char* iso);
bool forwardIsWaitingAck();
void forwardOnMqttLost();

// ============================================================
//  Task logger: akuisisi Modbus + tulis SD, presisi 1 detik.
//  Prioritas lebih tinggi dari loop() Arduino, dipin ke core 1, jadi
//  walaupun loop() ke-block oleh mqtt.connect()/web, sampling tetap jalan.
// ============================================================
static void loggerTask(void* pv) {
  TickType_t last = xTaskGetTickCount();
  const TickType_t period = pdMS_TO_TICKS(1000);
  for (;;) {
    // Satu baca RTC/I2C per detik — cache clock + ISO + ts.
    fillTimestampFromRtc(gLastClock, sizeof(gLastClock), gLastIso, sizeof(gLastIso));
    strncpy(gLastTs, gLastClock, sizeof(gLastTs) - 1);
    gLastTs[sizeof(gLastTs) - 1] = '\0';
#if USE_MODBUS
    loopModbus();      // 1x poll PV+SV (timeout pendek, tak pernah block lama)
#endif
#if USE_SD
    sdServiceLog();    // tangani start/stop rekam + tulis 1 baris CSV
#endif
    vTaskDelayUntil(&last, period);  // jaga periode tepat 1000 ms
  }
}

void setup() {
  Serial.begin(115200);
  // Cegah USB-CDC mem-block task bila tak ada host yang membaca Serial.
  Serial.setTxTimeoutMs(0);
  delay(300);
  Serial.println(F("\n=== RetortLogger ==="));

  // Turunkan clock CPU: 160 MHz cukup cepat untuk web + Modbus,
  // mengurangi panas & konsumsi daya ESP32-S3.
  setCpuFrequencyMhz(160);

  state.phase        = PHASE_IDLE;
  state.temperature  = 25.0f;
  state.setpoint     = 121.0f;
  state.pressure     = 1.013f;
  state.mv           = 0.0f;
  state.ctrlRun      = false;
  state.pattern      = 0;
  state.step         = 0;
  strncpy(state.totMs, "00:00", sizeof(state.totMs));
  strncpy(state.stpMs, "00:00", sizeof(state.stpMs));
  state.phaseStartMs = 0;
  state.wifiConnected = false;
  state.mqttConnected = false;
  state.sdReady       = false;
  state.logging       = false;

  loadConfig();
  loadWebSession();
  mvSimLoad();
  forwardSetup();
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

  // Buat mutex SD & seed timestamp SEBELUM task logger jalan.
  gSdMutex = xSemaphoreCreateMutex();
  fillTimestampFromRtc(gLastClock, sizeof(gLastClock), gLastIso, sizeof(gLastIso));
  strncpy(gLastTs, gLastClock, sizeof(gLastTs) - 1);
  gLastTs[sizeof(gLastTs) - 1] = '\0';

  // Task logger di core 1, prioritas 3 (di atas loop Arduino = prioritas 1).
  // Stack 8 KB cukup untuk SD + snprintf.
  xTaskCreatePinnedToCore(loggerTask, "logger", 8192, NULL, 3, NULL, 1);

  Serial.println(F("=== Ready ==="));
}

void loop() {
  loopWiFiAP();
  loopMQTT();
#if USE_RTC
  loopRTC();
#endif
#if USE_FAKE_SENSOR
  loopRetortSim();
#endif
#if USE_OTA
  loopOTA();
#endif
  // Modbus & SD logging pindah ke loggerTask (core 1, prioritas tinggi)
  // agar tidak terganggu blocking jaringan di sini.
  delay(1);  // yield — beri waktu task lain & cegah busy-spin
}
