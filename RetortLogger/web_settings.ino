// ============================================================
//  web_settings.ino  –  Settings page
//  Lightweight HTML
// ============================================================

extern AppConfig      cfg;
extern AsyncWebServer server;

static const char SET_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Settings</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,Arial,sans-serif;background:#f4f5f7;color:#222;margin:0;display:flex;min-height:100vh}
nav{width:160px;flex-shrink:0;background:#1f2937}
nav a{display:block;padding:11px 16px;color:#cbd5e1;text-decoration:none;font-size:14px}
nav a:hover{background:#374151;color:#fff}
nav a.a{background:#374151;color:#fff;border-left:3px solid #2563eb}
.m{flex:1;min-width:0;padding:18px;max-width:520px}
h1{font-size:19px;margin:0 0 14px}
h3{color:#2563eb;margin:16px 0 6px;font-size:15px}
label{display:block;color:#666;font-size:13px;margin-top:8px}
input{width:100%;padding:11px;border:1px solid #ccc;border-radius:4px;
margin-top:2px;font-size:16px}
button{padding:12px 24px;background:#2563eb;color:#fff;border:none;
border-radius:4px;cursor:pointer;margin-top:16px;font-size:15px;width:100%}
.msg{margin-top:10px;padding:8px;border-radius:4px;font-size:13px;display:none}
.msg.ok{background:#dcfce7;color:#15803d;display:block}
.msg.er{background:#fee2e2;color:#b91c1c;display:block}
@media(min-width:641px){button{width:auto}}
@media(max-width:640px){body{flex-direction:column}
nav{width:100%;display:flex;flex-wrap:wrap}
nav a{flex:1 1 auto;text-align:center;padding:10px 4px;font-size:13px}
.m{padding:12px}}
</style></head><body>
<nav>
<a href="/dashboard">Dashboard</a>
<a href="/settings" class="a">Settings</a>
<a href="/logs">Log</a>
<a href="/storage">Storage</a>
<a href="/logout">Logout</a>
</nav>
<div class="m">
<h1>Settings</h1>
<div id="msg" class="msg"></div>
<h3>WiFi</h3>
<label>SSID</label><input id="wssid" maxlength="32">
<label>Password</label><input id="wpass" type="password" maxlength="64" placeholder="Wajib diisi ulang saat simpan">
<h3>MQTT</h3>
<label>Broker</label><input id="mhost" maxlength="64">
<label>Port</label><input id="mport" type="number" min="1" max="65535">
<h3>Identity</h3>
<label>Nomor Mesin</label><input id="mid" maxlength="32">
<label>Password Login Baru</label><input id="lpass" type="password" maxlength="64" placeholder="Min 6 karakter">
<button onclick="save()">Simpan</button>
</div>
<script>
function ah(){var t=sessionStorage.getItem('st');return t?{'X-Session':t}:{};}
function load(){
fetch('/api/settings',{headers:ah(),credentials:'same-origin'}).then(function(r){
if(r.status===401){sessionStorage.removeItem('st');location='/login';return null}return r.json()
}).then(function(d){if(!d)return;
document.getElementById('wssid').value=d.wssid||'';
document.getElementById('mhost').value=d.mhost||'';
document.getElementById('mport').value=d.mport||1883;
document.getElementById('mid').value=d.mid||'';
}).catch(function(){});}
function save(){
var ks=['wssid','wpass','mhost','mport','mid','lpass'];
var b=ks.map(function(k){
return k+'='+encodeURIComponent(document.getElementById(k).value);}).join('&');
var m=document.getElementById('msg');
fetch('/api/settings',{method:'POST',headers:Object.assign({'Content-Type':'application/x-www-form-urlencoded'},ah()),
credentials:'same-origin',body:b})
.then(function(r){
if(r.status==401){location='/login';return null}return r.json()
}).then(function(d){if(!d)return;
m.textContent=d.msg;m.className='msg '+(d.ok?'ok':'er');
if(d.restart)setTimeout(function(){location='/login'},3000);
}).catch(function(){m.textContent='Error';m.className='msg er';});}
load();
</script>
</body></html>
)rawliteral";

void setupWebSettings() {
  server.on("/settings", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) { redirectToLogin(req); return; }
    req->send_P(200, "text/html", SET_HTML);
  });

  // GET settings
  server.on("/api/settings", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }
    char buf[256];
    snprintf(buf, sizeof(buf),
      "{\"wssid\":\"%s\",\"mhost\":\"%s\",\"mport\":%d,\"mid\":\"%s\"}",
      cfg.wifiSSID, cfg.mqttBroker, cfg.mqttPort, cfg.machineId);
    AsyncWebServerResponse* resp = req->beginResponse(200, "application/json", buf);
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });

  // POST save settings (application/x-www-form-urlencoded)
  server.on("/api/settings", HTTP_POST, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }

    if (req->hasParam("wssid", true)) {
      String v = req->getParam("wssid", true)->value();
      if (v.length() > 0)
        strncpy(cfg.wifiSSID, v.c_str(), sizeof(cfg.wifiSSID) - 1);
    }
    if (req->hasParam("wpass", true)) {
      String v = req->getParam("wpass", true)->value();
      if (v.length() > 0)
        strncpy(cfg.wifiPass, v.c_str(), sizeof(cfg.wifiPass) - 1);
    }
    if (req->hasParam("mhost", true)) {
      String v = req->getParam("mhost", true)->value();
      if (v.length() > 0)
        strncpy(cfg.mqttBroker, v.c_str(), sizeof(cfg.mqttBroker) - 1);
    }
    if (req->hasParam("mport", true)) {
      int p = req->getParam("mport", true)->value().toInt();
      if (p > 0 && p <= 65535)
        cfg.mqttPort = (uint16_t)p;
    }
    if (req->hasParam("mid", true)) {
      String v = req->getParam("mid", true)->value();
      if (v.length() > 0 && v.length() <= 32)
        strncpy(cfg.machineId, v.c_str(), sizeof(cfg.machineId) - 1);
    }
    if (req->hasParam("lpass", true)) {
      String v = req->getParam("lpass", true)->value();
      if (v.length() >= 6) sha256Hex(v.c_str(), cfg.passHash);
    }

    saveConfig();

    char resp[96];
    snprintf(resp, sizeof(resp),
      "{\"ok\":true,\"msg\":\"Tersimpan. Restart...\",\"restart\":true}");
    req->send(200, "application/json", resp);
    delay(1500);
    ESP.restart();
  });
}
