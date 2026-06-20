// ============================================================
//  rtc_hw.ino  –  DS3231M RTC (disabled by default)
//  Active when USE_RTC = true
//  Library: RTClib (Adafruit)
//  Hardware: I2C – SDA=GPIO8, SCL=GPIO9 (ESP32-S3 default)
// ============================================================

#if USE_RTC

#include <RTClib.h>

static RTC_DS3231 rtc;

void rtcSetup() {
  Wire.begin();   // SDA=8, SCL=9 on ESP32-S3; change if needed
  if (!rtc.begin()) {
    Serial.println(F("[RTC] DS3231M not found! Check wiring."));
    return;
  }
  if (rtc.lostPower()) {
    Serial.println(F("[RTC] Lost power – setting compile time."));
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  Serial.println(F("[RTC] Initialized."));
}

// Fills buf with "YYYY-MM-DD HH:MM:SS"
void rtcGetTimestamp(char* buf, size_t len) {
  DateTime now = rtc.now();
  snprintf(buf, len, "%04d-%02d-%02d %02d:%02d:%02d",
           now.year(), now.month(),  now.day(),
           now.hour(), now.minute(), now.second());
}

#else  // USE_RTC = false – stubs

void rtcSetup() {}
void rtcGetTimestamp(char* buf, size_t len) {
  // Fallback handled in RetortLogger.ino
  if (len > 0) buf[0] = '\0';
}

#endif
