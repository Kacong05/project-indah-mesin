// ============================================================
//  rtc_hw.ino  –  DS3231M RTC (SDA=8, SCL=9)
// ============================================================

#if USE_RTC

#include <RTClib.h>
#include <Wire.h>

static RTC_DS3231 rtcModule;
static bool rtcOk = false;

void setupRTC() {
  Wire.begin(PIN_RTC_SDA, PIN_RTC_SCL);
  if (!rtcModule.begin()) {
    Serial.println(F("[RTC] Not found!"));
    return;
  }
  rtcOk = true;
  if (rtcModule.lostPower()) {
    Serial.println(F("[RTC] Lost power – setting compile time."));
    rtcModule.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  DateTime now = rtcModule.now();
  Serial.printf("[RTC] OK: %04d-%02d-%02d %02d:%02d:%02d\n",
    now.year(), now.month(), now.day(),
    now.hour(), now.minute(), now.second());
}

void loopRTC() {}

// Format: "M/D/YYYY h:mm:ssPM" sesuai output CSV
void getTimestamp(char* buf, size_t len) {
  if (!rtcOk) {
    snprintf(buf, len, "0/0/0000 0:00:00AM");
    return;
  }
  DateTime now = rtcModule.now();
  int h = now.hour();
  const char* ampm = (h >= 12) ? "PM" : "AM";
  if (h == 0) h = 12;
  else if (h > 12) h -= 12;
  snprintf(buf, len, "%d/%d/%04d %d:%02d:%02d%s",
           now.month(), now.day(), now.year(),
           h, now.minute(), now.second(), ampm);
}

// Nama file log sortable & tak ambigu: "YYYYMMDD_HHMMSS" (24 jam).
// Urut leksikografis = urut kronologis → list "terbaru dulu" cukup sort desc.
void getTimestampFile(char* buf, size_t len) {
  if (!rtcOk) { snprintf(buf, len, "00000000_000000"); return; }
  DateTime now = rtcModule.now();
  snprintf(buf, len, "%04d%02d%02d_%02d%02d%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());
}

#else

void setupRTC() {}
void loopRTC() {}
void getTimestamp(char* buf, size_t len) {
  unsigned long s = millis() / 1000;
  snprintf(buf, len, "UP_%lus", s);
}
void getTimestampFile(char* buf, size_t len) {
  snprintf(buf, len, "UP_%010lu", millis() / 1000);
}

#endif
