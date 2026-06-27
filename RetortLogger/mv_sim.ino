// ============================================================
//  mv_sim.ino  –  MV & trigger perekaman
//
//  PRODUKSI (default): MV & trigger 100% dari Modbus TNL
//    • mv laporan = Heating/Cooling MV (0x03EC/0x03ED)
//    • rekam aktif saat RUN atau MV > 0
//    • Uji lab & retort sungguhan pakai jalur yang sama — tanpa reflash ESP
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

bool mvSimProcessRunning(bool ctrlRun, uint16_t hardwareMvRaw) {
  if (gMvSimActive) return true;
  return ctrlRun || (hardwareMvRaw > 0);
}

#else

void mvSimLoad() {
  Serial.println(F("[MV] mode=PRODUKSI — trigger dari MV/RUN Modbus TNL"));
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

bool mvSimProcessRunning(bool ctrlRun, uint16_t hardwareMvRaw) {
  return ctrlRun || (hardwareMvRaw > 0);
}

#endif

#if USE_TNL_DI_TRIGGER
bool tnlDiIsActive();  // modbus_hw.ino
#endif
