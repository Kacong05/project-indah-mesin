import {
    Thermometer,
    Gauge,
    Settings,
    Clock,
    Activity,
    Zap,
} from 'lucide-react';

function InfoCard({ icon: Icon, label, value, unit, colorClass = 'text-gray-800', bgClass = 'bg-orange-50', large = false, className = '' }) {
    return (
        <div className={`rounded-xl bg-white border border-gray-200 hover:shadow-sm transition-shadow min-w-0 h-full ${large ? 'p-4' : 'p-3'} ${className}`}>
            <div className={`flex flex-col items-center text-center justify-center h-full ${large ? 'gap-3' : 'gap-2'}`}>
                <div className={`flex items-center justify-center rounded-xl ${bgClass} ${large ? 'w-16 h-16' : 'w-12 h-12'}`}>
                    <Icon className={`${colorClass} ${large ? 'w-8 h-8' : 'w-6 h-6'}`} />
                </div>
                <p className={`font-semibold text-gray-500 uppercase tracking-wide leading-tight ${large ? 'text-sm' : 'text-xs'}`}>{label}</p>
                <div className="flex items-center gap-1">
                    <p className={`font-bold tabular-nums leading-none ${colorClass} ${large ? 'text-4xl' : 'text-2xl'}`}>{value ?? '-'}</p>
                    {unit && value !== null && value !== undefined && (
                        <span className={`text-gray-400 leading-none ${large ? 'text-base' : 'text-sm'}`}>{unit}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MonitoringPanel({
    pv = null,
    sv = null,
    mv = null,
    processStep = null,
    processPhase = 'idle',
    timerTot = '00:00',
    timerStp = '00:00',
    isOnline = false,
    displayMode = 'idle',
    valveClosed = false,
    lastUpdate = 'N/A',
    runState = 'stop',
}) {
    const formatTemp = (temp) => {
        if (temp === null || temp === undefined) return '-';
        return typeof temp === 'number' ? temp.toFixed(1) : temp;
    };

    const formatMv = (val) => {
        if (val === null || val === undefined) return null;
        return typeof val === 'number' ? val.toFixed(1) : val;
    };

    const svIsStop = sv === 'Stop' || sv === 'stop';

    return (
        <div className="card overflow-hidden">
            <div className="card-header flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <h3 className="text-base font-semibold text-gray-700">Monitoring Panel</h3>
                    <span className="hidden sm:inline text-sm text-gray-400">
                        &middot; UPDATE {lastUpdate}
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {valveClosed && (
                        <span className="text-sm font-medium px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                            Katup tertutup &mdash; PV/SV live
                        </span>
                    )}
                    {!valveClosed && displayMode === 'paused' && (
                        <span className="text-sm font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-800">
                            Menunggu data...
                        </span>
                    )}
                    {!valveClosed && displayMode === 'idle' && (
                        <span className="text-sm font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                            Siap proses berikutnya
                        </span>
                    )}
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                        isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                </div>
            </div>

            <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* PV besar */}
                    <div className="rounded-xl bg-white border border-gray-200 hover:shadow-sm transition-shadow p-6 flex flex-col items-center justify-center text-center gap-4">
                        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-yellow-50">
                            <Thermometer className="w-10 h-10 text-yellow-500" />
                        </div>
                        <p className="text-base font-semibold text-gray-500 uppercase tracking-wide">Process Value (PV)</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-6xl sm:text-7xl font-bold tabular-nums text-yellow-500 leading-none">
                                {formatTemp(pv ?? 0)}
                            </p>
                            <span className="text-2xl text-gray-400">&deg;C</span>
                        </div>
                    </div>

                    {/* SV + MV */}
                    <div className="grid grid-rows-2 gap-3">
                        <InfoCard
                            icon={Gauge}
                            label="Set Value (SV)"
                            value={svIsStop ? 'Stop' : formatTemp(sv ?? 121.1)}
                            unit={svIsStop ? null : '\u00b0C'}
                            colorClass="text-green-600"
                            bgClass="bg-green-50"
                            large
                        />
                        <InfoCard
                            icon={Zap}
                            label="Katup (MV)"
                            value={mv > 0 ? 'Terbuka' : 'Tertutup'}
                            unit={null}
                            colorClass={mv > 0 ? 'text-green-600' : 'text-red-500'}
                            bgClass={mv > 0 ? 'bg-green-50' : 'bg-red-50'}
                            large
                        />
                    </div>
                </div>

                {/* Baris bawah */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-white border border-gray-200 p-3 min-w-0">
                        <div className="flex flex-col items-center text-center gap-2 h-full justify-center">
                            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                                isOnline ? 'bg-green-50' : 'bg-red-50'
                            }`}>
                                <Activity className={`w-6 h-6 ${isOnline ? 'text-green-500' : 'text-red-500'}`} />
                            </div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Machine Status</p>
                            <p className={`text-base font-bold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                                {isOnline ? 'Online' : 'Offline'}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 min-w-0">
                        <div className="flex flex-col items-center text-center gap-2 h-full justify-center">
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-100">
                                <Settings className="w-6 h-6 text-yellow-600" />
                            </div>
                            <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Process Step</p>
                            <p className="text-base font-bold text-yellow-800 truncate w-full">
                                {processStep ?? '-'}
                            </p>
                        </div>
                    </div>

                    <div className="sm:col-span-2 rounded-xl bg-teal-50 border border-teal-100 p-3 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-100 shrink-0">
                                <Clock className="w-5 h-5 text-teal-600" />
                            </div>
                            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Timer</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="text-center p-2 rounded-lg bg-white border border-gray-200">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">TOT M:S</p>
                                <p className="text-2xl font-bold font-mono text-teal-600 tabular-nums">{timerTot}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white border border-gray-200">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">STP M:S</p>
                                <p className="text-2xl font-bold font-mono text-teal-600 tabular-nums">{timerStp}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
