/**
 * MonitoringPanel – Layout mengikuti software existing (Autonics/TNL)
 * PV, SV, MV, P/S, TOT M:S, STP M:S + label fase profesional (CUT / Sterilization / Cooling)
 */

const PHASE_COLORS = {
    heating: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    sterilizing: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    cooling: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    idle: { text: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
};

function MetricRow({ label, value, unit, valueClass = 'text-gray-900' }) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
            <span className="text-sm font-semibold text-gray-500 tracking-wide shrink-0">{label}</span>
            <div className="flex items-baseline gap-1 min-w-0">
                <span className={`text-2xl sm:text-3xl font-bold tabular-nums leading-none ${valueClass}`}>
                    {value}
                </span>
                {unit && <span className="text-sm text-gray-400">{unit}</span>}
            </div>
        </div>
    );
}

function TimerCell({ label, value }) {
    return (
        <div className="text-center">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-gray-800">{value}</p>
        </div>
    );
}

export default function MonitoringPanel({
    pv = 0,
    sv = 'Stop',
    mv = 0,
    processStep = 'Stop',
    processStepCode = '00',
    processPhase = 'idle',
    timerTot = '00:00',
    timerStp = '00:00',
    isOnline = false,
    displayMode = 'idle',
    lastUpdate = 'N/A',
    runState = 'stop',
}) {
    const formatTemp = (temp) => {
        if (temp === null || temp === undefined) return '0.0';
        return typeof temp === 'number' ? temp.toFixed(1) : temp;
    };

    const formatMv = (val) => {
        if (val === null || val === undefined) return '0.0';
        return typeof val === 'number' ? val.toFixed(1) : val;
    };

    const svIsStop = sv === 'Stop' || sv === 'stop';
    const phaseStyle = PHASE_COLORS[processPhase] ?? PHASE_COLORS.idle;
    const isStopped = runState === 'stop' || displayMode === 'idle';

    return (
        <div className="card overflow-hidden">
            {/* Header: UPDATE + status koneksi */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-700">UPDATE :</span>{' '}
                    <span className="font-mono tabular-nums">{lastUpdate}</span>
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                    {displayMode === 'paused' && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                            Menunggu data…
                        </span>
                    )}
                    {displayMode === 'idle' && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                            Siap proses berikutnya
                        </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                </div>
            </div>

            <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Kolom kiri: PV / SV / MV */}
                    <div className="space-y-1">
                        <MetricRow
                            label="PV"
                            value={formatTemp(pv)}
                            unit="°C"
                            valueClass="text-gray-900"
                        />
                        <MetricRow
                            label="SV"
                            value={svIsStop ? 'Stop' : formatTemp(sv)}
                            unit={svIsStop ? null : '°C'}
                            valueClass={svIsStop ? 'text-green-600' : 'text-green-600'}
                        />
                        <MetricRow
                            label="MV"
                            value={formatMv(mv)}
                            valueClass="text-orange-500"
                        />

                        {isStopped && (
                            <div className="pt-3">
                                <span className="inline-block px-4 py-1.5 text-sm font-bold tracking-widest bg-yellow-300 text-gray-900 rounded">
                                    STOP
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Kolom kanan: P/S + timer */}
                    <div className={`rounded-xl border p-4 ${phaseStyle.bg} ${phaseStyle.border}`}>
                        <div className="grid grid-cols-3 gap-4 mb-3">
                            <TimerCell label="P/S" value={processStepCode} />
                            <TimerCell label="TOT M:S" value={timerTot} />
                            <TimerCell label="STP M:S" value={timerStp} />
                        </div>
                        <p className={`text-center text-sm font-bold uppercase tracking-wide ${phaseStyle.text}`}>
                            {processStep}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
