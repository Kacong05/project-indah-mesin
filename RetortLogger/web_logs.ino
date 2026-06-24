// ============================================================
//  web_logs.ino  –  Log page: list CSV files + download
// ============================================================

extern AppConfig      cfg;
extern RetortState    state;
extern AsyncWebServer server;

static const char LOGS_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RetortLogger - Logs</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh}
.sidebar{width:220px;background:#1e293b;padding:20px 0;display:flex;flex-direction:column;
border-right:1px solid #334155;position:fixed;height:100vh;overflow-y:auto}
.sidebar h2{padding:0 20px;color:#38bdf8;font-size:1.1em;margin-bottom:20px}
.sidebar a{display:block;padding:12px 20px;color:#94a3b8;text-decoration:none;font-size:0.95em;
transition:all 0.2s}
.sidebar a:hover,.sidebar a.active{background:#334155;color:#38bdf8}
.main{margin-left:220px;flex:1;padding:30px}
h1{margin-bottom:24px;color:#f1f5f9;font-size:1.6em}
.warn{background:#78350f;color:#fbbf24;padding:16px;border-radius:8px;margin-bottom:20px;display:none}
.tbl{width:100%;border-collapse:collapse;background:#1e293b;border-radius:12px;overflow:hidden}
.tbl th{background:#334155;padding:12px 16px;text-align:left;color:#94a3b8;font-size:0.85em}
.tbl td{padding:12px 16px;border-top:1px solid #334155;font-size:0.9em}
.tbl tr:hover{background:#334155}
.dl-btn{background:#2563eb;color:#fff;border:none;padding:6px 16px;border-radius:6px;
cursor:pointer;font-size:0.85em}
.dl-btn:hover{background:#1d4ed8}
.btn-latest{background:#059669;color:#fff;border:none;padding:12px 24px;border-radius:8px;
cursor:pointer;font-size:0.95em;font-weight:600;margin-bottom:20px}
.btn-latest:hover{background:#047857}
.empty{color:#94a3b8;text-align:center;padding:40px}
@media(max-width:768px){
.sidebar{width:100%;height:auto;position:relative;flex-direction:row;flex-wrap:wrap;
border-right:none;border-bottom:1px solid #334155}
.sidebar h2{width:100%}
.sidebar a{flex:1;text-align:center;padding:10px 8px;font-size:0.8em}
.main{margin-left:0}
}
</style></head><body>
<nav class="sidebar">
<h2>&#x1F3ED; RetortLogger</h2>
<a href="/dashboard">&#x1F4CA; Dashboard</a>
<a href="/settings">&#x2699;&#xFE0F; Settings</a>
<a href="/logs" class="active">&#x1F4C4; Log</a>
<a href="/storage">&#x1F4BE; Storage</a>
<a href="/logout">&#x1F6AA; Logout</a>
</nav>
<div class="main">
<h1>Log Files</h1>
<div class="warn" id="warn">&#x26A0; SD Card is not available.</div>
<button class="btn-latest" id="btnLatest" onclick="downloadLatest()">&#x1F4E5; Download Log Terbaru</button>
<table class="tbl">
<thead><tr><th>Nama File</th><th>Ukuran</th><th>Aksi</th></tr></thead>
<tbody id="tbody"></tbody>
</table>
<p class="empty" id="empty" style="display:none">Tidak ada file log.</p>
</div>
<script>
function formatSize(b){
  if(b<1024)return b+' B';
  if(b<1048576)return (b/1024).toFixed(1)+' KB';
  return (b/1048576).toFixed(2)+' MB';
}
function loadLogs(){
  fetch('/api/logs').then(function(r){
    if(r.status===401){window.location.href='/login';return null;}
    return r.json();
  }).then(function(d){
    if(!d)return;
    if(!d.sd){
      document.getElementById('warn').style.display='block';
      document.getElementById('btnLatest').style.display='none';
      document.getElementById('empty').style.display='block';
      return;
    }
    var tb=document.getElementById('tbody');
    tb.textContent='';
    if(!d.files||d.files.length===0){
      document.getElementById('empty').style.display='block';
      return;
    }
    d.files.forEach(function(f){
      var tr=document.createElement('tr');
      var td1=document.createElement('td');
      td1.textContent=f.name;
      var td2=document.createElement('td');
      td2.textContent=formatSize(f.size);
      var td3=document.createElement('td');
      var btn=document.createElement('button');
      btn.className='dl-btn';
      btn.textContent='Download';
      btn.addEventListener('click',function(){
        window.location.href='/api/download?path=/retort/'+encodeURIComponent(f.name);
      });
      td3.appendChild(btn);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tb.appendChild(tr);
    });
  }).catch(function(){});
}
function downloadLatest(){
  window.location.href='/api/download?latest=1';
}
loadLogs();
</script>
</body></html>
)rawliteral";

void setupWebLogs() {
  // Logs page
  server.on("/logs", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!isSessionValid(request)) { redirectToLogin(request); return; }
    request->send_P(200, "text/html", LOGS_HTML);
  });

  // API: list log files
  server.on("/api/logs", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!isSessionValid(request)) {
      request->send(401, "application/json", "{\"ok\":false}");
      return;
    }

#if USE_SD
    if (!state.sdReady) {
      request->send(200, "application/json", "{\"sd\":false,\"files\":[]}");
      return;
    }

    String json = "{\"sd\":true,\"files\":[";
    File dir = SD.open("/retort");
    bool first = true;
    if (dir && dir.isDirectory()) {
      File entry = dir.openNextFile();
      while (entry) {
        if (!entry.isDirectory()) {
          if (!first) json += ",";
          json += "{\"name\":\"";
          // Sanitize filename: only output basename
          String fname = String(entry.name());
          int lastSlash = fname.lastIndexOf('/');
          if (lastSlash >= 0) fname = fname.substring(lastSlash + 1);
          json += fname;
          json += "\",\"size\":";
          json += String((unsigned long)entry.size());
          json += "}";
          first = false;
        }
        entry.close();
        entry = dir.openNextFile();
      }
      dir.close();
    }
    json += "]}";

    AsyncWebServerResponse* response = request->beginResponse(200,
      "application/json", json);
    response->addHeader("Cache-Control", "no-store");
    request->send(response);
#else
    request->send(200, "application/json", "{\"sd\":false,\"files\":[]}");
#endif
  });

  // API: download file
  server.on("/api/download", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!isSessionValid(request)) {
      request->send(401, "text/plain", "Unauthorized");
      return;
    }

#if USE_SD
    if (!state.sdReady) {
      request->send(503, "text/plain", "SD not ready");
      return;
    }

    // Download log terbaru
    if (request->hasParam("latest")) {
      File dir = SD.open("/retort");
      String lastFile = "";
      if (dir && dir.isDirectory()) {
        File entry = dir.openNextFile();
        while (entry) {
          if (!entry.isDirectory()) {
            lastFile = String(entry.name());
          }
          entry.close();
          entry = dir.openNextFile();
        }
        dir.close();
      }
      if (lastFile.length() == 0) {
        request->send(404, "text/plain", "No log files");
        return;
      }
      // Pastikan path absolute
      String fullPath = lastFile;
      if (!fullPath.startsWith("/")) fullPath = "/" + fullPath;

      request->send(SD, fullPath, "text/csv", true);
      return;
    }

    // Download specific file
    if (!request->hasParam("path")) {
      request->send(400, "text/plain", "Missing path");
      return;
    }
    String reqPath = request->getParam("path")->value();

    // Sanitasi path: cegah directory traversal
    if (reqPath.indexOf("..") >= 0) {
      request->send(403, "text/plain", "Forbidden");
      return;
    }
    // Pastikan path dimulai dari /retort/
    if (!reqPath.startsWith("/retort/")) {
      request->send(403, "text/plain", "Forbidden");
      return;
    }
    if (!SD.exists(reqPath)) {
      request->send(404, "text/plain", "Not found");
      return;
    }

    request->send(SD, reqPath, "text/csv", true);
#else
    request->send(503, "text/plain", "SD not enabled");
#endif
  });
}
