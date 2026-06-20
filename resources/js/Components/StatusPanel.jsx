/**
 * StatusPanel – displays sensor data for the retort machine.
 * All values are rendered via React JSX auto-escaping (no dangerouslySetInnerHTML).
 * Sensor data is pre-validated in api.js before reaching this component.
 */

function StatusBadge({ status }) {
  const config = {
    running: { label: 'Running',  bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400', dot: 'bg-emerald-400', pulse: true  },
    standby: { label: 'Standby',  bg: 'bg-yellow-500/20',  border: 'border-yellow-500',  text: 'text-yellow-400',  dot: 'bg-yellow-400',  pulse: false },
    error:   { label: 'Error',    bg: 'bg-red-500/20',     border: 'border-red-500',     text: 'text-red-400',     dot: 'bg-red-400',     pulse: true  },
  }[status] ?? { label: status, bg: 'bg-gray-700/30', border: 'border-gray-600', text: 'text-gray-400', dot: 'bg-gray-400', pulse: false };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${config.bg} ${config.border} ${config.text}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`} />
      {config.label}
    </div>
  );
}

function TempBar({ temperature }) {
  const pct = Math.min(Math.max((temperature / 140) * 100, 0), 100);
  const color =
    temperature > 121 ? 'from-red-600 to-red-400'    :
    temperature > 115 ? 'from-red-500 to-orange-400' :
    temperature >= 100 ? 'from-orange-500 to-yellow-400' :
                        'from-slate-600 to-slate-400';

  return (
    <div className="relative w-full h-2 bg-slate-700 rounded-full overflow-hidden mt-1">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function DataRow({ label, value, unit, children }) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 transition-colors">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">{label}</span>
      {children ?? (
        <span className="text-2xl font-bold text-slate-100 tabular-nums">
          {value}
          {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
        </span>
      )}
    </div>
  );
}

export default function StatusPanel({ data, error }) {
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-400 space-y-2">
          <div className="text-4xl">⚠</div>
          <p className="text-sm">Unable to reach sensor API</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-slate-500 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-sm">Connecting to sensor…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700/60">
        <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_2px_rgba(34,211,238,0.5)]" />
        <h2 className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">
          Live Sensor Data
        </h2>
      </div>

      {/* Machine Code */}
      <DataRow label="Machine Code" value={data.machine_code} />

      {/* Temperature */}
      <DataRow label="Temperature" value={data.temperature.toFixed(1)} unit="°C">
        <span className="text-2xl font-bold text-slate-100 tabular-nums">
          {data.temperature.toFixed(1)}
          <span className="text-sm font-normal text-slate-400 ml-1">°C</span>
        </span>
        <TempBar temperature={data.temperature} />
        <span className="text-xs text-slate-500 mt-0.5">
          {data.temperature > 121 ? 'Critical heat'
            : data.temperature > 115 ? 'High heat'
            : data.temperature >= 100 ? 'Process temp'
            : 'Ambient'}
        </span>
      </DataRow>

      {/* Pressure */}
      <DataRow label="Pressure" value={data.pressure.toFixed(2)} unit="bar" />

      {/* Process Status */}
      <DataRow label="Process Status">
        <StatusBadge status={data.process_status} />
      </DataRow>

      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-slate-700/40 text-xs text-slate-600 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
        Polling every 5 seconds
      </div>
    </div>
  );
}
