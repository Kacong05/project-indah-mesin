// ============================================================
//  mv_sim.ino  –  Simulasi katup/MV untuk testing (dashboard toggle)
//  Aktif hanya bila USE_MV_SIMULATION = true di RetortLogger.ino.
//
//  Selaras dengan web (SensorController):
//    Sim OFF → MV laporan = 0  → katup tertutup, PV/SV live, tidak ke database
//    Sim ON  → MV laporan = 50% → katup terbuka, data disimpan ke database
//
//  Matikan permanen: set USE_MV_SIMULATION false lalu reflash.
// ============================================================

extern RetortState state;
extern Preferences prefs;

#define K_MV_SIM       "mv_sim"
#define MV_SIM_PERCENT 50.0f   // katup terbuka (MV > 0)
#define MV_SIM_RAW     500     // raw Modbus 50.0%

#if USE_MV_SIMULATION

static bool gMvSimActive = false;

void mvSimLoad() {
  prefs.begin(PREF_NS, true);
  gMvSimActive = prefs.getBool(K_MV_SIM, false);
  prefs.end();
  Serial.printf("[MV_SIM] %s — laporan MV=%s (web: %s)\n",
                gMvSimActive ? "KATUP TERBUKA" : "KATUP TERTUTUP",
                gMvSimActive ? "50.0%" : "0.0%",
                gMvSimActive ? "simpan DB" : "hanya PV/SV live");
}

void mvSimSetActive(bool on) {
  gMvSimActive = on;
  prefs.begin(PREF_NS, false);
  prefs.putBool(K_MV_SIM, on);
  prefs.end();
  Serial.printf("[MV_SIM] toggle → %s | MV laporan=%.1f%% | web: %s\n",
                on ? "KATUP TERBUKA" : "KATUP TERTUTUP",
                on ? MV_SIM_PERCENT : 0.0f,
                on ? "simpan ke database" : "PV/SV saja, tanpa database");
}

bool mvSimIsAvailable() { return true; }
bool mvSimIsActive()    { return gMvSimActive; }

// Nilai MV yang dikirim MQTT/API — gate yang dipakai web untuk simpan DB.
float mvSimEffectivePercent() {
  return gMvSimActive ? MV_SIM_PERCENT : 0.0f;
}

uint16_t mvSimEffectiveRaw(uint16_t hardwareRaw) {
  (void)hardwareRaw;
  return gMvSimActive ? MV_SIM_RAW : 0;
}

// Trigger perekaman lokal (SD) mengikuti MV simulasi, sama seperti gate web.
bool mvSimProcessRunning(bool ctrlRun, uint16_t hardwareMvRaw) {
  (void)ctrlRun;
  (void)hardwareMvRaw;
  return gMvSimActive;
}

#else

void mvSimLoad() {}
void mvSimSetActive(bool) {}
bool mvSimIsAvailable() { return false; }
bool mvSimIsActive()    { return false; }

float mvSimEffectivePercent() {
  return state.mv;
}

uint16_t mvSimEffectiveRaw(uint16_t hardwareRaw) {
  return hardwareRaw;
}

bool mvSimProcessRunning(bool ctrlRun, uint16_t hardwareMvRaw) {
  return ctrlRun || (hardwareMvRaw > 0);
}

#endif
