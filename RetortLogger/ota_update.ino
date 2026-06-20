// ============================================================
//  ota_update.ino  –  OTA firmware update (disabled by default)
//  Active when USE_OTA = true
//  Uses ArduinoOTA (built-in ESP32 Arduino core)
// ============================================================

#if USE_OTA

#include <ArduinoOTA.h>

extern AppConfig cfg;

void otaSetup() {
  ArduinoOTA.setHostname(cfg.deviceID);
  // TODO(security): Set a strong OTA password; do not ship with default.
  // In production, use cfg.deviceID-derived password or a stored secret.
  ArduinoOTA.setPassword("retort-ota-change-me");

  ArduinoOTA.onStart([]() {
    String type = (ArduinoOTA.getCommand() == U_FLASH) ? "sketch" : "filesystem";
    Serial.println("[OTA] Start: " + type);
  });

  ArduinoOTA.onEnd([]() {
    Serial.println(F("\n[OTA] End. Rebooting..."));
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
  Serial.printf("[OTA] Ready. Host=%s\n", cfg.deviceID);
}

void otaLoop() {
  ArduinoOTA.handle();
}

#else  // USE_OTA = false – stubs

void otaSetup() {}
void otaLoop()  {}

#endif
