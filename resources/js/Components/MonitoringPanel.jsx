import {
    Thermometer,
    Gauge,
    Zap,
    ZapOff,
    Wifi,
    WifiOff,
} from 'lucide-react';

function InfoCard({ icon: Icon, label, value, unit, valueClass = 'text-gray-800', iconGradient = 'from-slate-400 to-slate-500', valueSize = 'text-2xl', unitSize = 'text-sm', className = '' }) {
    return (
        <div className={`group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all min-w-0 h-full p-3.5 ${className}`}>
            <div className="flex flex-col items-center text-center justify-center h-full gap-2">
                <div className={`flex items-center justify-center rounded-xl w-12 h-12 bg-gradient-to-br ${iconGradient} shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="text-white w-6 h-6" strokeWidth={2.2} />
                </div>
                <p className="font-semibold text-gray-400 uppercase tracking-wider leading-tight text-[11px]">{label}</p>
                <div className="flex items-baseline gap-1">
                    <p className={`font-extrabold tabular-nums leading-none ${valueClass} ${valueSize}`}>{value ?? '-'}</p>
                    {unit && value !== null && value !== undefined && (
                        <span className={`text-gray-400 leading-none ${unitSize}`}>{unit}</span>
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
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50/40 to-white dark:from-[#1f2128] dark:to-[#1a1d24] border border-amber-100/60 dark:border-[#2b303b] shadow-sm hover:shadow-md transition-all p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[20rem]">
                        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-amber-200/15 blur-2xl" />
                        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-300/80 to-orange-400/80 shadow-sm">
                            <Thermometer className="w-10 h-10 text-white" strokeWidth={2.2} />
                        </div>
                        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Process Value (PV)</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-7xl font-extrabold tabular-nums text-amber-500/90 leading-none">
                                {formatTemp(pv ?? 0)}
                            </p>
                            <span className="text-2xl text-amber-300">&deg;C</span>
                        </div>
                    </div>

                    {/* Kanan: 2 kartu atas (Machine Status, MV) + 1 kartu bawah (SV) */}
                    <div className="grid grid-rows-2 gap-3">
                        <div className="grid grid-cols-2 gap-3">
                            <InfoCard
                                icon={isOnline ? Wifi : WifiOff}
                                label="Machine Status"
                                value={isOnline ? 'Online' : 'Offline'}
                                unit={null}
                                valueClass={isOnline ? 'text-sky-600' : 'text-rose-500'}
                                iconGradient={isOnline ? 'from-sky-500 to-cyan-500' : 'from-rose-500 to-red-500'}
                            />
                            <InfoCard
                                icon={valveOpen ? Zap : ZapOff}
                                label="Katup (MV)"
                                value={valveOpen ? 'Terbuka' : 'Tertutup'}
                                unit={null}
                                valueClass={valveOpen ? 'text-emerald-600' : 'text-rose-500'}
                                iconGradient={valveOpen ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-red-500'}
                            />
                        </div>
                        <InfoCard
                            icon={Gauge}
                            label="Set Value (SV)"
                            value={svIsStop ? 'Stop' : formatTemp(sv ?? 121.1)}
                            unit={svIsStop ? null : '\u00b0C'}
                            valueClass="text-indigo-600"
                            iconGradient="from-indigo-500 to-violet-500"
                            valueSize="text-5xl"
                            unitSize="text-xl"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
