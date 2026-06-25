/**
 * MonitoringPanel – Horizontal monitoring panel with compact cards
 */

import {
    Thermometer,
    Gauge,
    Settings,
    Clock,
    Activity,
    Zap,
} from 'lucide-react';

function StatusBadge({ status }) {
    const config = {
        running: { label: 'Running', bg: 'bg-green-100 text-green-700', icon: '●' },
        heating: { label: 'Pemanasan', bg: 'bg-orange-100 text-orange-700', icon: '▲' },
        sterilizing: { label: 'Sterilisasi', bg: 'bg-red-100 text-red-700', icon: '●' },
        holding: { label: 'Sterilisasi', bg: 'bg-red-100 text-red-700', icon: '●' },
        cooling: { label: 'Pendinginan', bg: 'bg-blue-100 text-blue-700', icon: '▼' },
        stop: { label: 'Stop', bg: 'bg-red-100 text-red-700', icon: '■' },
        hold: { label: 'Hold', bg: 'bg-yellow-100 text-yellow-700', icon: '▌▌' },
        alarm: { label: 'Alarm', bg: 'bg-red-100 text-red-700', icon: '⚠' },
        standby: { label: 'Standby', bg: 'bg-amber-100 text-amber-700', icon: '○' },
    };

    const current = config[status?.toLowerCase()] ?? {
        label: status ?? 'Unknown',
        bg: 'bg-gray-100 text-gray-600',
        icon: '?',
    };

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${current.bg}`}>
            <span>{current.icon}</span>
            {current.label}
        </span>
    );
}

function InfoCard({ icon: Icon, label, value, unit, colorClass = 'text-gray-800', bgClass = 'bg-orange-50', large = false, className = '' }) {
    return (
        <div className={`rounded-xl bg-white border border-gray-200 hover:shadow-sm transition-shadow min-w-0 ${large ? 'p-4' : 'p-3'} ${className}`}>
            <div className={`flex flex-col items-center text-center ${large ? 'gap-3' : 'gap-2'}`}>
                <div className={`flex items-center justify-center rounded-xl ${bgClass} ${large ? 'w-14 h-14' : 'w-10 h-10'}`}>
                    <Icon className={`${colorClass} ${large ? 'w-7 h-7' : 'w-5 h-5'}`} />
                </div>
                <p className={`font-medium text-gray-500 uppercase tracking-wide leading-tight ${large ? 'text-xs' : 'text-[10px]'}`}>{label}</p>
                <div className="flex items-baseline gap-1">
                    <p className={`font-bold tabular-nums ${colorClass} ${large ? 'text-3xl' : 'text-xl'}`}>{value ?? '—'}</p>
                    {unit && <span className={`text-gray-400 ${large ? 'text-sm' : 'text-xs'}`}>{unit}</span>}
                </div>
            </div>
        </div>
    );
}

export default function MonitoringPanel({
    pv = null,
    sv = null,
    mv = null,
    status = 'stop',
    processStep = null,
    timerTot = '00:00:00',
    timerStp = '00:00:00',
    timerRem = '00:00:00',
    isOnline = false,
}) {
    const formatTemp = (temp) => {
        if (temp === null || temp === undefined) return '—';
        return typeof temp === 'number' ? temp.toFixed(1) : temp;
    };

    const formatMv = (val) => {
        if (val === null || val === undefined) return '—';
        return typeof val === 'number' ? val.toFixed(1) : val;
    };

    return (
        <div className="card overflow-hidden">
            <div className="card-header">
                <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <h3 className="text-sm font-semibold text-gray-700">Monitoring Panel</h3>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
            </div>

            <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9 gap-3">
                    <InfoCard
                        icon={Thermometer}
                        label="Process Value (PV)"
                        value={formatTemp(pv ?? 0)}
                        unit="°C"
                        colorClass="text-yellow-500"
                        bgClass="bg-yellow-50"
                        large
                        className="sm:col-span-2 lg:col-span-2"
                    />

                    <InfoCard
                        icon={Gauge}
                        label="Set Value (SV)"
                        value={formatTemp(sv ?? 121.1)}
                        unit="°C"
                        colorClass="text-green-600"
                        bgClass="bg-green-50"
                        large
                        className="sm:col-span-2 lg:col-span-2"
                    />

                    <div className="rounded-xl bg-white border border-gray-200 p-3 min-w-0">
                        <div className="flex flex-col items-center text-center gap-2 h-full justify-center">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                                isOnline ? 'bg-blue-50' : 'bg-red-50'
                            }`}>
                                <Activity className={`w-5 h-5 ${isOnline ? 'text-blue-500' : 'text-red-500'}`} />
                            </div>
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Machine Status</p>
                            <StatusBadge status={status} />
                        </div>
                    </div>

                    <InfoCard
                        icon={Zap}
                        label="Output (MV)"
                        value={formatMv(mv)}
                        unit="%"
                        colorClass="text-purple-500"
                        bgClass="bg-purple-50"
                    />

                    <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 min-w-0">
                        <div className="flex flex-col items-center text-center gap-2 h-full justify-center">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-100">
                                <Settings className="w-5 h-5 text-yellow-600" />
                            </div>
                            <p className="text-[10px] font-medium text-yellow-700 uppercase tracking-wide">Process Step</p>
                            <p className="text-sm font-bold text-yellow-800 truncate w-full">
                                {processStep ?? '—'}
                            </p>
                        </div>
                    </div>

                    <div className="col-span-2 rounded-xl bg-teal-50 border border-teal-100 p-3 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100 shrink-0">
                                <Clock className="w-4 h-4 text-teal-600" />
                            </div>
                            <p className="text-[10px] font-medium text-teal-700 uppercase tracking-wide">Timer</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="text-center p-2 rounded-lg bg-white border border-gray-200">
                                <p className="text-[10px] font-medium text-gray-500 uppercase mb-0.5">Total</p>
                                <p className="text-sm font-bold font-mono text-teal-600 tabular-nums">{timerTot}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white border border-gray-200">
                                <p className="text-[10px] font-medium text-gray-500 uppercase mb-0.5">Step</p>
                                <p className="text-sm font-bold font-mono text-teal-600 tabular-nums">{timerStp}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white border border-gray-200">
                                <p className="text-[10px] font-medium text-gray-500 uppercase mb-0.5">Remain</p>
                                <p className="text-sm font-bold font-mono text-teal-600 tabular-nums">{timerRem}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
