// ============================================================
//  rtc_hw.ino  –  DS3231M RTC (SDA=8, SCL=9) — zona WIB (UTC+7)
// ============================================================

#if USE_RTC

#include <RTClib.h>
#include <Wire.h>
#include <time.h>
#include <WiFi.h>

static RTC_DS3231 rtcModule;
static bool rtcOk = false;
static bool rtcNtpSynced = false;
static unsigned long rtcLastNtpTry = 0;

// WIB = UTC+7, Indonesia tidak pakai DST
static const long WIB_OFFSET_SEC = 7L * 3600L;

bool rtcIsOk() { return rtcOk; }
bool rtcNtpIsSynced() { return rtcNtpSynced; }

void setupRTC() {
  Wire.begin(PIN_RTC_SDA, PIN_RTC_SCL);
  if (!rtcModule.begin()) {
    Serial.println(F("[RTC] Not found!"));
    return;
  }
  rtcOk = true;
  if (rtcModule.lostPower()) {
    Serial.println(F("[RTC] Lost power — fallback compile time, NTP WIB saat WiFi OK."));
    rtcModule.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  DateTime now = rtcModule.now();
  Serial.printf("[RTC] OK (WIB): %04d-%02d-%02d %02d:%02d:%02d\n",
    now.year(), now.month(), now.day(),
    now.hour(), now.minute(), now.second());
}

void loopRTC() {}

// Sinkron DS3231 dari NTP (Asia/Jakarta / WIB). Dipanggil saat WiFi STA connect.
void rtcSyncNtp(bool force) {
  if (!rtcOk || WiFi.status() != WL_CONNECTED) return;

  unsigned long nowMs = millis();
  if (!force && rtcNtpSynced && (nowMs - rtcLastNtpTry < 3600000UL)) return;
  if (!force && (nowMs - rtcLastNtpTry < 20000UL)) return;
  rtcLastNtpTry = nowMs;

  configTime(WIB_OFFSET_SEC, 0, "id.pool.ntp.org", "pool.ntp.org", "time.google.com");

  struct tm timeinfo;
  for (int i = 0; i < 30; i++) {
    if (getLocalTime(&timeinfo, 500)) {
      rtcModule.adjust(DateTime(
        timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
        timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec));
      rtcNtpSynced = true;
      Serial.printf("[RTC] NTP→WIB OK: %04d-%02d-%02d %02d:%02d:%02d\n",
        timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
        timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
      return;
    }
    delay(100);
  }
  Serial.println(F("[RTC] NTP sync gagal — pakai waktu RTC hardware"));
}

// Format manusia: "DD-MM-YYYY HH:MM:SS WIB" — dashboard, CSV, MQTT ts
void getTimestampClock(char* buf, size_t len) {
  if (!rtcOk) {
    snprintf(buf, len, "--/--/---- --:--:-- WIB");
    return;
  }
  DateTime now = rtcModule.now();
  snprintf(buf, len, "%02d-%02d-%04d %02d:%02d:%02d WIB",
           now.day(), now.month(), now.year(),
           now.hour(), now.minute(), now.second());
}

void getTimestamp(char* buf, size_t len) {
  getTimestampClock(buf, len);
}

void getTimestampFile(char* buf, size_t len) {
  if (!rtcOk) { snprintf(buf, len, "00000000_000000"); return; }
  DateTime now = rtcModule.now();
  snprintf(buf, len, "%04d%02d%02d_%02d%02d%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());
}

// ISO-8601 +07:00 — sama sumber RTC, dipakai MQTT recorded_at
void getTimestampIso(char* buf, size_t len) {
  if (!rtcOk) { snprintf(buf, len, "1970-01-01T00:00:00+07:00"); return; }
  DateTime now = rtcModule.now();
  snprintf(buf, len, "%04d-%02d-%02dT%02d:%02d:%02d+07:00",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());
}

#else

bool rtcIsOk() { return false; }
bool rtcNtpIsSynced() { return false; }
void setupRTC() {}
void loopRTC() {}
void rtcSyncNtp(bool) {}

void getTimestamp(char* buf, size_t len) {
  unsigned long s = millis() / 1000;
  snprintf(buf, len, "UP_%lus", s);
}
void getTimestampClock(char* buf, size_t len) {
  unsigned long s = millis() / 1000;
  snprintf(buf, len, "UPTIME %lus", s);
}
void getTimestampFile(char* buf, size_t len) {
  snprintf(buf, len, "UP_%010lu", millis() / 1000);
}
void getTimestampIso(char* buf, size_t len) {
  snprintf(buf, len, "1970-01-01T00:00:00+07:00");
}

#endif
