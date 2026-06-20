// ============================================================
//  retort_sim.ino  –  Fake sensor + retort phase simulation
//  Active when USE_FAKE_SENSOR = true
//  Phases: 0=idle  1=heating  2=holding  3=cooling
// ============================================================

extern RetortState retort;
extern AppConfig   cfg;

// Rate constants (°C per second)
#define SIM_HEAT_RATE_C_PER_S    1.5f   // heating rise
#define SIM_COOL_RATE_C_PER_S    0.8f   // cooling fall
#define SIM_OVERSHOOT_RANGE_C    2.0f   // random overshoot band
#define SIM_NOISE_C              0.1f   // sensor noise amplitude

static float simNoise() {
  // Simple LCG pseudo-random noise ±SIM_NOISE_C
  return ((float)(rand() % 100) / 100.0f - 0.5f) * 2.0f * SIM_NOISE_C;
}

// ---- Update called every sample interval ------------------
void simUpdate(RetortState* s, AppConfig* c) {
  if (!s->running) return;

  float dt = (float)c->sampleIntervalMs / 1000.0f;  // seconds per tick
  uint32_t now     = millis();
  uint32_t elapsed = now - s->phaseStartMs;

  switch (s->phase) {
    // ------ HEATING ----------------------------------------
    case 1: {
      float target = c->heatSetpoint + SIM_OVERSHOOT_RANGE_C;
      s->setpoint  = c->heatSetpoint;
      if (s->tempC < target) {
        s->tempC += SIM_HEAT_RATE_C_PER_S * dt;
        if (s->tempC > target) s->tempC = target;
      }
      s->tempC += simNoise();
      // Transition: temp reached setpoint
      if (s->tempC >= c->heatSetpoint) {
        Serial.println(F("[SIM] -> HOLDING"));
        s->phase        = 2;
        s->phaseStartMs = now;
      }
      break;
    }

    // ------ HOLDING ----------------------------------------
    case 2: {
      s->setpoint = c->heatSetpoint;
      // Slight oscillation around setpoint
      float err = c->heatSetpoint - s->tempC;
      s->tempC  += err * 0.1f * dt + simNoise();
      // Transition: hold time elapsed
      if (elapsed >= c->holdDurationMs) {
        Serial.println(F("[SIM] -> COOLING"));
        s->phase        = 3;
        s->phaseStartMs = now;
      }
      break;
    }

    // ------ COOLING ----------------------------------------
    case 3: {
      s->setpoint = c->coolThresholdC;
      if (s->tempC > c->coolThresholdC) {
        s->tempC -= SIM_COOL_RATE_C_PER_S * dt;
        if (s->tempC < c->coolThresholdC) s->tempC = c->coolThresholdC;
      }
      s->tempC += simNoise();
      // Transition: cooled to threshold
      if (s->tempC <= c->coolThresholdC) {
        Serial.println(F("[SIM] -> IDLE (process complete)"));
        simStopProcess(s);
      }
      break;
    }

    case 0:
    default:
      break;
  }
}

void simStartProcess(RetortState* s) {
  if (s->running) {
    Serial.println(F("[SIM] Already running."));
    return;
  }
  s->running      = true;
  s->phase        = 1;   // start heating
  s->phaseStartMs = millis();
  s->tempC        = 25.0f;
  Serial.println(F("[SIM] Process STARTED -> HEATING"));
}

void simStopProcess(RetortState* s) {
  s->running = false;
  s->phase   = 0;
  Serial.println(F("[SIM] Process STOPPED."));
}
