// ============================================================
//  web_storage.ino  –  Storage browser: files, folders, download, delete
// ============================================================

extern AppConfig      cfg;
extern RetortState    state;
extern AsyncWebServer server;

static const char STORAGE_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RetortLogger - Storage</title>
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
h1{margin-bottom:12px;color:#f1f5f9;font-size:1.6em}
.cap{display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap}
.cap-item{background:#1e293b;border-radius:12px;padding:16px 24px;border:1px solid #334155}
.cap-item .label{color:#94a3b8;font-size:0.8em}
.cap-item .val{font-size:1.2em;font-weight:700;color:#38bdf8}
.warn{background:#78350f;color:#fbbf24;padding:16px;border-radius:8px;margin-bottom:20px;display:none}
.path{margin-bottom:16px;color:#94a3b8;font-size:0.9em}
.path span{cursor:pointer;color:#38bdf8}
.tbl{width:100%;border-collapse:collapse;background:#1e293b;border-radius:12px;overflow:hidden}
.tbl th{background:#334155;padding:12px 16px;text-align:left;color:#94a3b8;font-size:0.85em}
.tbl td{padding:12px 16px;border-top:1px solid #334155;font-size:0.9em}
.tbl tr:hover{background:#334155}
.icon{margin-right:6px}
.dl-btn{background:#2563eb;color:#fff;border:none;padding:5px 14px;border-radius:6px;
cursor:pointer;font-size:0.8em;margin-right:4px}
.dl-btn:hover{background:#1d4ed8}
.del-btn{background:#dc2626;color:#fff;border:none;padding:5px 14px;border-radius:6px;
cursor:pointer;font-size:0.8em}
.del-btn:hover{background:#b91c1c}
.dir-link{cursor:pointer;color:#38bdf8;background:none;border:none;font-size:0.9em;
font-family:inherit}
.dir-link:hover{text-decoration:underline}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;
background:rgba(0,0,0,0.7);z-index:100;align-items:center;justify-content:center}
.modal.show{display:flex}
.modal-box{background:#1e293b;border-radius:12px;padding:28px;max-width:400px;
width:90%;border:1px solid #334155}
.modal-box h3{margin-bottom:16px;color:#f87171}
.modal-box p{margin-bottom:20px;color:#94a3b8;font-size:0.9em;word-break:break-all}
.modal-btns{display:flex;gap:12px;justify-content:flex-end}
.modal-cancel{background:#334155;color:#e2e8f0;border:none;padding:8px 20px;
border-radius:8px;cursor:pointer}
.modal-delete{background:#dc2626;color:#fff;border:none;padding:8px 20px;
border-radius:8px;cursor:pointer}
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
<a href="/logs">&#x1F4C4; Log</a>
<a href="/storage" class="active">&#x1F4BE; Storage</a>
<a href="/logout">&#x1F6AA; Logout</a>
</nav>
<div class="main">
<h1>Storage</h1>
<div class="warn" id="warn">&#x26A0; SD Card is not available.</div>
<div class="cap" id="capArea">
<div class="cap-item"><div class="label">Used</div><div class="val" id="used">--</div></div>
<div class="cap-item"><div class="label">Free</div><div class="val" id="free">--</div></div>
<div class="cap-item"><div class="label">Total</div><div class="val" id="total">--</div></div>
</div>
<div class="path" id="pathBar"></div>
<table class="tbl">
<thead><tr><th>Name</th><th>Size</th><th>Actions</th></tr></thead>
<tbody id="tbody"></tbody>
</table>
</div>

<div class="modal" id="delModal">
<div class="modal-box">
<h3>&#x26A0; Konfirmasi Hapus</h3>
<p>Hapus file: <strong id="delName"></strong>?</p>
<div class="modal-btns">
<button class="modal-cancel" onclick="closeModal()">Batal</button>
<button class="modal-delete" id="delConfirm">Hapus</button>
</div>
</div>
</div>

<script>
var currentPath='/';
var deletePath='';

function formatSize(b){
  if(b<1024)return b+' B';
  if(b<1048576)return (b/1024).toFixed(1)+' KB';
  if(b<1073741824)return (b/1048576).toFixed(2)+' MB';
  return (b/1073741824).toFixed(2)+' GB';
}

function browse(path){
  currentPath=path;
  fetch('/api/storage?path='+encodeURIComponent(path)).then(function(r){
    if(r.status===401){window.location.href='/login';return null;}
    return r.json();
  }).then(function(d){
    if(!d)return;
    if(!d.sd){
      document.getElementById('warn').style.display='block';
      document.getElementById('capArea').style.display='none';
      return;
    }
    document.getElementById('used').textContent=formatSize(d.used);
    document.getElementById('free').textContent=formatSize(d.free);
    document.getElementById('total').textContent=formatSize(d.total);

    // Build path bar
    var pb=document.getElementById('pathBar');
    pb.textContent='';
    var parts=path.split('/').filter(function(p){return p.length>0;});
    var rootSpan=document.createElement('span');
    rootSpan.textContent='/ root';
    rootSpan.addEventListener('click',function(){browse('/');});
    pb.appendChild(rootSpan);
    var accum='/';
    parts.forEach(function(p){
      var sep=document.createTextNode(' / ');
      pb.appendChild(sep);
      accum+=p+'/';
      var s=document.createElement('span');
      s.textContent=p;
      var target=accum;
      s.addEventListener('click',function(){browse(target);});
      pb.appendChild(s);
    });

    // Build table
    var tb=document.getElementById('tbody');
    tb.textContent='';
    if(d.files){
      d.files.forEach(function(f){
        var tr=document.createElement('tr');
        var td1=document.createElement('td');
        if(f.dir){
          var btn=document.createElement('button');
          btn.className='dir-link';
          btn.textContent='\uD83D\uDCC1 '+f.name;
          var target=path+(path.endsWith('/')?'':'/')+f.name;
          btn.addEventListener('click',function(){browse(target);});
          td1.appendChild(btn);
        }else{
          td1.textContent='\uD83D\uDCC4 '+f.name;
        }
        var td2=document.createElement('td');
        td2.textContent=f.dir?'--':formatSize(f.size);
        var td3=document.createElement('td');
        if(!f.dir){
          var dlBtn=document.createElement('button');
          dlBtn.className='dl-btn';
          dlBtn.textContent='Download';
          var fp=path+(path.endsWith('/')?'':'/')+f.name;
          dlBtn.addEventListener('click',function(){
            window.location.href='/api/storage/download?path='+encodeURIComponent(fp);
          });
          td3.appendChild(dlBtn);
          var delBtn=document.createElement('button');
          delBtn.className='del-btn';
          delBtn.textContent='Delete';
          delBtn.addEventListener('click',function(){showDeleteModal(fp,f.name);});
          td3.appendChild(delBtn);
        }
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tb.appendChild(tr);
      });
    }
  }).catch(function(){});
}

function showDeleteModal(path,name){
  deletePath=path;
  document.getElementById('delName').textContent=name;
  document.getElementById('delModal').className='modal show';
}
function closeModal(){
  document.getElementById('delModal').className='modal';
  deletePath='';
}
document.getElementById('delConfirm').addEventListener('click',function(){
  if(!deletePath)return;
  fetch('/api/storage/delete',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({path:deletePath})
  }).then(function(r){
    if(r.status===401){window.location.href='/login';return null;}
    return r.json();
  }).then(function(d){
    closeModal();
    browse(currentPath);
  }).catch(function(){closeModal();});
});

browse('/');
</script>
</body></html>
)rawliteral";

void setupWebStorage() {
  // Storage page
  server.on("/storage", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!isSessionValid(request)) { redirectToLogin(request); return; }
    request->send_P(200, "text/html", STORAGE_HTML);
  });

  // API: browse storage
  server.on("/api/storage", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!isSessionValid(request)) {
      request->send(401, "application/json", "{\"ok\":false}");
      return;
    }

#if USE_SD
    if (!state.sdReady) {
      request->send(200, "application/json", "{\"sd\":false}");
      return;
    }

    String path = "/";
    if (request->hasParam("path")) {
      path = request->getParam("path")->value();
    }
    // Sanitasi: cegah directory traversal
    if (path.indexOf("..") >= 0) {
      request->send(403, "application/json", "{\"ok\":false}");
      return;
    }

    uint64_t totalBytes = SD.totalBytes();
    uint64_t usedBytes  = SD.usedBytes();

    String json = "{\"sd\":true,\"total\":";
    json += String((unsigned long)totalBytes);
    json += ",\"used\":";
    json += String((unsigned long)usedBytes);
    json += ",\"free\":";
    json += String((unsigned long)(totalBytes - usedBytes));
    json += ",\"files\":[";

    File dir = SD.open(path);
    bool first = true;
    if (dir && dir.isDirectory()) {
      File entry = dir.openNextFile();
      while (entry) {
        if (!first) json += ",";
        json += "{\"name\":\"";
        String ename = String(entry.name());
        int ls = ename.lastIndexOf('/');
        if (ls >= 0) ename = ename.substring(ls + 1);
        json += ename;
        json += "\",\"dir\":";
        json += entry.isDirectory() ? "true" : "false";
        json += ",\"size\":";
        json += String((unsigned long)entry.size());
        json += "}";
        first = false;
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
    request->send(200, "application/json", "{\"sd\":false}");
#endif
  });

  // API: download file from storage
  server.on("/api/storage/download", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (!isSessionValid(request)) {
      request->send(401, "text/plain", "Unauthorized");
      return;
    }
#if USE_SD
    if (!state.sdReady) {
      request->send(503, "text/plain", "SD not ready");
      return;
    }
    if (!request->hasParam("path")) {
      request->send(400, "text/plain", "Missing path");
      return;
    }
    String path = request->getParam("path")->value();
    if (path.indexOf("..") >= 0) {
      request->send(403, "text/plain", "Forbidden");
      return;
    }
    if (!SD.exists(path)) {
      request->send(404, "text/plain", "Not found");
      return;
    }
    request->send(SD, path, "application/octet-stream", true);
#else
    request->send(503, "text/plain", "SD not enabled");
#endif
  });

  // API: delete file
  server.on("/api/storage/delete", HTTP_POST,
    [](AsyncWebServerRequest* request) {
      request->send(400, "application/json", "{\"ok\":false}");
    },
    NULL,
    [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
      if (!isSessionValid(request)) {
        request->send(401, "application/json", "{\"ok\":false}");
        return;
      }
#if USE_SD
      if (!state.sdReady) {
        request->send(503, "application/json", "{\"ok\":false,\"msg\":\"SD not ready\"}");
        return;
      }
      StaticJsonDocument<256> doc;
      DeserializationError err = deserializeJson(doc, (char*)data, len);
      if (err) {
        request->send(400, "application/json", "{\"ok\":false}");
        return;
      }
      const char* path = doc["path"] | "";
      if (strlen(path) == 0 || strstr(path, "..") != NULL) {
        request->send(403, "application/json", "{\"ok\":false,\"msg\":\"Forbidden\"}");
        return;
      }
      if (!SD.exists(path)) {
        request->send(404, "application/json", "{\"ok\":false,\"msg\":\"Not found\"}");
        return;
      }
      if (SD.remove(path)) {
        request->send(200, "application/json", "{\"ok\":true,\"msg\":\"Deleted\"}");
      } else {
        request->send(500, "application/json", "{\"ok\":false,\"msg\":\"Delete failed\"}");
      }
#else
      request->send(503, "application/json", "{\"ok\":false,\"msg\":\"SD not enabled\"}");
#endif
    }
  );
}
