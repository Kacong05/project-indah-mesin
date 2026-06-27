// ============================================================
//  web_dashboard.ino  –  Dashboard + status API
//  Lightweight HTML
// ============================================================

extern AppConfig      cfg;
extern RetortState    state;
extern AsyncWebServer server;
extern int gLastStaDiscReason;
extern int gLastMqttState;
extern char gLastTs[24];
extern char gLastClock[32];
extern char gLastIso[26];

static const char DASH_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,Arial,sans-serif;background:#f4f5f7;color:#222;margin:0;display:flex;min-height:100vh}
nav{width:160px;flex-shrink:0;background:#1f2937}
nav a{display:block;padding:11px 16px;color:#cbd5e1;text-decoration:none;font-size:14px}
nav a:hover{background:#374151;color:#fff}
nav a.a{background:#374151;color:#fff;border-left:3px solid #2563eb}
.m{flex:1;min-width:0;padding:18px}
h1{font-size:19px;margin:0 0 14px}
.tg{background:#fff;border:1px solid #e3e3e3;border-radius:8px;padding:16px;margin-bottom:14px;text-align:center}
.tn{font-size:clamp(36px,12vw,52px);font-weight:700;line-height:1}
.tn span{font-size:.45em;font-weight:600;color:#666}
.tbar{height:10px;background:#e5e7eb;border-radius:5px;margin:12px 0 8px;overflow:hidden}
.tfill{height:100%;width:0;border-radius:5px;background:#16a34a;transition:width .4s}
.tfill.wr{background:#d97706}.tfill.er{background:#dc2626}
.tlbl{font-size:13px;color:#666}
.tlbl b{color:#2563eb;font-weight:600}
.clk{background:#fff;border:1px solid #e3e3e3;border-radius:8px;padding:12px 16px;margin-bottom:14px;
display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
.clk .time{font-size:clamp(22px,6vw,28px);font-weight:700;font-variant-numeric:tabular-nums;color:#1e40af}
.clk .meta{font-size:12px;color:#666;line-height:1.5;text-align:right}
.clk .meta b{color:#374151;font-weight:600}
.clk .bad{color:#dc2626;font-size:11px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:16px}
.c{background:#fff;border:1px solid #e3e3e3;padding:12px;border-radius:6px}
.c small{color:#777;font-size:12px}
.c .v{font-size:clamp(16px,4vw,19px);font-weight:700;margin-top:3px}
.sim{border-color:#f59e0b;background:#fffbeb}
.sim button{margin-top:8px;width:100%;padding:10px 8px;border:0;border-radius:6px;
font-size:13px;font-weight:600;cursor:pointer;background:#f59e0b;color:#fff}
.sim button.off{background:#6b7280}
.sim small.hint{display:block;margin-top:6px;font-size:11px;color:#92400e;line-height:1.4}
.ok{color:#16a34a}.er{color:#dc2626}.wr{color:#d97706}
@media(max-width:640px){body{flex-direction:column}
nav{width:100%;display:flex;flex-wrap:wrap}
nav a{flex:1 1 auto;text-align:center;padding:10px 4px;font-size:13px}
.m{padding:12px}}
</style></head><body>
<nav>
<a href="/dashboard" class="a">Dashboard</a>
<a href="/settings">Settings</a>
<a href="/storage">Log &amp; Storage</a>
<a href="/logout">Logout</a>
</nav>
<div class="m">
<h1>Dashboard</h1>
<div class="clk">
<div class="time" id="clkTime">--:--:--</div>
<div class="meta">
<div id="clkDate">--/--/----</div>
<div>Log: <b id="clkLog">--</b></div>
<span class="bad" id="clkRtcWarn" style="display:none">RTC tidak terdeteksi</span>
<span id="clkNtp" style="font-size:11px;color:#16a34a"></span>
</div>
</div>
<div class="tg">
<div class="tn" id="tbig">--<span>°C</span></div>
<div class="tbar"><div class="tfill" id="tbar"></div></div>
<div class="tlbl">Setting <b id="tsp">--°C</b> · <span id="tph">--</span> · <span id="trec">--</span></div>
</div>
<div class="g">
<div class="c"><small>WiFi</small><div class="v" id="wifi">--</div></div>
<div class="c"><small>MQTT</small><div class="v" id="mqtt">--</div></div>
<div class="c"><small>Status</small><div class="v" id="phase">--</div></div>
<div class="c"><small>Output MV</small><div class="v" id="mv">--</div></div>
<div class="c sim" id="mvSimCard" style="display:none">
<small>MV Simulasi</small>
<div class="v" id="mvSim">OFF</div>
<button type="button" id="mvSimBtn">Nyalakan Simulasi MV</button>
<small class="hint" id="mvSimHint">MV hardware tetap dibaca; nilai laporan dipaksa 50% agar data masuk DB.</small>
</div>
<div class="c"><small>SD Card</small><div class="v" id="sd">--</div></div>
</div>
<p id="hint" style="font-size:12px;color:#555;line-height:1.5;margin:0 0 14px"></p>
</div>
<script>
function ah(){var t=sessionStorage.getItem('st');return t?{'X-Session':t}:{};}
function u(){
fetch('/api/status',{headers:ah(),credentials:'same-origin'}).then(function(r){
if(r.status===401){sessionStorage.removeItem('st');location='/login';return null}
if(!r.ok)throw new Error('http');
return r.json();
}).then(function(d){if(!d)return;
if(d.clock){
var p=d.clock.split(' ');
if(p.length>=2){
document.getElementById('clkDate').textContent=p[0];
var t=p[1]+(p[2]==='WIB'?' WIB':'');
document.getElementById('clkTime').textContent=t;
}
}
if(d.ts){document.getElementById('clkLog').textContent=d.ts;}
document.getElementById('clkRtcWarn').style.display=d.rtc?'none':'inline';
document.getElementById('clkNtp').textContent=d.ntpSync?'● NTP WIB':'';
var w=document.getElementById('wifi');w.textContent=d.wifi?'OK':'OFF';w.className='v '+(d.wifi?'ok':'er');
var mq=document.getElementById('mqtt');mq.textContent=d.mqtt?'OK':'OFF';mq.className='v '+(d.mqtt?'ok':'er');
var p=document.getElementById('phase');p.textContent=d.phase||'--';p.className='v '+(d.log?'wr':'ok');
var t=d.temp!=null?Number(d.temp):null,sp=d.sp!=null?Number(d.sp):null;
if(t!=null){
document.getElementById('tbig').innerHTML=t.toFixed(1)+'<span>°C</span>';
var pct=Math.min(100,Math.max(0,t/130*100));
var bar=document.getElementById('tbar');bar.style.width=pct+'%';
bar.className='tfill '+(t>=116&&t<=126?'':t>126?'er':t>=100?'wr':'');
}else{document.getElementById('tbig').innerHTML='--<span>°C</span>';document.getElementById('tbar').style.width='0';}
document.getElementById('tsp').textContent=sp!=null?sp.toFixed(1)+'°C':'--°C';
document.getElementById('tph').textContent=d.phase||'--';
var rec=document.getElementById('trec');rec.textContent=d.log?'● REC':(d.run?'RUN':'idle');
var mv=document.getElementById('mv');mv.textContent=d.mv!=null?Number(d.mv).toFixed(1)+'%':'--';mv.className='v '+(d.mv>0?'wr':'');
var s=document.getElementById('sd');s.textContent=d.sd?'OK':'N/A';s.className='v '+(d.sd?'ok':'er');
if(d.mvSimAvail){
var card=document.getElementById('mvSimCard');card.style.display='';
var ms=document.getElementById('mvSim');
var simOn=!!d.mvSim;
ms.textContent=simOn?'ON (50%)':'OFF';
ms.className='v '+(simOn?'wr':'ok');
var btn=document.getElementById('mvSimBtn');
btn.textContent=simOn?'Matikan Simulasi MV':'Nyalakan Simulasi MV';
btn.className=simOn?'off':'';
btn.onclick=function(){
btn.disabled=true;
fetch('/api/mv-sim',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},ah()),
credentials:'same-origin',body:JSON.stringify({on:!simOn})})
.then(function(r){if(r.status===401){sessionStorage.removeItem('st');location='/login';return null}return r.json()})
.then(function(){btn.disabled=false;u();})
.catch(function(){btn.disabled=false;});
};
if(d.mvReal!=null&&simOn){
document.getElementById('mvSimHint').textContent='MV hardware: '+Number(d.mvReal).toFixed(1)+'% · laporan simulasi: 50%';
}else{
document.getElementById('mvSimHint').textContent='MV hardware tetap dibaca; nilai laporan dipaksa 50% agar data masuk DB.';
}
}
var h=document.getElementById('hint');
if(d.wifi&&d.mqtt){h.textContent='';}
else if(!d.wifi){
var wr={2:'SSID tidak ketemu',15:'Password WiFi salah',201:'Tidak ada AP'};
h.textContent='WiFi router: '+(d.ssid||'?')+' - '+(wr[d.wfail]||'belum terhubung (kode '+(d.wfail||0)+')')+'. Isi ulang SSID & password di Settings.';
}else{
var me={ '-2':'Broker tidak terjangkau','4':'User MQTT salah','5':'MQTT tidak diizinkan'};
var mk=d.mfail!=null?String(d.mfail):'0';
h.textContent='MQTT '+(d.broker||'?')+':'+(d.mport||1883)+' - '+(me[mk]||'gagal (kode '+mk+')')+'. Cek broker & password di config.ino.';
}
}).catch(function(){
document.getElementById('hint').textContent='API tidak merespons. Logout lalu login ulang.';
});}
u();setInterval(u,1000);
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
    // Fase nyata (heating/holding/cooling) — di mode Modbus dihitung dari PV/SV.
    const char* st = phaseName(state.phase);
    StaticJsonDocument<768> doc;
    doc["wifi"]  = state.wifiConnected;
    doc["mqtt"]  = state.mqttConnected;
    doc["phase"] = st;
    doc["temp"]  = state.temperature;
    doc["sp"]    = state.setpoint;
    doc["mv"]    = mvSimEffectivePercent();
    doc["mvReal"]= state.mv;
    doc["mvSim"] = mvSimIsActive();
    doc["mvSimAvail"] = mvSimIsAvailable();
    doc["run"]   = state.ctrlRun;
    doc["sd"]    = state.sdReady;
    doc["log"]   = state.logging;
    doc["clock"] = gLastClock;
    doc["ts"]    = gLastTs;
    doc["iso"]   = gLastIso;
    doc["rtc"]   = rtcIsOk();
    doc["ntpSync"] = rtcNtpIsSynced();
    doc["ssid"]  = cfg.wifiSSID;
    doc["broker"]= cfg.mqttBroker;
    doc["mport"] = cfg.mqttPort;
    doc["wfail"] = gLastStaDiscReason;
    doc["mfail"] = gLastMqttState;
    String out;
    serializeJson(doc, out);
    req->send(200, "application/json", out);
  });

#if USE_MV_SIMULATION
  server.on("/api/mv-sim", HTTP_POST, [](AsyncWebServerRequest* req) {},
    NULL,
    [](AsyncWebServerRequest* req, uint8_t* data, size_t len, size_t, size_t) {
      if (!isSessionValid(req)) {
        req->send(401, "application/json", "{\"ok\":false}");
        return;
      }
      StaticJsonDocument<64> in;
      if (deserializeJson(in, data, len)) {
        req->send(400, "application/json", "{\"ok\":false,\"error\":\"bad json\"}");
        return;
      }
      bool on = in["on"] | false;
      mvSimSetActive(on);
      StaticJsonDocument<96> out;
      out["ok"]    = true;
      out["mvSim"] = mvSimIsActive();
      out["mv"]    = mvSimEffectivePercent();
      String body;
      serializeJson(out, body);
      req->send(200, "application/json", body);
    });
#endif
}
