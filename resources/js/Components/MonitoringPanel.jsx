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
        <div className={`rounded-xl bg-white border border-gray-200 hover:shadow-sm transition-shadow min-w-0 h-full p-3.5 ${className}`}>
            <div className="flex flex-col items-center text-center justify-center h-full gap-2">
                <div className={`flex items-center justify-center rounded-xl ${bgClass} w-12 h-12`}>
                    <Icon className={`${colorClass} w-6 h-6`} />
                </div>
                <p className="font-semibold text-gray-500 uppercase tracking-wide leading-tight text-xs">{label}</p>
                <div className="flex items-center gap-1">
                    <p className={`font-bold tabular-nums leading-none ${colorClass} text-2xl`}>{value ?? '-'}</p>
                    {unit && value !== null && value !== undefined && (
                        <span className="text-gray-400 leading-none text-sm">{unit}</span>
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
    const valveOpen = !valveClosed && (mv ?? 0) > 0;

    return (
        <div className="card overflow-hidden">
            <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* PV */}
                    <div className="rounded-xl bg-white border border-gray-200 hover:shadow-sm transition-shadow p-5 flex flex-col items-center justify-center text-center gap-3">
                        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-50">
                            <Thermometer className="w-8 h-8 text-yellow-500" />
                        </div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Process Value (PV)</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-5xl font-bold tabular-nums text-yellow-500 leading-none">
                                {formatTemp(pv ?? 0)}
                            </p>
                            <span className="text-xl text-gray-400">&deg;C</span>
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
                        />
                        <InfoCard
                            icon={Zap}
                            label="Katup (MV)"
                            value={valveOpen ? 'Terbuka' : 'Tertutup'}
                            unit={null}
                            colorClass={valveOpen ? 'text-green-600' : 'text-red-500'}
                            bgClass={valveOpen ? 'bg-green-50' : 'bg-red-50'}
                        />
                    </div>
                </div>

                {/* Baris bawah */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-white border border-gray-200 p-3 min-w-0">
                        <div className="flex flex-col items-center text-center gap-2 h-full justify-center">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
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

                    <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 min-w-0">
                        <div className="flex flex-col items-center text-center gap-2 h-full justify-center">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-100">
                                <Settings className="w-5 h-5 text-yellow-600" />
                            </div>
                            <p className="text-[10px] font-semibold text-yellow-700 uppercase tracking-wide">P/S</p>
                            <p className="text-sm font-bold text-yellow-800 truncate w-full">
                                {processStep ?? '-'}
                            </p>
                        </div>
                    </div>

                    <div className="sm:col-span-2 rounded-xl bg-teal-50 border border-teal-100 p-3 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100 shrink-0">
                                <Clock className="w-4 h-4 text-teal-600" />
                            </div>
                            <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide">Timer</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="text-center p-2 rounded-lg bg-white border border-gray-200">
                                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">TOT M:S</p>
                                <p className="text-xl font-bold font-mono text-teal-600 tabular-nums">{timerTot}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white border border-gray-200">
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
