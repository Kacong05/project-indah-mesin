/**
 * ProcessCard.jsx
 * Komponen kartu untuk menampilkan satu sesi proses - Light Theme
 */

import { Clock, Thermometer, Activity } from 'lucide-react';

const F0_TARGET = 6;

const PROCESS_STATUS_LABELS = {
    idle: 'Idle',
    heating: 'Pemanasan',
    sterilizing: 'Sterilisasi',
    holding: 'Holding',
    cooling: 'Pendinginan',
    completed: 'Selesai',
    running: 'Berjalan',
    logging: 'Logging',
    stop: 'Stop',
    alarm: 'Alarm',
};

function formatProcessStatus(status) {
    if (!status) return '—';
    const key = status.toLowerCase();
    return PROCESS_STATUS_LABELS[key]
        ?? status.charAt(0).toUpperCase() + status.slice(1);
}

function getF0Color(f0) {
    if (f0 === null || f0 === undefined) return 'text-gray-400';
    if (f0 >= F0_TARGET) return 'text-green-600';
    if (f0 > 0) return 'text-amber-600';
    return 'text-red-600';
}

function getCardBgColor(f0) {
    if (f0 === null || f0 === undefined) return 'bg-gray-50 border-gray-200';
    if (f0 >= F0_TARGET) return 'bg-green-50 border-green-200';
    if (f0 > 0) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
}

export default function ProcessCard({ session, isSelected, onClick }) {
    const {
        name,
        time_range,
        duration_minutes,
        data_count,
        status,
        started_at,
        f0,
        process_status,
    } = session;

    const isActive = status === 'active';

    const dateStr = new Date(started_at).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-200 hover-lift ${
                isSelected
                    ? 'bg-orange-50 border-[#FF7A00] shadow-lg shadow-[#FF7A00]/10'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
            }`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800">{name}</h3>
                    {isActive && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            Aktif
                        </span>
                    )}
                </div>
                <span className="text-xs text-gray-400">{dateStr}</span>
            </div>

            <div className={`flex items-center gap-4 mb-4 p-3 rounded-lg border ${getCardBgColor(f0)}`}>
                <div className="text-center flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-gray-500 leading-tight mb-1">
                        Prosesnya sampai dimana
                    </p>
                    <p className="text-sm font-bold text-[#FF7A00] truncate">
                        {formatProcessStatus(process_status)}
                    </p>
                </div>
                <div className="w-px h-10 bg-gray-200 shrink-0" />
                <div className="text-center flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">F₀</p>
                    <p className={`text-xl font-bold tabular-nums ${getF0Color(f0)}`}>
                        {f0 !== null && f0 !== undefined ? f0.toFixed(2) : '—'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500 font-medium">{time_range}</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                    <Activity className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500 font-medium">
                        {duration_minutes ? `${duration_minutes}m` : '-'}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                    <Thermometer className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500 font-medium">{data_count} data</span>
                </div>
            </div>
        </button>
    );
}
