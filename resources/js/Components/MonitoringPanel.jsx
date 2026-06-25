/**
 * MonitoringPanel – Vertical monitoring panel for retort machine dashboard.
 * Features: PV, Machine Status, SV, MV, Process Step, Timer (TOT/STP/REM)
 * Design: Matches Dashboard.jsx stat cards styling (bg-white/5, backdrop-blur-xl, etc.)
 */

import {
    Thermometer,
    Gauge,
    Settings,
    Clock,
    Activity,
    Wifi,
} from 'lucide-react';

// ─── Machine Status Badge ────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const config = {
        running: {
            label: 'Running',
            bg: 'bg-emerald-500/20 text-emerald-400',
            icon: '●',
        },
        stop: {
            label: 'Stop',
            bg: 'bg-red-500/20 text-red-400',
            icon: '■',
        },
        hold: {
            label: 'Hold',
            bg: 'bg-amber-500/20 text-amber-400',
            icon: '▌▌',
        },
        alarm: {
            label: 'Alarm',
            bg: 'bg-red-500/20 text-red-400',
            icon: '⚠',
        },
        standby: {
            label: 'Standby',
            bg: 'bg-yellow-500/20 text-yellow-400',
            icon: '○',
        },
    };

    const current = config[status?.toLowerCase()] ?? {
        label: status ?? 'Unknown',
        bg: 'bg-slate-500/20 text-slate-400',
        icon: '?',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${current.bg}`}>
            <span className="text-base">{current.icon}</span>
            {current.label}
        </span>
    );
}

// ─── Main MonitoringPanel Component ─────────────────────────────────────────
export default function MonitoringPanel({
    pv = null,              // Process Value - actual temperature (°C)
    sv = null,              // Set Value - target temperature (°C)
    mv = null,              // Manipulated Value - control output (%)
    status = 'stop',        // Machine status: running, stop, hold, alarm, standby
    processStep = null,     // Process step name
    timerTot = '00:00:00', // Total process time
    timerStp = '00:00:00', // Step time
    timerRem = '00:00:00', // Remaining time
    isOnline = false,
}) {
    // Use real data if available, otherwise use props
    const displayPv = pv ?? 0;
    const displaySv = sv ?? 121.1;

    // Format temperature display
    const formatTemp = (temp) => {
        if (temp === null || temp === undefined) return '—';
        return typeof temp === 'number' ? temp.toFixed(1) : temp;
    };

    // Format MV display
    const formatMv = (val) => {
        if (val === null || val === undefined) return '—';
        return typeof val === 'number' ? val.toFixed(1) : val;
    };

    return (
        <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                    <h3 className="text-sm font-semibold text-white">Monitoring Panel</h3>
                </div>
                <span className={`text-xs font-medium ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
            </div>

            {/* Content */}
            <div className="flex-1 p-5 space-y-5">

                {/* 1. Process Value (PV) - Temperature Highlight */}
                <div className="overflow-hidden rounded-2xl bg-orange-500/10 border border-orange-500/20 p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                            <Thermometer className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-slate-400">Process Value (PV)</h3>
                            <div className="flex items-baseline gap-1 mt-1">
                                <p className="text-3xl font-bold text-white tabular-nums">
                                    {formatTemp(displayPv)}
                                </p>
                                <p className="text-sm font-medium text-slate-400">°C</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Machine Status */}
                <div className="overflow-hidden rounded-2xl bg-white/5 border border-white/10 p-5">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isOnline ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                            <Activity className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-slate-400">Machine Status</h3>
                            <div className="mt-1">
                                <StatusBadge status={status} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Set Value (SV) */}
                <div className="overflow-hidden rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                            <Gauge className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-slate-400">Set Value (SV)</h3>
                            <div className="flex items-baseline gap-1 mt-1">
                                <p className="text-3xl font-bold text-white tabular-nums">
                                    {formatTemp(displaySv)}
                                </p>
                                <p className="text-sm font-medium text-slate-400">°C</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Manipulated Value (MV) */}
                <div className="overflow-hidden rounded-2xl bg-violet-500/10 border border-violet-500/20 p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400">
                            <Settings className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-slate-400">Output Kontrol (MV)</h3>
                            <div className="flex items-baseline gap-1 mt-1">
                                <p className="text-3xl font-bold text-white tabular-nums">
                                    {formatMv(mv)}
                                </p>
                                <p className="text-sm font-medium text-slate-400">%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. Process Step (P/S) */}
                <div className="overflow-hidden rounded-2xl bg-yellow-500/10 border border-yellow-500/20 p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-400">
                            <Settings className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-slate-400">Process Step (P/S)</h3>
                            <p className="mt-1 text-xl font-bold text-yellow-400">
                                {processStep ?? '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 6. Timer Section */}
                <div className="overflow-hidden rounded-2xl bg-teal-500/10 border border-teal-500/20 p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400">
                            <Clock className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-slate-400">Timer</h3>
                        </div>
                    </div>

                    {/* Timer Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        {/* Total Time */}
                        <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total</p>
                            <p className="text-lg font-bold font-mono text-teal-400 tabular-nums">
                                {timerTot}
                            </p>
                        </div>

                        {/* Step Time */}
                        <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Step</p>
                            <p className="text-lg font-bold font-mono text-teal-400 tabular-nums">
                                {timerStp}
                            </p>
                        </div>

                        {/* Remaining Time */}
                        <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Remain</p>
                            <p className="text-lg font-bold font-mono text-teal-400 tabular-nums">
                                {timerRem}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}