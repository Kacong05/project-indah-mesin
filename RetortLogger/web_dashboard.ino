// ============================================================
//  web_dashboard.ino  –  Dashboard + status API
//  Lightweight HTML
// ============================================================

extern AppConfig      cfg;
extern RetortState    state;
extern AsyncWebServer server;

static const char DASH_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard</title>
<style>
body{font-family:system-ui,Arial,sans-serif;background:#f4f5f7;color:#222;margin:0;display:flex}
nav{width:150px;background:#1f2937;min-height:100vh}
nav a{display:block;padding:11px 16px;color:#cbd5e1;text-decoration:none;font-size:14px}
nav a:hover{background:#374151;color:#fff}
nav a.a{background:#374151;color:#fff;border-left:3px solid #2563eb}
.m{flex:1;padding:18px}
h1{font-size:19px;margin:0 0 14px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px}
.c{background:#fff;border:1px solid #e3e3e3;padding:12px;border-radius:6px}
.c small{color:#777;font-size:12px}
.c .v{font-size:19px;font-weight:700;margin-top:3px}
.ok{color:#16a34a}.er{color:#dc2626}.wr{color:#d97706}
.btns{display:flex;gap:8px;flex-wrap:wrap}
button{padding:9px 20px;border:none;border-radius:4px;cursor:pointer;color:#fff;font-size:14px}
.bs{background:#16a34a}.bt{background:#dc2626}.br{background:#6b7280}
button:disabled{opacity:.4;cursor:not-allowed}
@media(max-width:600px){nav{width:100%;min-height:auto;display:flex;flex-wrap:wrap}
nav a{flex:1;text-align:center;padding:9px 4px;font-size:13px}.m{padding:12px}}
</style></head><body>
<nav>
<a href="/dashboard" class="a">Dashboard</a>
<a href="/settings">Settings</a>
<a href="/logs">Log</a>
<a href="/storage">Storage</a>
<a href="/logout">Logout</a>
</nav>
<div class="m">
<h1>Dashboard</h1>
<div class="g">
<div class="c"><small>WiFi</small><div class="v" id="wifi">--</div></div>
<div class="c"><small>MQTT</small><div class="v" id="mqtt">--</div></div>
<div class="c"><small>Status</small><div class="v" id="phase">--</div></div>
<div class="c"><small>Actual</small><div class="v" id="temp">--</div></div>
<div class="c"><small>Setting</small><div class="v" id="sp">--</div></div>
<div class="c"><small>SD Card</small><div class="v" id="sd">--</div></div>
</div>
<div class="btns">
<button class="bs" id="b1" onclick="cmd('start')">Start</button>
<button class="bt" id="b2" onclick="cmd('stop')">Stop</button>
<button class="br" onclick="cmd('restart')">Restart</button>
</div>
</div>
<script>
function u(){
fetch('/api/status').then(function(r){
if(r.status==401){location='/login';return null}return r.json()
}).then(function(d){if(!d)return;
var w=document.getElementById('wifi');w.textContent=d.wifi?'OK':'OFF';w.className='v '+(d.wifi?'ok':'er');
var m=document.getElementById('mqtt');m.textContent=d.mqtt?'OK':'OFF';m.className='v '+(d.mqtt?'ok':'er');
var p=document.getElementById('phase');p.textContent=d.phase;p.className='v '+(d.log?'wr':'ok');
document.getElementById('temp').textContent=d.temp.toFixed(1)+'\u00B0C';
document.getElementById('sp').textContent=d.sp.toFixed(1)+'\u00B0C';
var s=document.getElementById('sd');s.textContent=d.sd?'OK':'N/A';s.className='v '+(d.sd?'ok':'er');
document.getElementById('b1').disabled=d.log;
document.getElementById('b2').disabled=!d.log;
}).catch(function(){});}
function cmd(c){
fetch('/api/cmd',{method:'POST',
headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'cmd='+c})
.then(function(r){if(r.status==401)location='/login';u();}).catch(function(){});}
u();setInterval(u,2000);
</script>
</body></html>
)rawliteral";

void setupWebDashboard() {
  server.on("/dashboard", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) { redirectToLogin(req); return; }
    req->send_P(200, "text/html", DASH_HTML);
  });

  server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }
#if USE_FAKE_SENSOR
    const char* st = phaseName(state.phase);
#else
    const char* st = state.logging ? "LOGGING" : "IDLE";
#endif
    char buf[192];
    snprintf(buf, sizeof(buf),
      "{\"wifi\":%s,\"mqtt\":%s,\"phase\":\"%s\","
      "\"temp\":%.1f,\"sp\":%.1f,\"sd\":%s,\"log\":%s}",
      state.wifiConnected ? "true" : "false",
      state.mqttConnected ? "true" : "false",
      st,
      state.temperature, state.setpoint,
      state.sdReady ? "true" : "false",
      state.logging ? "true" : "false");
    AsyncWebServerResponse* resp = req->beginResponse(200,
      "application/json", buf);
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });

  server.on("/api/cmd", HTTP_POST, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }
    if (!req->hasParam("cmd", true)) {
      req->send(400, "application/json", "{\"ok\":false}");
      return;
    }
    String c = req->getParam("cmd", true)->value();
    if (c == "start") {
      startProcess();
      req->send(200, "application/json", "{\"ok\":true,\"msg\":\"Started\"}");
    } else if (c == "stop") {
      stopProcess();
      req->send(200, "application/json", "{\"ok\":true,\"msg\":\"Stopped\"}");
    } else if (c == "restart") {
      req->send(200, "application/json", "{\"ok\":true,\"msg\":\"Restarting\"}");
      delay(500);
      ESP.restart();
    } else {
      req->send(400, "application/json", "{\"ok\":false}");
    }
  });
}
