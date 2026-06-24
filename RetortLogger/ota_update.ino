// ============================================================
//  ota_update.ino  –  OTA firmware update
//  Aktif jika USE_OTA = true
//  Library: ArduinoOTA (built-in)
// ============================================================

#if USE_OTA

#include <ArduinoOTA.h>

extern AppConfig cfg;

void setupOTA() {
  ArduinoOTA.setHostname(cfg.machineId);
  // TODO(security): Ganti password OTA dengan nilai yang lebih kuat di produksi
  ArduinoOTA.setPassword("retort-ota-secure");

  ArduinoOTA.onStart([]() {
    String type = (ArduinoOTA.getCommand() == U_FLASH) ? "sketch" : "filesystem";
    Serial.println("[OTA] Start: " + type);
  });
  ArduinoOTA.onEnd([]() {
    Serial.println(F("\n[OTA] Done. Rebooting..."));
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("[OTA] %u%%\r", (progress * 100) / total);
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("[OTA] Error[%u]: ", error);
    if      (error == OTA_AUTH_ERROR)    Serial.println(F("Auth Failed"));
    else if (error == OTA_BEGIN_ERROR)   Serial.println(F("Begin Failed"));
    else if (error == OTA_CONNECT_ERROR) Serial.println(F("Connect Failed"));
    else if (error == OTA_RECEIVE_ERROR) Serial.println(F("Receive Failed"));
    else if (error == OTA_END_ERROR)     Serial.println(F("End Failed"));
  });

  ArduinoOTA.begin();
  Serial.printf("[OTA] Ready. Host=%s\n", cfg.machineId);
}

void loopOTA() {
  ArduinoOTA.handle();
}

#else  // USE_OTA = false – stubs

void setupOTA() {}
void loopOTA()  {}

#endif
