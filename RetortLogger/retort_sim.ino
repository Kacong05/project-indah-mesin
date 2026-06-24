// ============================================================
//  retort_sim.ino  –  Simulasi heating/holding/cooling
//  Aktif jika USE_FAKE_SENSOR = true
// ============================================================

#if USE_FAKE_SENSOR

extern AppConfig   cfg;
extern RetortState state;

static const float SIM_NOISE = 0.15f;
static unsigned long lastSimMs = 0;
static const unsigned long SIM_MS = 500;

static float simNoise() {
  return ((float)(esp_random() % 200) / 1000.0f - 0.1f) * SIM_NOISE;
}

void setupRetortSim() {
  Serial.println(F("[SIM] Fake sensor active."));
}

void loopRetortSim() {
  unsigned long now = millis();
  if (now - lastSimMs < SIM_MS) return;
  lastSimMs = now;
  if (state.phase == PHASE_IDLE) return;

  float dt = (float)SIM_MS / 1000.0f;

  switch (state.phase) {
    case PHASE_HEATING:
      state.temperature += cfg.heatingRate * dt + simNoise();
      state.pressure = 1.013f + (state.temperature - 25.0f) * 0.01f;
      if (state.temperature >= cfg.targetTemp) {
        state.temperature = cfg.targetTemp;
        state.phase = PHASE_HOLDING;
        state.phaseStartMs = now;
        Serial.println(F("[SIM] -> HOLDING"));
      }
      break;
    case PHASE_HOLDING: {
      float err = cfg.targetTemp - state.temperature;
      state.temperature += err * 0.1f * dt + simNoise();
      state.pressure = 1.013f + (state.temperature - 25.0f) * 0.01f;
      if (now - state.phaseStartMs >= (unsigned long)cfg.holdingTimeSec * 1000UL) {
        state.phase = PHASE_COOLING;
        state.phaseStartMs = now;
        Serial.println(F("[SIM] -> COOLING"));
      }
      break;
    }
    case PHASE_COOLING:
      state.temperature -= cfg.coolingRate * dt;
      state.temperature += simNoise();
      state.pressure = 1.013f + (state.temperature - 25.0f) * 0.01f;
      if (state.pressure < 1.013f) state.pressure = 1.013f;
      if (state.temperature <= 40.0f) {
        state.temperature = 40.0f;
        state.phase = PHASE_IDLE;
        Serial.println(F("[SIM] -> IDLE"));
      }
      break;
    default:
      break;
  }
  state.setpoint = cfg.targetTemp;
}

void startProcess() {
  if (state.phase != PHASE_IDLE) return;
  state.phase = PHASE_HEATING;
  state.phaseStartMs = millis();
  state.temperature = 25.0f;
  state.pressure = 1.013f;
  state.setpoint = cfg.targetTemp;
  state.logging = true;
  sdStartLog();
  Serial.println(F("[SIM] START -> HEATING"));
}

void stopProcess() {
  state.phase = PHASE_IDLE;
  state.phaseStartMs = 0;
  state.logging = false;
  sdStopLog();
  Serial.println(F("[SIM] STOPPED."));
}

#else

// Mode hardware (Modbus): suhu/SV berasal dari controller TNL.
// Start/Stop hanya mengontrol sesi perekaman CSV.
void setupRetortSim() {}
void loopRetortSim() {}

void startProcess() {
  if (state.logging) return;
  state.logging = true;
  sdStartLog();
  Serial.println(F("[LOG] Recording started."));
}

void stopProcess() {
  if (!state.logging) return;
  state.logging = false;
  sdStopLog();
  Serial.println(F("[LOG] Recording stopped."));
}

#endif
