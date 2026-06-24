// ============================================================
//  web_dashboard.ino  –  Dashboard page + status API
// ============================================================

extern AppConfig      cfg;
extern RetortState    state;
extern AsyncWebServer server;

static const char DASHBOARD_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RetortLogger - Dashboard</title>
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
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:24px}
.card{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
.card .label{color:#94a3b8;font-size:0.8em;margin-bottom:4px}
.card .value{font-size:1.4em;font-weight:700;color:#f1f5f9}
.card .value.ok{color:#34d399}
.card .value.err{color:#f87171}
.card .value.warn{color:#fbbf24}
.btn-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
.btn{padding:12px 28px;border:none;border-radius:8px;font-size:0.95em;cursor:pointer;
font-weight:600;transition:all 0.2s}
.btn-start{background:#059669;color:#fff}
.btn-start:hover{background:#047857}
.btn-stop{background:#dc2626;color:#fff}
.btn-stop:hover{background:#b91c1c}
.btn-restart{background:#d97706;color:#fff}
.btn-restart:hover{background:#b45309}
.btn:disabled{opacity:0.5;cursor:not-allowed}
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
<a href="/dashboard" class="active">&#x1F4CA; Dashboard</a>
<a href="/settings">&#x2699;&#xFE0F; Settings</a>
<a href="/logs">&#x1F4C4; Log</a>
<a href="/storage">&#x1F4BE; Storage</a>
<a href="/logout">&#x1F6AA; Logout</a>
</nav>
<div class="main">
<h1>Dashboard</h1>
<div class="grid">
<div class="card"><div class="label">WiFi Status</div><div class="value" id="wifi">--</div></div>
<div class="card"><div class="label">MQTT Status</div><div class="value" id="mqtt">--</div></div>
<div class="card"><div class="label">Current Phase</div><div class="value" id="phase">--</div></div>
<div class="card"><div class="label">Temperature</div><div class="value" id="temp">-- &deg;C</div></div>
<div class="card"><div class="label">Pressure</div><div class="value" id="pres">-- atm</div></div>
<div class="card"><div class="label">SD Card</div><div class="value" id="sd">--</div></div>
</div>
<div class="btn-row">
<button class="btn btn-start" id="btnStart" onclick="doCmd('start')">&#x25B6; Start Process</button>
<button class="btn btn-stop" id="btnStop" onclick="doCmd('stop')">&#x23F9; Stop Process</button>
<button class="btn btn-restart" onclick="doCmd('restart')">&#x1F504; Restart ESP32</button>
</div>
</div>
<script>
function update(){
  fetch('/api/status').then(function(r){
    if(r.status===401){window.location.href='/login';return null;}
    return r.json();
  }).then(function(d){
    if(!d)return;
    var w=document.getElementById('wifi');
    w.textContent=d.wifi?'Connected':'Disconnected';
    w.className='value '+(d.wifi?'ok':'err');
    var m=document.getElementById('mqtt');
    m.textContent=d.mqtt?'Connected':'Disconnected';
    m.className='value '+(d.mqtt?'ok':'err');
    var p=document.getElementById('phase');
    p.textContent=d.phase;
    p.className='value '+(d.phase==='IDLE'?'':'warn');
    document.getElementById('temp').textContent=d.temp.toFixed(2)+' \u00B0C';
    document.getElementById('pres').textContent=d.pres.toFixed(3)+' atm';
    var s=document.getElementById('sd');
    s.textContent=d.sd?'Ready':'Not Available';
    s.className='value '+(d.sd?'ok':'err');
    document.getElementById('btnStart').disabled=(d.phase!=='IDLE');
    document.getElementById('btnStop').disabled=(d.phase==='IDLE');
  }).catch(function(){});
}
function doCmd(c){
  fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({cmd:c})
  }).then(function(r){
    if(r.status===401)window.location.href='/login';
    return r.json();
  }).then(function(d){
    if(d&&d.msg)update();
  }).catch(function(){});
}
update();
setInterval(update,2000);
</script>
</body></html>
)rawliteral";

void setupWebDashboard() {
  // Dashboard page
  server.on("/dashboard", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!isSessionValid(request)) { redirectToLogin(request); return; }
    request->send_P(200, "text/html", DASHBOARD_HTML);
  });

  // Status API (polled every 2s)
  server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!isSessionValid(request)) {
      request->send(401, "application/json", "{\"ok\":false}");
      return;
    }
    StaticJsonDocument<256> doc;
    doc["wifi"]  = state.wifiConnected;
    doc["mqtt"]  = state.mqttConnected;
    doc["phase"] = phaseName(state.phase);
    doc["temp"]  = state.temperature;
    doc["pres"]  = state.pressure;
    doc["sd"]    = state.sdReady;

    char buf[256];
    serializeJson(doc, buf, sizeof(buf));

    AsyncWebServerResponse* response = request->beginResponse(200,
      "application/json", buf);
    response->addHeader("Cache-Control", "no-store");
    request->send(response);
  });

  // Command API
  server.on("/api/command", HTTP_POST,
    [](AsyncWebServerRequest* request) {
      request->send(400, "application/json", "{\"ok\":false}");
    },
    NULL,
    [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
      if (!isSessionValid(request)) {
        request->send(401, "application/json", "{\"ok\":false}");
        return;
      }
      StaticJsonDocument<128> doc;
      DeserializationError err = deserializeJson(doc, (char*)data, len);
      if (err) {
        request->send(400, "application/json", "{\"ok\":false,\"msg\":\"Invalid JSON\"}");
        return;
      }
      const char* cmd = doc["cmd"] | "";

      if (strcmp(cmd, "start") == 0) {
        startProcess();
        request->send(200, "application/json", "{\"ok\":true,\"msg\":\"Started\"}");
      } else if (strcmp(cmd, "stop") == 0) {
        stopProcess();
        request->send(200, "application/json", "{\"ok\":true,\"msg\":\"Stopped\"}");
      } else if (strcmp(cmd, "restart") == 0) {
        request->send(200, "application/json", "{\"ok\":true,\"msg\":\"Restarting...\"}");
        delay(500);
        ESP.restart();
      } else {
        request->send(400, "application/json", "{\"ok\":false,\"msg\":\"Unknown command\"}");
      }
    }
  );
}
