// ============================================================
//  mv_sim.ino  –  Simulasi MV untuk testing (dashboard toggle)
//  Aktif hanya bila USE_MV_SIMULATION = true di RetortLogger.ino.
//  Matikan permanen: set USE_MV_SIMULATION false lalu reflash.
// ============================================================

extern RetortState state;
extern Preferences prefs;

#define K_MV_SIM       "mv_sim"
#define MV_SIM_PERCENT 50.0f   // nilai MV yang dilaporkan saat simulasi ON
#define MV_SIM_RAW     500     // raw Modbus (50.0%)

#if USE_MV_SIMULATION

static bool gMvSimActive = false;

void mvSimLoad() {
  prefs.begin(PREF_NS, true);
  gMvSimActive = prefs.getBool(K_MV_SIM, false);
  prefs.end();
  Serial.printf("[MV_SIM] %s (set USE_MV_SIMULATION false utk nonaktif permanen)\n",
                gMvSimActive ? "ON" : "OFF");
}

void mvSimSetActive(bool on) {
  gMvSimActive = on;
  prefs.begin(PREF_NS, false);
  prefs.putBool(K_MV_SIM, on);
  prefs.end();
  Serial.printf("[MV_SIM] toggle → %s (MV laporan=%.1f%%)\n",
                on ? "ON" : "OFF", on ? MV_SIM_PERCENT : state.mv);
}

bool mvSimIsAvailable() { return true; }
bool mvSimIsActive()    { return gMvSimActive; }

float mvSimEffectivePercent() {
  return gMvSimActive ? MV_SIM_PERCENT : state.mv;
}

uint16_t mvSimEffectiveRaw(uint16_t hardwareRaw) {
  return gMvSimActive ? MV_SIM_RAW : hardwareRaw;
}

bool mvSimProcessRunning(bool ctrlRun, uint16_t hardwareMvRaw) {
  return ctrlRun || (mvSimEffectiveRaw(hardwareMvRaw) > 0);
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
