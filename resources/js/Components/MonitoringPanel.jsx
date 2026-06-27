import {
    Thermometer,
    Gauge,
    Settings,
    Clock,
    Activity,
    Zap,
} from 'lucide-react';

function InfoCard({ icon: Icon, label, value, unit, colorClass = 'text-gray-800', bgClass = 'bg-orange-50', className = '' }) {
    return (
        <div className={`rounded-xl bg-white border border-gray-200 hover:shadow-sm transition-shadow min-w-0 h-full p-3 ${className}`}>
            <div className="flex flex-col items-center text-center justify-center h-full gap-1.5">
                <div className={`flex items-center justify-center rounded-xl ${bgClass} w-10 h-10`}>
                    <Icon className={`${colorClass} w-5 h-5`} />
                </div>
                <p className="font-semibold text-gray-500 uppercase tracking-wide leading-tight text-[10px]">{label}</p>
                <div className="flex items-center gap-1">
                    <p className={`font-bold tabular-nums leading-none ${colorClass} text-xl`}>{value ?? '-'}</p>
                    {unit && value !== null && value !== undefined && (
                        <span className="text-gray-400 leading-none text-xs">{unit}</span>
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
    timerTot = '00:00',
    timerStp = '00:00',
    isOnline = false,
    displayMode = 'idle',
    valveClosed = false,
    lastUpdate = 'N/A',
}) {
    const formatTemp = (temp) => {
        if (temp === null || temp === undefined) return '-';
        return typeof temp === 'number' ? temp.toFixed(1) : temp;
    };

    const svIsStop = sv === 'Stop' || sv === 'stop';

    return (
        <div className="card overflow-hidden">
            <div className="card-header flex-col sm:flex-row gap-1.5 py-2">
                <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <h3 className="text-sm font-semibold text-gray-700">Monitoring Panel</h3>
                    <span className="hidden sm:inline text-xs text-gray-400">
                        &middot; UPDATE {lastUpdate}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {valveClosed && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            Katup tertutup &mdash; PV/SV live
                        </span>
                    )}
                    {!valveClosed && displayMode === 'paused' && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Menunggu data...
                        </span>
                    )}
                    {!valveClosed && displayMode === 'idle' && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            Siap proses berikutnya
                        </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                </div>
            </div>

            <div className="p-3 space-y-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {/* PV */}
                    <div className="rounded-xl bg-white border border-gray-200 hover:shadow-sm transition-shadow p-4 flex flex-col items-center justify-center text-center gap-2">
                        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-50">
                            <Thermometer className="w-7 h-7 text-yellow-500" />
                        </div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Process Value (PV)</p>
                        <div className="flex items-baseline gap-1.5">
                            <p className="text-5xl font-bold tabular-nums text-yellow-500 leading-none">
                                {formatTemp(pv ?? 0)}
                            </p>
                            <span className="text-lg text-gray-400">&deg;C</span>
                        </div>
                    </div>

                    {/* SV + MV */}
                    <div className="grid grid-rows-2 gap-2">
                        <InfoCard
                            icon={Gauge}
                            label="Set Value (SV)"
                            value={svIsStop ? 'Stop' : formatTemp(sv ?? 121.1)}
                            unit={svIsStop ? null : '\u00b0C'}
                            colorClass="text-green-600"
                            bgClass="bg-green-50"
                        />
                        <InfoCard
                            icon={Zap}
                            label="Katup (MV)"
                            value={mv > 0 ? 'Terbuka' : 'Tertutup'}
                            unit={null}
                            colorClass={mv > 0 ? 'text-green-600' : 'text-red-500'}
                            bgClass={mv > 0 ? 'bg-green-50' : 'bg-red-50'}
                        />
                    </div>
                </div>

                {/* Baris bawah */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="rounded-xl bg-white border border-gray-200 p-2.5 min-w-0">
                        <div className="flex flex-col items-center text-center gap-1.5 h-full justify-center">
                            <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${
                                isOnline ? 'bg-green-50' : 'bg-red-50'
                            }`}>
                                <Activity className={`w-5 h-5 ${isOnline ? 'text-green-500' : 'text-red-500'}`} />
                            </div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Machine Status</p>
                            <p className={`text-sm font-bold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                                {isOnline ? 'Online' : 'Offline'}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-2.5 min-w-0">
                        <div className="flex flex-col items-center text-center gap-1.5 h-full justify-center">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-yellow-100">
                                <Settings className="w-5 h-5 text-yellow-600" />
                            </div>
                            <p className="text-[10px] font-semibold text-yellow-700 uppercase tracking-wide">Process Step</p>
                            <p className="text-sm font-bold text-yellow-800 truncate w-full">
                                {processStep ?? '-'}
                            </p>
                        </div>
                    </div>

                    <div className="sm:col-span-2 rounded-xl bg-teal-50 border border-teal-100 p-2.5 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal-100 shrink-0">
                                <Clock className="w-4 h-4 text-teal-600" />
                            </div>
                            <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide">Timer</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            <div className="text-center p-1.5 rounded-lg bg-white border border-gray-200">
                                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">TOT M:S</p>
                                <p className="text-xl font-bold font-mono text-teal-600 tabular-nums">{timerTot}</p>
                            </div>
                            <div className="text-center p-1.5 rounded-lg bg-white border border-gray-200">
                                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">STP M:S</p>
                                <p className="text-xl font-bold font-mono text-teal-600 tabular-nums">{timerStp}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
