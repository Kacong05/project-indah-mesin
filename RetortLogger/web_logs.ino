// ============================================================
//  web_logs.ino  –  Endpoint download CSV log
//  Halaman daftar log digabung ke /storage (lihat web_storage.ino).
//  /logs hanya redirect ke /storage agar link lama tetap jalan.
// ============================================================

extern RetortState    state;
extern AsyncWebServer server;
extern bool sdLock(uint32_t ms);
extern void sdUnlock();

void setupWebLogs() {
  // Kompatibilitas: arahkan /logs ke halaman gabungan /storage.
  server.on("/logs", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) { redirectToLogin(req); return; }
    req->redirect("/storage");
  });

  // Download CSV: ?latest=1 (file terbaru) atau ?path=/retort/<file>.
  server.on("/api/dl", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) {
      req->send(401, "text/plain", "Unauthorized");
      return;
    }
#if USE_SD
    if (!state.sdReady) { req->send(503, "text/plain", "SD error"); return; }

    if (req->hasParam("latest")) {
      String last = "";
      if (sdLock(600)) {
        File dir = SD.open("/retort");
        if (dir && dir.isDirectory()) {
          File e = dir.openNextFile();
          while (e) {
            if (!e.isDirectory()) last = String(e.name());
            e.close();
            e = dir.openNextFile();
          }
          dir.close();
        }
        sdUnlock();
      }
      if (last.length() == 0) { req->send(404, "text/plain", "No files"); return; }
      if (!last.startsWith("/")) last = "/" + last;
      req->send(SD, last, "text/csv", true);
      return;
    }

    if (!req->hasParam("path")) { req->send(400, "text/plain", "No path"); return; }
    String p = req->getParam("path")->value();
    if (p.indexOf("..") >= 0 || !p.startsWith("/retort/")) {
      req->send(403, "text/plain", "Forbidden");
      return;
    }
    if (!SD.exists(p)) { req->send(404, "text/plain", "Not found"); return; }
    req->send(SD, p, "text/csv", true);
#else
    req->send(503, "text/plain", "SD disabled");
#endif
  });
}
