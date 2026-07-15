// TODO(security): This frontend communicates directly with a local API endpoint
// over HTTP (localhost). For production, consider using HTTPS and a
// Backend-for-Frontend (BFF) pattern to proxy requests and keep secrets off the client.

/**
 * Fetch the latest sensor data from the retort machine.
 * Returns null on failure; callers must handle gracefully.
 */
export async function fetchLatestSensor() {
  try {
    const response = await fetch(`/monitoring/live`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // Prevent stale cached reads
      cache: 'no-store',
    });

    if (!response.ok) {
      // Do not surface raw HTTP details to console in production
      return null;
    }

    const json = await response.json();
    const data = json.data?.stats;
    if (!data) return null;

    // Validate expected fields to prevent downstream XSS/rendering issues
    // All values are rendered via React JSX (auto-escaped), but numeric coercion
    // ensures we never pass untrusted strings into Three.js shaders.
    return {
      machine_code: typeof data.machineCode === 'string' ? data.machineCode : '—',
      temperature:  typeof data.currentTemperature === 'number' ? data.currentTemperature : 0,
      sv:           typeof data.sv === 'number' ? data.sv : 0,
      mv:           typeof data.mv === 'number' ? data.mv : 0,
      pressure:     typeof data.pressure === 'number' ? data.pressure : 0, // Pressure is not in monitoring/live by default, fallback to 0 or check if it exists
      process_status:
        ['running', 'standby', 'error'].includes(data.runState)
          ? data.runState
          : 'standby',
    };
  } catch {
    // Network error – fail safely, return null
    return null;
  }
}
