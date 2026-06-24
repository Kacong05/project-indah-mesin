// ============================================================
//  web_logs.ino  –  Log CSV list + download
//  Lightweight HTML
// ============================================================

extern RetortState    state;
extern AsyncWebServer server;

static const char LOGS_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Logs</title>
<style>
body{font-family:system-ui,Arial,sans-serif;background:#f4f5f7;color:#222;margin:0;display:flex}
nav{width:150px;background:#1f2937;min-height:100vh}
nav a{display:block;padding:11px 16px;color:#cbd5e1;text-decoration:none;font-size:14px}
nav a:hover{background:#374151;color:#fff}
nav a.a{background:#374151;color:#fff;border-left:3px solid #2563eb}
.m{flex:1;padding:18px}
h1{font-size:19px;margin:0 0 14px}
.warn{background:#fef3c7;color:#92400e;padding:10px;border-radius:4px;margin-bottom:12px;display:none}
table{width:100%;border-collapse:collapse;font-size:14px;background:#fff}
th{background:#f0f1f3;padding:8px;text-align:left;color:#555}
td{padding:8px;border-top:1px solid #e3e3e3}
.dl{background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:13px}
.dlt{background:#16a34a;color:#fff;border:none;padding:9px 18px;border-radius:4px;cursor:pointer;margin-bottom:12px;font-size:14px}
.empty{color:#888;padding:20px;text-align:center}
@media(max-width:600px){nav{width:100%;min-height:auto;display:flex;flex-wrap:wrap}
nav a{flex:1;text-align:center;padding:9px 4px;font-size:13px}.m{padding:12px}}
</style></head><body>
<nav>
<a href="/dashboard">Dashboard</a>
<a href="/settings">Settings</a>
<a href="/logs" class="a">Log</a>
<a href="/storage">Storage</a>
<a href="/logout">Logout</a>
</nav>
<div class="m">
<h1>Log Files</h1>
<div class="warn" id="w">SD Card tidak tersedia.</div>
<button class="dlt" id="bl" onclick="location='/api/dl?latest=1'">Download Terbaru</button>
<table><thead><tr><th>File</th><th>Ukuran</th><th></th></tr></thead>
<tbody id="tb"></tbody></table>
<p class="empty" id="em" style="display:none">Tidak ada file.</p>
</div>
<script>
function fs(b){if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(2)+' MB';}
fetch('/api/logs').then(function(r){
if(r.status==401){location='/login';return null}return r.json()
}).then(function(d){if(!d)return;
if(!d.sd){document.getElementById('w').style.display='block';
document.getElementById('bl').style.display='none';
document.getElementById('em').style.display='block';return;}
var tb=document.getElementById('tb');
if(!d.files||!d.files.length){document.getElementById('em').style.display='block';return;}
d.files.forEach(function(f){
var tr=document.createElement('tr');
var t1=document.createElement('td');t1.textContent=f.name;
var t2=document.createElement('td');t2.textContent=fs(f.size);
var t3=document.createElement('td');
var b=document.createElement('button');b.className='dl';b.textContent='Download';
b.addEventListener('click',function(){location='/api/dl?path=/retort/'+encodeURIComponent(f.name);});
t3.appendChild(b);
tr.appendChild(t1);tr.appendChild(t2);tr.appendChild(t3);tb.appendChild(tr);
});}).catch(function(){});
</script>
</body></html>
)rawliteral";

void setupWebLogs() {
  server.on("/logs", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) { redirectToLogin(req); return; }
    req->send_P(200, "text/html", LOGS_HTML);
  });

  server.on("/api/logs", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }
#if USE_SD
    if (!state.sdReady) {
      req->send(200, "application/json", "{\"sd\":false,\"files\":[]}");
      return;
    }
    String json = "{\"sd\":true,\"files\":[";
    File dir = SD.open("/retort");
    bool first = true;
    if (dir && dir.isDirectory()) {
      File e = dir.openNextFile();
      while (e) {
        if (!e.isDirectory()) {
          if (!first) json += ',';
          String n = String(e.name());
          int sl = n.lastIndexOf('/');
          if (sl >= 0) n = n.substring(sl + 1);
          json += "{\"name\":\"" + n + "\",\"size\":" + String((unsigned long)e.size()) + "}";
          first = false;
        }
        e.close();
        e = dir.openNextFile();
      }
      dir.close();
    }
    json += "]}";
    req->send(200, "application/json", json);
#else
    req->send(200, "application/json", "{\"sd\":false,\"files\":[]}");
#endif
  });

  server.on("/api/dl", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) {
      req->send(401, "text/plain", "Unauthorized");
      return;
    }
#if USE_SD
    if (!state.sdReady) { req->send(503, "text/plain", "SD error"); return; }

    if (req->hasParam("latest")) {
      File dir = SD.open("/retort");
      String last = "";
      if (dir && dir.isDirectory()) {
        File e = dir.openNextFile();
        while (e) {
          if (!e.isDirectory()) last = String(e.name());
          e.close();
          e = dir.openNextFile();
        }
        dir.close();
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
