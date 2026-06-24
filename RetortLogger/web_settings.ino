// ============================================================
//  web_settings.ino  –  Settings page (WiFi, MQTT, Retort, Identity)
// ============================================================

extern AppConfig      cfg;
extern AsyncWebServer server;

static const char SETTINGS_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RetortLogger - Settings</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh}
.sidebar{width:220px;background:#1e293b;padding:20px 0;display:flex;flex-direction:column;
border-right:1px solid #334155;position:fixed;height:100vh;overflow-y:auto}
.sidebar h2{padding:0 20px;color:#38bdf8;font-size:1.1em;margin-bottom:20px}
.sidebar a{display:block;padding:12px 20px;color:#94a3b8;text-decoration:none;font-size:0.95em;
transition:all 0.2s}
.sidebar a:hover,.sidebar a.active{background:#334155;color:#38bdf8}
.main{margin-left:220px;flex:1;padding:30px;max-width:700px}
h1{margin-bottom:24px;color:#f1f5f9;font-size:1.6em}
.section{background:#1e293b;border-radius:12px;padding:24px;margin-bottom:20px;
border:1px solid #334155}
.section h3{color:#38bdf8;margin-bottom:16px;font-size:1.1em}
label{display:block;color:#94a3b8;margin-bottom:4px;font-size:0.85em}
input{width:100%;padding:10px;margin-bottom:12px;border:1px solid #334155;border-radius:8px;
background:#0f172a;color:#e2e8f0;font-size:0.95em;outline:none}
input:focus{border-color:#38bdf8}
.btn{padding:12px 28px;border:none;border-radius:8px;font-size:0.95em;cursor:pointer;
font-weight:600;background:#2563eb;color:#fff;transition:all 0.2s}
.btn:hover{background:#1d4ed8}
.msg{margin-top:12px;padding:10px;border-radius:8px;font-size:0.9em;display:none}
.msg.ok{background:#064e3b;color:#34d399;display:block}
.msg.err{background:#7f1d1d;color:#f87171;display:block}
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
<a href="/settings" class="active">&#x2699;&#xFE0F; Settings</a>
<a href="/logs">&#x1F4C4; Log</a>
<a href="/storage">&#x1F4BE; Storage</a>
<a href="/logout">&#x1F6AA; Logout</a>
</nav>
<div class="main">
<h1>Settings</h1>
<div id="msg" class="msg"></div>

<div class="section"><h3>&#x1F4F6; WiFi</h3>
<label>SSID</label><input id="wssid" maxlength="32">
<label>Password</label><input id="wpass" type="password" maxlength="64" placeholder="Leave blank to keep current">
</div>

<div class="section"><h3>&#x1F4E1; MQTT</h3>
<label>Broker Address</label><input id="mhost" maxlength="64">
<label>Port</label><input id="mport" type="number" min="1" max="65535">
<label>Username</label><input id="muser" maxlength="32">
<label>Password</label><input id="mpass" type="password" maxlength="64" placeholder="Leave blank to keep current">
<label>Publish Topic</label><input id="mpub" maxlength="64">
<label>Command Topic</label><input id="mcmd" maxlength="64">
</div>

<div class="section"><h3>&#x1F321; Parameter Retort</h3>
<label>Target Temperature (&deg;C)</label><input id="ttemp" type="number" step="0.1" min="50" max="200">
<label>Holding Time (detik)</label><input id="hold" type="number" min="1" max="7200">
<label>Heating Rate (&deg;C/s)</label><input id="hrate" type="number" step="0.1" min="0.1" max="10">
<label>Cooling Rate (&deg;C/s)</label><input id="crate" type="number" step="0.1" min="0.1" max="10">
</div>

<div class="section"><h3>&#x1F3ED; Machine Identity</h3>
<label>Nomor Mesin</label><input id="mid" maxlength="32">
<label>Password Login Baru</label><input id="lpass" type="password" maxlength="64" placeholder="Leave blank to keep current">
</div>

<button class="btn" onclick="saveSettings()">&#x1F4BE; Save Settings</button>
</div>
<script>
function loadSettings(){
  fetch('/api/settings').then(function(r){
    if(r.status===401){window.location.href='/login';return null;}
    return r.json();
  }).then(function(d){
    if(!d)return;
    document.getElementById('wssid').value=d.wssid||'';
    document.getElementById('mhost').value=d.mhost||'';
    document.getElementById('mport').value=d.mport||1883;
    document.getElementById('muser').value=d.muser||'';
    document.getElementById('mpub').value=d.mpub||'';
    document.getElementById('mcmd').value=d.mcmd||'';
    document.getElementById('ttemp').value=d.ttemp||121;
    document.getElementById('hold').value=d.hold||1200;
    document.getElementById('hrate').value=d.hrate||1.5;
    document.getElementById('crate').value=d.crate||0.8;
    document.getElementById('mid').value=d.mid||'';
  }).catch(function(){});
}
function saveSettings(){
  var data={
    wssid:document.getElementById('wssid').value,
    wpass:document.getElementById('wpass').value,
    mhost:document.getElementById('mhost').value,
    mport:parseInt(document.getElementById('mport').value)||1883,
    muser:document.getElementById('muser').value,
    mpass:document.getElementById('mpass').value,
    mpub:document.getElementById('mpub').value,
    mcmd:document.getElementById('mcmd').value,
    ttemp:parseFloat(document.getElementById('ttemp').value)||121,
    hold:parseInt(document.getElementById('hold').value)||1200,
    hrate:parseFloat(document.getElementById('hrate').value)||1.5,
    crate:parseFloat(document.getElementById('crate').value)||0.8,
    mid:document.getElementById('mid').value,
    lpass:document.getElementById('lpass').value
  };
  var msgEl=document.getElementById('msg');
  fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(data)
  }).then(function(r){
    if(r.status===401){window.location.href='/login';return null;}
    return r.json();
  }).then(function(d){
    if(!d)return;
    msgEl.textContent=d.msg;
    msgEl.className='msg '+(d.ok?'ok':'err');
    if(d.restart){
      msgEl.textContent='Settings saved. Restarting in 3 seconds...';
      setTimeout(function(){window.location.href='/login';},3000);
    }
  }).catch(function(){
    msgEl.textContent='Connection error';
    msgEl.className='msg err';
  });
}
loadSettings();
</script>
</body></html>
)rawliteral";

void setupWebSettings() {
  // Settings page
  server.on("/settings", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!isSessionValid(request)) { redirectToLogin(request); return; }
    request->send_P(200, "text/html", SETTINGS_HTML);
  });

  // GET settings data
  server.on("/api/settings", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!isSessionValid(request)) {
      request->send(401, "application/json", "{\"ok\":false}");
      return;
    }
    StaticJsonDocument<512> doc;
    doc["wssid"] = cfg.wifiSSID;
    doc["mhost"] = cfg.mqttBroker;
    doc["mport"] = cfg.mqttPort;
    doc["muser"] = cfg.mqttUser;
    doc["mpub"]  = cfg.mqttPubTopic;
    doc["mcmd"]  = cfg.mqttCmdTopic;
    doc["ttemp"] = cfg.targetTemp;
    doc["hold"]  = cfg.holdingTimeSec;
    doc["hrate"] = cfg.heatingRate;
    doc["crate"] = cfg.coolingRate;
    doc["mid"]   = cfg.machineId;

    char buf[512];
    serializeJson(doc, buf, sizeof(buf));
    AsyncWebServerResponse* response = request->beginResponse(200,
      "application/json", buf);
    response->addHeader("Cache-Control", "no-store");
    request->send(response);
  });

  // POST save settings
  server.on("/api/settings", HTTP_POST,
    [](AsyncWebServerRequest* request) {
      request->send(400, "application/json", "{\"ok\":false}");
    },
    NULL,
    [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
      if (!isSessionValid(request)) {
        request->send(401, "application/json", "{\"ok\":false}");
        return;
      }
      StaticJsonDocument<512> doc;
      DeserializationError err = deserializeJson(doc, (char*)data, len);
      if (err) {
        request->send(400, "application/json", "{\"ok\":false,\"msg\":\"Invalid JSON\"}");
        return;
      }

      bool needRestart = false;

      // WiFi
      const char* wssid = doc["wssid"] | "";
      const char* wpass = doc["wpass"] | "";
      if (strlen(wssid) > 0 && strcmp(wssid, cfg.wifiSSID) != 0) {
        strncpy(cfg.wifiSSID, wssid, sizeof(cfg.wifiSSID) - 1);
        needRestart = true;
      }
      if (strlen(wpass) > 0) {
        strncpy(cfg.wifiPass, wpass, sizeof(cfg.wifiPass) - 1);
        needRestart = true;
      }

      // MQTT
      const char* mhost = doc["mhost"] | "";
      if (strlen(mhost) > 0) {
        if (strcmp(mhost, cfg.mqttBroker) != 0) needRestart = true;
        strncpy(cfg.mqttBroker, mhost, sizeof(cfg.mqttBroker) - 1);
      }
      uint16_t mport = doc["mport"] | 1883;
      if (mport > 0 && mport <= 65535) {
        if (mport != cfg.mqttPort) needRestart = true;
        cfg.mqttPort = mport;
      }
      const char* muser = doc["muser"] | "";
      strncpy(cfg.mqttUser, muser, sizeof(cfg.mqttUser) - 1);
      const char* mpass = doc["mpass"] | "";
      if (strlen(mpass) > 0) {
        strncpy(cfg.mqttPass, mpass, sizeof(cfg.mqttPass) - 1);
      }
      const char* mpub = doc["mpub"] | "";
      if (strlen(mpub) > 0) strncpy(cfg.mqttPubTopic, mpub, sizeof(cfg.mqttPubTopic) - 1);
      const char* mcmd = doc["mcmd"] | "";
      if (strlen(mcmd) > 0) strncpy(cfg.mqttCmdTopic, mcmd, sizeof(cfg.mqttCmdTopic) - 1);

      // Retort parameters
      float ttemp = doc["ttemp"] | 0.0f;
      if (ttemp >= 50.0f && ttemp <= 200.0f) cfg.targetTemp = ttemp;
      uint32_t hold = doc["hold"] | 0;
      if (hold >= 1 && hold <= 7200) cfg.holdingTimeSec = hold;
      float hrate = doc["hrate"] | 0.0f;
      if (hrate >= 0.1f && hrate <= 10.0f) cfg.heatingRate = hrate;
      float crate = doc["crate"] | 0.0f;
      if (crate >= 0.1f && crate <= 10.0f) cfg.coolingRate = crate;

      // Machine Identity
      const char* mid = doc["mid"] | "";
      if (strlen(mid) > 0 && strlen(mid) <= 32) {
        strncpy(cfg.machineId, mid, sizeof(cfg.machineId) - 1);
      }
      const char* lpass = doc["lpass"] | "";
      if (strlen(lpass) > 0) {
        // Validasi: minimal 6 karakter
        if (strlen(lpass) >= 6) {
          sha256Hex(lpass, cfg.passHash);
        }
      }

      saveConfig();

      char resp[128];
      snprintf(resp, sizeof(resp),
        "{\"ok\":true,\"msg\":\"Settings saved.\",\"restart\":%s}",
        needRestart ? "true" : "false");
      request->send(200, "application/json", resp);

      if (needRestart) {
        delay(1500);
        ESP.restart();
      }
    }
  );
}
