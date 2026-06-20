// TODO(security): This frontend communicates directly with a local API endpoint
// over HTTP (localhost). For production, consider using HTTPS and a
// Backend-for-Frontend (BFF) pattern to proxy requests and keep secrets off the client.

const API_BASE = 'http://127.0.0.1:8000/api';

/**
 * Fetch the latest sensor data from the retort machine.
 * Returns null on failure; callers must handle gracefully.
 */
export async function fetchLatestSensor() {
  try {
    const response = await fetch(`${API_BASE}/sensor/latest`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // Prevent stale cached reads
      cache: 'no-store',
    });

    if (!response.ok) {
      // Do not surface raw HTTP details to console in production
      return null;
    }

    const data = await response.json();

    // Validate expected fields to prevent downstream XSS/rendering issues
    // All values are rendered via React JSX (auto-escaped), but numeric coercion
    // ensures we never pass untrusted strings into Three.js shaders.
    return {
      machine_code: typeof data.machine_code === 'string' ? data.machine_code : '—',
      temperature:  typeof data.temperature  === 'number' ? data.temperature  : 0,
      pressure:     typeof data.pressure     === 'number' ? data.pressure     : 0,
      process_status:
        ['running', 'standby', 'error'].includes(data.process_status)
          ? data.process_status
          : 'standby',
    };
  } catch {
    // Network error – fail safely, return null
    return null;
  }
}
