// ============================================================
//  web_storage.ino  –  SD card file browser
//  Lightweight HTML
// ============================================================

extern RetortState    state;
extern AsyncWebServer server;

static const char STOR_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storage</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,Arial,sans-serif;background:#f4f5f7;color:#222;margin:0;display:flex;min-height:100vh}
nav{width:160px;flex-shrink:0;background:#1f2937}
nav a{display:block;padding:11px 16px;color:#cbd5e1;text-decoration:none;font-size:14px}
nav a:hover{background:#374151;color:#fff}
nav a.a{background:#374151;color:#fff;border-left:3px solid #2563eb}
.m{flex:1;min-width:0;padding:18px}
h1{font-size:19px;margin:0 0 12px}
.warn{background:#fef3c7;color:#92400e;padding:10px;border-radius:4px;margin-bottom:12px;display:none}
.cap{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.ci{background:#fff;border:1px solid #e3e3e3;padding:8px 14px;border-radius:4px;flex:1 1 90px}
.ci small{color:#777;font-size:12px}
.ci b{color:#2563eb}
.path{color:#666;margin-bottom:8px;font-size:14px;word-break:break-all}
.path span{cursor:pointer;color:#2563eb}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:14px;background:#fff;min-width:340px}
th{background:#f0f1f3;padding:8px;text-align:left;color:#555}
td{padding:8px;border-top:1px solid #e3e3e3}
.dl{background:#2563eb;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:13px;margin-right:4px}
.rm{background:#dc2626;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:13px}
.dir{cursor:pointer;color:#2563eb;background:none;border:none;font-family:inherit;font-size:14px}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);
align-items:center;justify-content:center;z-index:10;padding:16px}
.modal.show{display:flex}
.mbox{background:#fff;padding:20px;border-radius:8px;max-width:350px;width:100%}
.mbox p{color:#555;margin:8px 0 16px;word-break:break-all;font-size:14px}
.mbtn{display:flex;gap:8px;justify-content:flex-end}
.mbtn button{padding:9px 16px;border:none;border-radius:4px;cursor:pointer;color:#fff}
.mc{background:#6b7280}.md{background:#dc2626}
@media(max-width:640px){body{flex-direction:column}
nav{width:100%;display:flex;flex-wrap:wrap}
nav a{flex:1 1 auto;text-align:center;padding:10px 4px;font-size:13px}
.m{padding:12px}}
</style></head><body>
<nav>
<a href="/dashboard">Dashboard</a>
<a href="/settings">Settings</a>
<a href="/logs">Log</a>
<a href="/storage" class="a">Storage</a>
<a href="/logout">Logout</a>
</nav>
<div class="m">
<h1>Storage</h1>
<div class="warn" id="w">SD Card tidak tersedia.</div>
<div class="cap" id="ca"></div>
<div class="path" id="pb"></div>
<div class="tw"><table><thead><tr><th>Name</th><th>Size</th><th></th></tr></thead>
<tbody id="tb"></tbody></table></div>
</div>
<div class="modal" id="dm">
<div class="mbox">
<b>Hapus file?</b>
<p id="dn"></p>
<div class="mbtn">
<button class="mc" onclick="cm()">Batal</button>
<button class="md" id="dc">Hapus</button>
</div></div></div>
<script>
var cp='/retort',dp='';
function fs(b){if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';
if(b<1073741824)return(b/1048576).toFixed(2)+' MB';return(b/1073741824).toFixed(2)+' GB';}
function go(p){
cp=p;
fetch('/api/stor?path='+encodeURIComponent(p)).then(function(r){
if(r.status==401){location='/login';return null}return r.json()
}).then(function(d){if(!d)return;
if(!d.sd){document.getElementById('w').style.display='block';return;}
var ca=document.getElementById('ca');ca.textContent='';
var items=[{l:'Used',v:fs(d.used)},{l:'Free',v:fs(d.free)},{l:'Total',v:fs(d.total)}];
items.forEach(function(it){
var div=document.createElement('div');div.className='ci';
var s=document.createElement('small');s.textContent=it.l;
var b=document.createElement('b');b.textContent=' '+it.v;
div.appendChild(s);div.appendChild(b);ca.appendChild(div);
});
var pb=document.getElementById('pb');pb.textContent='';
var pts=p.split('/').filter(function(x){return x.length>0;});
var rs=document.createElement('span');rs.textContent='/';
rs.addEventListener('click',function(){go('/');});pb.appendChild(rs);
var acc='/';
pts.forEach(function(pt){
pb.appendChild(document.createTextNode(' / '));
acc+=pt+'/';var s=document.createElement('span');s.textContent=pt;
var t=acc;s.addEventListener('click',function(){go(t);});pb.appendChild(s);
});
var tb=document.getElementById('tb');tb.textContent='';
if(d.files)d.files.forEach(function(f){
var tr=document.createElement('tr');
var t1=document.createElement('td');
if(f.dir){
var btn=document.createElement('button');btn.className='dir';
btn.textContent='\uD83D\uDCC1 '+f.name;
var tgt=p+(p.endsWith('/')?'':'/')+f.name;
btn.addEventListener('click',function(){go(tgt);});
t1.appendChild(btn);
}else{t1.textContent='\uD83D\uDCC4 '+f.name;}
var t2=document.createElement('td');t2.textContent=f.dir?'--':fs(f.size);
var t3=document.createElement('td');
if(!f.dir){
var fp=p+(p.endsWith('/')?'':'/')+f.name;
var db=document.createElement('button');db.className='dl';db.textContent='DL';
db.addEventListener('click',function(){location='/api/stor/dl?path='+encodeURIComponent(fp);});
t3.appendChild(db);
var rb=document.createElement('button');rb.className='rm';rb.textContent='Del';
rb.addEventListener('click',function(){sm(fp,f.name);});
t3.appendChild(rb);
}
tr.appendChild(t1);tr.appendChild(t2);tr.appendChild(t3);tb.appendChild(tr);
});}).catch(function(){});}
function sm(p,n){dp=p;document.getElementById('dn').textContent=n;
document.getElementById('dm').className='modal show';}
function cm(){document.getElementById('dm').className='modal';dp='';}
document.getElementById('dc').addEventListener('click',function(){
if(!dp)return;
fetch('/api/stor/del',{method:'POST',
headers:{'Content-Type':'application/x-www-form-urlencoded'},
body:'path='+encodeURIComponent(dp)}).then(function(r){
if(r.status==401){location='/login';return null}return r.json()
}).then(function(){cm();go(cp);}).catch(function(){cm();});
});
go('/retort');
</script>
</body></html>
)rawliteral";

void setupWebStorage() {
  server.on("/storage", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) { redirectToLogin(req); return; }
    req->send_P(200, "text/html", STOR_HTML);
  });

  server.on("/api/stor", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }
#if USE_SD
    if (!state.sdReady) { req->send(200, "application/json", "{\"sd\":false}"); return; }
    String path = "/retort";
    if (req->hasParam("path")) path = req->getParam("path")->value();
    if (path.indexOf("..") >= 0) { req->send(403, "application/json", "{\"ok\":false}"); return; }

    uint64_t tot = SD.totalBytes();
    uint64_t usd = SD.usedBytes();
    // Gunakan %llu (64-bit). Cast ke unsigned long (32-bit) membuat kartu
    // > 4GB terpotong / wrap-around (mis. 16GB tampil ~2GB).
    char cap[128];
    snprintf(cap, sizeof(cap),
      "{\"sd\":true,\"total\":%llu,\"used\":%llu,\"free\":%llu,\"files\":[",
      (unsigned long long)tot, (unsigned long long)usd,
      (unsigned long long)(tot - usd));
    String json = cap;

    File dir = SD.open(path);
    bool first = true;
    if (dir && dir.isDirectory()) {
      File e = dir.openNextFile();
      while (e) {
        if (!first) json += ',';
        String n = String(e.name());
        int sl = n.lastIndexOf('/');
        if (sl >= 0) n = n.substring(sl + 1);
        json += "{\"name\":\"" + n + "\",\"dir\":" +
          (e.isDirectory() ? "true" : "false") +
          ",\"size\":" + String((unsigned long)e.size()) + "}";
        first = false;
        e.close();
        e = dir.openNextFile();
      }
      dir.close();
    }
    json += "]}";
    req->send(200, "application/json", json);
#else
    req->send(200, "application/json", "{\"sd\":false}");
#endif
  });

  server.on("/api/stor/dl", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) { req->send(401, "text/plain", "No"); return; }
#if USE_SD
    if (!state.sdReady) { req->send(503, "text/plain", "SD err"); return; }
    if (!req->hasParam("path")) { req->send(400, "text/plain", "No path"); return; }
    String p = req->getParam("path")->value();
    if (p.indexOf("..") >= 0) { req->send(403, "text/plain", "Forbidden"); return; }
    if (!SD.exists(p)) { req->send(404, "text/plain", "Not found"); return; }
    req->send(SD, p, "application/octet-stream", true);
#else
    req->send(503, "text/plain", "SD disabled");
#endif
  });

  server.on("/api/stor/del", HTTP_POST, [](AsyncWebServerRequest* req) {
    if (!isSessionValid(req)) { req->send(401, "application/json", "{\"ok\":false}"); return; }
#if USE_SD
    if (!state.sdReady) { req->send(503, "application/json", "{\"ok\":false}"); return; }
    if (!req->hasParam("path", true)) { req->send(400, "application/json", "{\"ok\":false}"); return; }
    String p = req->getParam("path", true)->value();
    if (p.indexOf("..") >= 0 || p.length() == 0) {
      req->send(403, "application/json", "{\"ok\":false}");
      return;
    }
    if (!SD.exists(p)) { req->send(404, "application/json", "{\"ok\":false}"); return; }
    if (SD.remove(p)) req->send(200, "application/json", "{\"ok\":true}");
    else req->send(500, "application/json", "{\"ok\":false}");
#else
    req->send(503, "application/json", "{\"ok\":false}");
#endif
  });
}
