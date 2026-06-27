import {
    Thermometer,
    Gauge,
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
                    {/* PV — kotak besar */}
                    <div className="rounded-xl bg-white border border-gray-200 hover:shadow-sm transition-shadow p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[20rem]">
                        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-yellow-50">
                            <Thermometer className="w-10 h-10 text-yellow-500" />
                        </div>
                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Process Value (PV)</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-7xl font-bold tabular-nums text-yellow-500 leading-none">
                                {formatTemp(pv ?? 0)}
                            </p>
                            <span className="text-2xl text-gray-400">&deg;C</span>
                        </div>
                    </div>

                    {/* SV + MV + Machine Status */}
                    <div className="grid grid-rows-3 gap-3">
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
                        <InfoCard
                            icon={Activity}
                            label="Machine Status"
                            value={isOnline ? 'Online' : 'Offline'}
                            unit={null}
                            colorClass={isOnline ? 'text-green-600' : 'text-red-500'}
                            bgClass={isOnline ? 'bg-green-50' : 'bg-red-50'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
