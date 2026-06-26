// ============================================================
//  web_auth.ino  –  Login + session + captive portal
//  Lightweight HTML — minimal CSS
// ============================================================

extern AppConfig      cfg;
extern AsyncWebServer server;
extern char           sessionToken[65];
extern unsigned long  sessionStart;

static const char LOGIN_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RetortLogger</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,Arial,sans-serif;background:#f4f5f7;color:#222;margin:0;
display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
.box{background:#fff;padding:24px;border:1px solid #ddd;border-radius:6px;width:100%;max-width:320px}
h2{margin:0 0 16px;text-align:center;font-size:18px}
input{width:100%;padding:11px;margin:5px 0;border:1px solid #ccc;
border-radius:4px;font-size:16px}
button{width:100%;padding:12px;margin-top:10px;background:#2563eb;color:#fff;
border:none;border-radius:4px;cursor:pointer;font-size:15px}
.e{color:#c00;margin-top:8px;display:none;font-size:13px}
</style></head><body>
<div class="box">
<h2>RetortLogger</h2>
<form id="f">
<input id="mid" placeholder="Nomor Mesin" required>
<input id="pwd" type="password" placeholder="Password" required>
<button type="submit">Login</button>
</form>
<div class="e" id="e"></div>
</div>
<script>
document.getElementById('f').onsubmit=function(ev){
  ev.preventDefault();
  var e=document.getElementById('e');e.style.display='none';
  var b='id='+encodeURIComponent(document.getElementById('mid').value)+
        '&pass='+encodeURIComponent(document.getElementById('pwd').value);
  fetch('/api/login',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:b})
  .then(function(r){return r.json()})
  .then(function(d){
    if(d.ok){
      if(d.token)sessionStorage.setItem('st',d.token);
      window.location='/dashboard';
    }else{e.textContent=d.msg||'Login gagal';e.style.display='block';}
  }).catch(function(){e.textContent='Error koneksi';e.style.display='block';});
};
</script>
</body></html>
)rawliteral";

void setupWebAuth() {
  server.on("/login", HTTP_GET, [](AsyncWebServerRequest* req) {
    req->send_P(200, "text/html", LOGIN_HTML);
  });

  server.on("/", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (isSessionValid(req)) req->redirect("/dashboard");
    else req->redirect("/login");
  });

  // Captive portal endpoints
  server.on("/generate_204", HTTP_GET, [](AsyncWebServerRequest* req) {
    req->redirect("http://192.168.4.1/login");
  });
  server.on("/fwlink", HTTP_GET, [](AsyncWebServerRequest* req) {
    req->redirect("http://192.168.4.1/login");
  });
  server.on("/hotspot-detect.html", HTTP_GET, [](AsyncWebServerRequest* req) {
    req->redirect("http://192.168.4.1/login");
  });
  server.on("/connecttest.txt", HTTP_GET, [](AsyncWebServerRequest* req) {
    req->redirect("http://192.168.4.1/login");
  });

  // Login API — uses multipart/form-data (no JSON body parsing needed)
  server.on("/api/login", HTTP_POST, [](AsyncWebServerRequest* req) {
    if (!req->hasParam("id", true) || !req->hasParam("pass", true)) {
      req->send(200, "application/json", "{\"ok\":false,\"msg\":\"Missing fields\"}");
      return;
    }
    String inputId   = req->getParam("id", true)->value();
    String inputPass = req->getParam("pass", true)->value();

    if (!inputId.equals(cfg.machineId)) {
      req->send(200, "application/json", "{\"ok\":false,\"msg\":\"ID/password salah\"}");
      return;
    }
    char inputHash[65];
    sha256Hex(inputPass.c_str(), inputHash);
    if (strcmp(inputHash, cfg.passHash) != 0) {
      req->send(200, "application/json", "{\"ok\":false,\"msg\":\"ID/password salah\"}");
      return;
    }

    generateSession();
    char cookie[128];
    snprintf(cookie, sizeof(cookie),
      "session=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=600", sessionToken);
    char body[160];
    snprintf(body, sizeof(body), "{\"ok\":true,\"token\":\"%s\"}", sessionToken);
    AsyncWebServerResponse* resp = req->beginResponse(200,
      "application/json", body);
    resp->addHeader("Set-Cookie", cookie);
    req->send(resp);
  });

  // Logout
  server.on("/logout", HTTP_GET, [](AsyncWebServerRequest* req) {
    sessionToken[0] = '\0';
    AsyncWebServerResponse* resp = req->beginResponse(302);
    resp->addHeader("Location", "/login");
    resp->addHeader("Set-Cookie", "session=; Path=/; Max-Age=0");
    req->send(resp);
  });

  server.on("/api/logout", HTTP_POST, [](AsyncWebServerRequest* req) {
    sessionToken[0] = '\0';
    AsyncWebServerResponse* resp = req->beginResponse(200,
      "application/json", "{\"ok\":true}");
    resp->addHeader("Set-Cookie", "session=; Path=/; Max-Age=0");
    req->send(resp);
  });

  // Catch-all
  server.onNotFound([](AsyncWebServerRequest* req) {
    req->redirect("http://192.168.4.1/login");
  });
}
