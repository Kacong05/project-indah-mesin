// ============================================================
//  mv_sim.ino  –  MV & trigger perekaman
//
//  PRODUKSI (default): MV & trigger dari Modbus TNL
//    • mulai rekam: DI-1 ON (18-21) ATAU MV > 0
//    • berhenti: DI-1 OFF dan MV = 0 (debounce 5 dtk)
//    • jumper uji = selenoid retort — tanpa reflash ESP
//
//  DEV ONLY: USE_MV_SIMULATION true → dashboard bisa paksa MV 50%
// ============================================================

extern RetortState state;
extern Preferences prefs;

#define K_MV_SIM       "mv_sim"
#define MV_SIM_PERCENT 50.0f
#define MV_SIM_RAW     500

#if USE_MV_SIMULATION
static bool gMvSimActive = false;
#endif

#if USE_MV_SIMULATION

void mvSimLoad() {
  prefs.begin(PREF_NS, true);
  gMvSimActive = prefs.getBool(K_MV_SIM, false);
  prefs.end();
  Serial.printf("[MV] mode=DEV sim web=%s\n", gMvSimActive ? "ON" : "OFF");
}

void mvSimSetActive(bool on) {
  gMvSimActive = on;
  prefs.begin(PREF_NS, false);
  prefs.putBool(K_MV_SIM, on);
  prefs.end();
}

bool mvSimIsAvailable() { return true; }
bool mvSimIsActive()    { return gMvSimActive; }

float mvSimEffectivePercent() {
  return gMvSimActive ? MV_SIM_PERCENT : state.mv;
}

uint16_t mvSimEffectiveRaw(uint16_t hardwareRaw) {
  if (gMvSimActive) return MV_SIM_RAW;
  return hardwareRaw;
}

bool mvSimTriggerStart(uint16_t hardwareMvRaw, uint16_t mvOnRaw) {
  if (gMvSimActive) return true;
  return hardwareMvRaw > mvOnRaw;
}

bool mvSimTriggerEnd(bool ctrlRun, uint16_t hardwareMvRaw, uint16_t mvOnRaw) {
  if (gMvSimActive) return false;
  return !ctrlRun && hardwareMvRaw <= mvOnRaw;
}

#else

void mvSimLoad() {
  Serial.println(F("[MV] mode=PRODUKSI — trigger DI-1 atau MV>0"));
}

void mvSimSetActive(bool) {}
bool mvSimIsAvailable() { return false; }
bool mvSimIsActive()    { return false; }

float mvSimEffectivePercent() {
  return state.mv;
}

uint16_t mvSimEffectiveRaw(uint16_t hardwareRaw) {
  return hardwareRaw;
}

bool mvSimTriggerStart(uint16_t hardwareMvRaw, uint16_t mvOnRaw) {
  return hardwareMvRaw > mvOnRaw;
}

bool mvSimTriggerEnd(bool ctrlRun, uint16_t hardwareMvRaw, uint16_t mvOnRaw) {
  return !ctrlRun && hardwareMvRaw <= mvOnRaw;
}

#endif

#if USE_TNL_DI_TRIGGER
bool tnlDiIsActive();  // modbus_hw.ino
#endif
