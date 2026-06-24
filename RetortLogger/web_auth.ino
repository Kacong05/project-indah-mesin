// ============================================================
//  web_auth.ino  –  Login page + session authentication
//  Library: ESPAsyncWebServer
// ============================================================

extern AppConfig      cfg;
extern AsyncWebServer server;
extern char           sessionToken[65];
extern unsigned long  sessionStart;

// --- Login Page HTML (Dark Mode, PROGMEM) ---
static const char LOGIN_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RetortLogger - Login</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;
display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#1e293b;border-radius:16px;padding:40px;width:90%;max-width:380px;
box-shadow:0 20px 60px rgba(0,0,0,0.5)}
h1{text-align:center;margin-bottom:8px;color:#38bdf8;font-size:1.5em}
.sub{text-align:center;color:#94a3b8;margin-bottom:24px;font-size:0.9em}
label{display:block;color:#94a3b8;margin-bottom:4px;font-size:0.85em}
input{width:100%;padding:12px;margin-bottom:16px;border:1px solid #334155;
border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:1em;outline:none}
input:focus{border-color:#38bdf8}
button{width:100%;padding:12px;background:#2563eb;color:#fff;border:none;
border-radius:8px;font-size:1em;cursor:pointer;font-weight:600}
button:hover{background:#1d4ed8}
.err{color:#f87171;text-align:center;margin-top:12px;font-size:0.85em;display:none}
</style></head><body>
<div class="card">
<h1>&#x1F3ED; RetortLogger</h1>
<p class="sub">Industrial Retort Controller</p>
<form id="lf">
<label>Nomor Mesin</label>
<input id="mid" type="text" autocomplete="username" required>
<label>Password</label>
<input id="pwd" type="password" autocomplete="current-password" required>
<button type="submit">Login</button>
</form>
<p class="err" id="emsg"></p>
</div>
<script>
document.getElementById('lf').addEventListener('submit',function(e){
  e.preventDefault();
  var em=document.getElementById('emsg');
  em.style.display='none';
  fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:document.getElementById('mid').value,
      pass:document.getElementById('pwd').value})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.ok){window.location.href='/dashboard';}
    else{em.textContent=d.msg||'Login gagal';em.style.display='block';}
  }).catch(function(){em.textContent='Koneksi gagal';em.style.display='block';});
});
</script>
</body></html>
)rawliteral";

// --- Captive Portal detect pages ---
static const char REDIRECT_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta http-equiv="refresh" content="0;url=http://192.168.4.1/login">
</head><body><p>Redirecting...</p></body></html>
)rawliteral";

void setupWebAuth() {
  // Login page
  server.on("/login", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send_P(200, "text/html", LOGIN_HTML);
  });

  // Root -> redirect ke login atau dashboard
  server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (isSessionValid(request)) {
      request->redirect("/dashboard");
    } else {
      request->redirect("/login");
    }
  });

  // Captive portal detection endpoints
  server.on("/generate_204", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->redirect("http://192.168.4.1/login");
  });
  server.on("/fwlink", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->redirect("http://192.168.4.1/login");
  });
  server.on("/hotspot-detect.html", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send_P(200, "text/html", REDIRECT_HTML);
  });
  server.on("/canonical.html", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send_P(200, "text/html", REDIRECT_HTML);
  });
  server.on("/connecttest.txt", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->redirect("http://192.168.4.1/login");
  });

  // Login API
  server.on("/api/login", HTTP_POST,
    [](AsyncWebServerRequest* request) {
      request->send(400, "application/json", "{\"ok\":false,\"msg\":\"Bad request\"}");
    },
    NULL,
    [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
      if (index + len > 256) {
        request->send(413, "application/json", "{\"ok\":false,\"msg\":\"Too large\"}");
        return;
      }
      // Parse JSON body
      StaticJsonDocument<256> doc;
      DeserializationError err = deserializeJson(doc, (char*)data, len);
      if (err) {
        request->send(400, "application/json", "{\"ok\":false,\"msg\":\"Invalid JSON\"}");
        return;
      }

      const char* inputId   = doc["id"]   | "";
      const char* inputPass = doc["pass"] | "";

      // Validasi machine ID
      if (strcmp(inputId, cfg.machineId) != 0) {
        request->send(200, "application/json", "{\"ok\":false,\"msg\":\"ID atau password salah\"}");
        return;
      }

      // Hash input password dan bandingkan
      char inputHash[65];
      sha256Hex(inputPass, inputHash);
      if (strcmp(inputHash, cfg.passHash) != 0) {
        request->send(200, "application/json", "{\"ok\":false,\"msg\":\"ID atau password salah\"}");
        return;
      }

      // Generate session
      generateSession();

      // Set cookie
      char cookieHeader[128];
      snprintf(cookieHeader, sizeof(cookieHeader),
               "session=%s; Path=/; HttpOnly; SameSite=Strict; Max-Age=600",
               sessionToken);

      AsyncWebServerResponse* response = request->beginResponse(200,
        "application/json", "{\"ok\":true}");
      response->addHeader("Set-Cookie", cookieHeader);
      response->addHeader("Cache-Control", "no-store");
      request->send(response);
    }
  );

  // Logout API
  server.on("/api/logout", HTTP_POST, [](AsyncWebServerRequest* request) {
    sessionToken[0] = '\0';
    sessionStart = 0;
    AsyncWebServerResponse* response = request->beginResponse(200,
      "application/json", "{\"ok\":true}");
    response->addHeader("Set-Cookie",
      "session=; Path=/; HttpOnly; Max-Age=0");
    response->addHeader("Cache-Control", "no-store");
    request->send(response);
  });

  // Logout page (GET) -> clear dan redirect
  server.on("/logout", HTTP_GET, [](AsyncWebServerRequest* request) {
    sessionToken[0] = '\0';
    sessionStart = 0;
    AsyncWebServerResponse* response = request->beginResponse(302);
    response->addHeader("Location", "/login");
    response->addHeader("Set-Cookie",
      "session=; Path=/; HttpOnly; Max-Age=0");
    request->send(response);
  });

  // Catch-all: redirect unknown ke login (captive portal)
  server.onNotFound([](AsyncWebServerRequest* request) {
    if (isSessionValid(request)) {
      request->redirect("/dashboard");
    } else {
      request->redirect("http://192.168.4.1/login");
    }
  });
}
