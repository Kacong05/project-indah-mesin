// ============================================================
//  retort_sim.ino  –  Simulasi heating/holding/cooling
//  Aktif jika USE_FAKE_SENSOR = true
// ============================================================

#if USE_FAKE_SENSOR

extern AppConfig   cfg;
extern RetortState state;

static const float SIM_NOISE = 0.15f;
static unsigned long lastSimMs = 0;
static const unsigned long SIM_INTERVAL_MS = 500;

static float simNoise() {
  return ((float)(esp_random() % 200) / 1000.0f - 0.1f) * SIM_NOISE;
}

void setupRetortSim() {
  Serial.println(F("[SIM] Fake sensor mode active."));
}

void loopRetortSim() {
  unsigned long now = millis();
  if (now - lastSimMs < SIM_INTERVAL_MS) return;
  lastSimMs = now;

  if (state.phase == PHASE_IDLE) return;

  float dt = (float)SIM_INTERVAL_MS / 1000.0f;
  unsigned long elapsed = now - state.phaseStartMs;

  switch (state.phase) {
    case PHASE_HEATING: {
      state.temperature += cfg.heatingRate * dt + simNoise();
      // Simulasi tekanan naik seiring suhu
      state.pressure = 1.013f + (state.temperature - 25.0f) * 0.01f;
      if (state.temperature >= cfg.targetTemp) {
        state.temperature = cfg.targetTemp;
        state.phase = PHASE_HOLDING;
        state.phaseStartMs = now;
        Serial.println(F("[SIM] -> HOLDING"));
      }
      break;
    }
    case PHASE_HOLDING: {
      // Osilasi kecil di sekitar target
      float err = cfg.targetTemp - state.temperature;
      state.temperature += err * 0.1f * dt + simNoise();
      state.pressure = 1.013f + (state.temperature - 25.0f) * 0.01f;
      if (elapsed >= (unsigned long)cfg.holdingTimeSec * 1000UL) {
        state.phase = PHASE_COOLING;
        state.phaseStartMs = now;
        Serial.println(F("[SIM] -> COOLING"));
      }
      break;
    }
    case PHASE_COOLING: {
      state.temperature -= cfg.coolingRate * dt;
      state.temperature += simNoise();
      state.pressure = 1.013f + (state.temperature - 25.0f) * 0.01f;
      if (state.pressure < 1.013f) state.pressure = 1.013f;
      if (state.temperature <= 40.0f) {
        state.temperature = 40.0f;
        state.phase = PHASE_IDLE;
        state.phaseStartMs = 0;
        Serial.println(F("[SIM] -> IDLE (complete)"));
      }
      break;
    }
    default:
      break;
  }
}

void startProcess() {
  if (state.phase != PHASE_IDLE) {
    Serial.println(F("[SIM] Already running."));
    return;
  }
  state.phase = PHASE_HEATING;
  state.phaseStartMs = millis();
  state.temperature = 25.0f;
  state.pressure = 1.013f;
  Serial.println(F("[SIM] START -> HEATING"));
}

void stopProcess() {
  state.phase = PHASE_IDLE;
  state.phaseStartMs = 0;
  Serial.println(F("[SIM] STOPPED."));
}

#else  // Stubs jika USE_FAKE_SENSOR = false

void setupRetortSim() {}
void loopRetortSim() {}

// startProcess dan stopProcess akan disediakan oleh modbus_hw.ino
// jika USE_MODBUS = true dan USE_FAKE_SENSOR = false

#if !USE_MODBUS
void startProcess() {
  state.phase = PHASE_HEATING;
  state.phaseStartMs = millis();
  Serial.println(F("[RETORT] START"));
}
void stopProcess() {
  state.phase = PHASE_IDLE;
  state.phaseStartMs = 0;
  Serial.println(F("[RETORT] STOP"));
}
#endif

#endif
