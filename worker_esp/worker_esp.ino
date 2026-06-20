/**
 * worker_esp.ino
 * 
 * Deskripsi:
 * Sketch Arduino / ESP8266 / ESP32 yang meniru fungsi python worker.py.
 * Mengaktifkan WiFi dengan mode Access Point (WiFiManager) terlebih dahulu untuk 
 * konfigurasi SSID, Password WiFi, Kode Mesin Retort, dan URL API, 
 * lalu mengirimkan simulasi data sensor suhu dan tekanan ke API server secara periodik.
 * 
 * Library yang dibutuhkan:
 * 1. WiFiManager by tzapu (install via Library Manager)
 * 2. ArduinoJson by Benoit Blanchon (install via Library Manager)
 */

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
#elif defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
#endif

#include <WiFiManager.h> // https://github.com/tzapu/WiFiManager
#include <ArduinoJson.h> // https://github.com/bblanchon/ArduinoJson
#include <EEPROM.h>

// Struktur data untuk menyimpan konfigurasi ke EEPROM
struct Config {
  char machine_code[32];
  char api_url[128];
  char signature[4]; // Pengaman penanda EEPROM telah di-init
};

Config configData;
const char* EEPROM_SIGNATURE = "RET";

// Default Konfigurasi jika EEPROM kosong
const char* DEFAULT_MACHINE_CODE = "RT-001";
const char* DEFAULT_API_URL = "http://192.168.1.100:8000/api/sensor"; // Ganti dengan IP server Laravel Anda

// Flag untuk menyimpan konfigurasi baru dari WiFiManager
bool shouldSaveConfig = false;

// Callback untuk WiFiManager jika config mode aktif
void configModeCallback(WiFiManager *myWiFiManager) {
  Serial.println("=== MODE KONFIGURASI AKTIF ===");
  Serial.print("Silakan hubungkan ke WiFi AP: ");
  Serial.println(myWiFiManager->getConfigPortalSSID());
  Serial.print("Buka browser dan akses alamat IP: ");
  Serial.println(WiFi.softAPIP());
  Serial.println("==============================");
}

// Callback jika konfigurasi diubah di portal
void saveConfigCallback() {
  Serial.println("Konfigurasi baru diterima, bersiap menyimpan...");
  shouldSaveConfig = true;
}

void loadConfiguration() {
  EEPROM.begin(sizeof(Config));
  EEPROM.get(0, configData);
  
  // Jika signature tidak cocok, isi dengan nilai default
  if (strcmp(configData.signature, EEPROM_SIGNATURE) != 0) {
    Serial.println("EEPROM kosong atau belum terkonfigurasi. Menggunakan nilai default.");
    strncpy(configData.machine_code, DEFAULT_MACHINE_CODE, sizeof(configData.machine_code));
    strncpy(configData.api_url, DEFAULT_API_URL, sizeof(configData.api_url));
    strncpy(configData.signature, EEPROM_SIGNATURE, sizeof(configData.signature));
  } else {
    Serial.println("Konfigurasi berhasil dimuat dari EEPROM:");
    Serial.print(" -> Kode Mesin: ");
    Serial.println(configData.machine_code);
    Serial.print(" -> Target API: ");
    Serial.println(configData.api_url);
  }
}

void saveConfiguration() {
  Serial.println("Menyimpan konfigurasi ke EEPROM...");
  EEPROM.put(0, configData);
  EEPROM.commit();
  Serial.println("Konfigurasi berhasil disimpan!");
}

void setup() {
  // Inisialisasi Serial
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n========================================");
  Serial.println("ESP WORKER SIMULASI RETORT");
  Serial.println("========================================");

  // Load konfigurasi dari EEPROM
  loadConfiguration();

  // Inisialisasi WiFiManager
  WiFiManager wm;
  
  // Set callback
  wm.setAPCallback(configModeCallback);
  wm.setSaveConfigCallback(saveConfigCallback);

  // Buat custom parameter untuk Kode Mesin dan API URL
  // WiFiManagerParameter(id, placeholder, default_value, length)
  WiFiManagerParameter custom_machine_code("machine_code", "Kode Mesin / Seri Retort", configData.machine_code, 32);
  WiFiManagerParameter custom_api_url("api_url", "Target URL API Laravel", configData.api_url, 128);

  // Tambahkan parameter ke WiFiManager
  wm.addParameter(&custom_machine_code);
  wm.addParameter(&custom_api_url);

  // Buat nama AP unik untuk konfigurasi berdasarkan Chip ID
  String apName = "ESP_Retort_";
  #if defined(ESP8266)
    apName += String(ESP.getChipId(), HEX);
  #elif defined(ESP32)
    apName += String((uint32_t)ESP.getEfuseMac(), HEX);
  #endif
  apName.toUpperCase();

  // Autoconnect: mencoba konek ke WiFi yang tersimpan, jika gagal, buat AP untuk konfigurasi
  // Jika dalam 3 menit tidak dikonfigurasi, ESP akan restart
  wm.setConfigPortalTimeout(180); 
  
  if (!wm.autoConnect(apName.c_str())) {
    Serial.println("Gagal terhubung ke WiFi & timeout portal konfigurasi tercapai. Restarting...");
    delay(3000);
    ESP.restart();
  }

  // Jika berhasil terhubung
  Serial.println("\n✅ WiFi Terhubung!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Simpan parameter baru jika ada perubahan di Web Portal WiFiManager
  if (shouldSaveConfig) {
    strncpy(configData.machine_code, custom_machine_code.getValue(), sizeof(configData.machine_code));
    strncpy(configData.api_url, custom_api_url.getValue(), sizeof(configData.api_url));
    saveConfiguration();
  }

  Serial.println("========================================");
  Serial.print("Kode Mesin Aktif : ");
  Serial.println(configData.machine_code);
  Serial.print("Target API URL   : ");
  Serial.println(configData.api_url);
  Serial.println("========================================\n");
}

void loop() {
  // Cek koneksi WiFi sebelum mengirim data
  if (WiFi.status() == WL_CONNECTED) {
    // Generate data sensor acak (Simulasi Suhu: 115.0 - 125.0 °C, Tekanan: 1.5 - 2.5 bar)
    float temperature = 115.0 + ((float)random(0, 1000) / 100.0);
    float pressure = 1.5 + ((float)random(0, 100) / 100.0);

    // Siapkan JSON payload menggunakan ArduinoJson
    StaticJsonDocument<200> doc;
    doc["machine_code"] = configData.machine_code;
    doc["temperature"] = temperature;
    doc["pressure"] = pressure;
    doc["process_status"] = "running";

    String jsonString;
    serializeJson(doc, jsonString);

    // Kirim HTTP POST ke API
    WiFiClient client;
    HTTPClient http;

    Serial.print("Mengirim data: Suhu = ");
    Serial.print(temperature);
    Serial.print(" °C, Tekanan = ");
    Serial.print(pressure);
    Serial.println(" bar...");

    http.begin(client, configData.api_url);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(jsonString);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("✅ Sukses (HTTP ");
      Serial.print(httpResponseCode);
      Serial.print("): ");
      Serial.println(response);
    } else {
      Serial.print("❌ Gagal mengirim, error: ");
      Serial.println(http.errorToString(httpResponseCode).c_str());
    }

    http.end();
  } else {
    Serial.println("⚠️ Koneksi WiFi terputus! Mencoba menghubungkan kembali...");
  }

  // Jeda 5 detik sebelum mengirim data berikutnya
  delay(5000);
}
