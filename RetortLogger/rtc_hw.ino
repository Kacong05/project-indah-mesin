// ============================================================
//  rtc_hw.ino  –  DS3231M RTC
//  Aktif jika USE_RTC = true
//  Library: RTClib (Adafruit)
// ============================================================

#if USE_RTC

#include <RTClib.h>

static RTC_DS3231 rtcModule;
static bool rtcAvailable = false;

void setupRTC() {
  Wire.begin();
  if (!rtcModule.begin()) {
    Serial.println(F("[RTC] DS3231 not found!"));
    return;
  }
  rtcAvailable = true;
  if (rtcModule.lostPower()) {
    Serial.println(F("[RTC] Lost power – setting compile time."));
    rtcModule.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  Serial.println(F("[RTC] Initialized."));
}

void loopRTC() {
  // RTC tidak perlu loop aktif
}

void getTimestamp(char* buf, size_t len) {
  if (!rtcAvailable) {
    // Fallback ke millis
    unsigned long s = millis() / 1000;
    snprintf(buf, len, "UP_%luh%02lum%02lus",
             s / 3600, (s % 3600) / 60, s % 60);
    return;
  }
  DateTime now = rtcModule.now();
  snprintf(buf, len, "%04d-%02d-%02d %02d:%02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());
}

#else  // USE_RTC = false – stubs

void setupRTC() {}
void loopRTC() {}

void getTimestamp(char* buf, size_t len) {
  unsigned long s = millis() / 1000;
  snprintf(buf, len, "UP_%luh%02lum%02lus",
           s / 3600, (s % 3600) / 60, s % 60);
}

#endif
