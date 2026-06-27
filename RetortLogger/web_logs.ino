// ============================================================
//  web_logs.ino  –  Endpoint download CSV log
//  Halaman daftar log digabung ke /storage (lihat web_storage.ino).
//  /logs hanya redirect ke /storage agar link lama tetap jalan.
// ============================================================

extern RetortState    state;
extern AsyncWebServer server;
extern bool sdLock(uint32_t ms);
extern void sdUnlock();

#if USE_SD

#include <SD.h>

static void storBasename(const String& full, char* out, size_t outLen) {
  int sl = full.lastIndexOf('/');
  if (sl >= 0) full.substring(sl + 1).toCharArray(out, outLen);
  else full.toCharArray(out, outLen);
}

#endif

// Kirim file CSV sebagai attachment (browser HP & desktop).
void sendCsvDownload(AsyncWebServerRequest* req, const String& p) {
  if (!state.sdReady) { req->send(503, "text/plain", "SD error"); return; }
  if (p.length() == 0 || p.indexOf("..") >= 0 || !p.startsWith("/retort/")) {
    req->send(403, "text/plain", "Forbidden");
    return;
  }
  if (!SD.exists(p)) { req->send(404, "text/plain", "Not found"); return; }

  int slash = p.lastIndexOf('/');
  String fname = (slash >= 0) ? p.substring(slash + 1) : p;
  AsyncWebServerResponse* resp = req->beginResponse(SD, p, "text/csv", true);
  resp->addHeader("Content-Disposition",
    String("attachment; filename=\"") + fname + "\"");
  resp->addHeader("Cache-Control", "no-cache");
  req->send(resp);
}

static String findLatestCsv() {
  String latest = "";
  if (!sdLock(1500)) return latest;
  File dir = SD.open("/retort");
  if (dir && dir.isDirectory()) {
    File e = dir.openNextFile();
    while (e) {
      if (!e.isDirectory()) {
        char n[48];
        storBasename(String(e.name()), n, sizeof(n));
        if (strstr(n, ".csv") && (latest.length() == 0 || strcmp(n, latest.c_str()) > 0))
          latest = n;
      }
      e.close();
      e = dir.openNextFile();
    }
    dir.close();
  }
  sdUnlock();
  return latest;
}
#else
void sendCsvDownload(AsyncWebServerRequest* req, const String& p) {
  (void)p;
  req->send(503, "text/plain", "SD disabled");
}
#endif

void setupWebLogs() {
  server.on("/logs", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) { redirectToLogin(req); return; }
    req->redirect("/storage");
  });

  // Download CSV: ?latest=1 (file terbaru) atau ?path=/retort/<file>.csv
  server.on("/api/dl", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) {
      req->send(401, "text/plain", "Unauthorized");
      return;
    }
#if USE_SD
    if (req->hasParam("latest")) {
      String latest = findLatestCsv();
      if (latest.length() == 0) { req->send(404, "text/plain", "No files"); return; }
      sendCsvDownload(req, "/retort/" + latest);
      return;
    }
    if (!req->hasParam("path")) { req->send(400, "text/plain", "No path"); return; }
    sendCsvDownload(req, req->getParam("path")->value());
#else
    req->send(503, "text/plain", "SD disabled");
#endif
  });
}
