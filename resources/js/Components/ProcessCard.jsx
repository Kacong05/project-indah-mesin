/**
 * ProcessCard.jsx
 * Komponen kartu untuk menampilkan satu sesi proses
 */

import { Clock, Thermometer, Gauge, Activity } from 'lucide-react';

export default function ProcessCard({ session, isSelected, onClick }) {
    const {
        name,
        time_range,
        duration_minutes,
        data_count,
        status,
        started_at
    } = session;

    const isActive = status === 'active';
    const isCompleted = status === 'completed';

    // Format tanggal
    const dateStr = new Date(started_at).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    return (
        <button
            onClick={onClick}
            className={`
                w-full text-left p-4 rounded-xl border transition-all duration-200
                ${isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/20'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{name}</h3>
                    {isActive && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Aktif
                        </span>
                    )}
                </div>
                <span className="text-xs text-slate-400">{dateStr}</span>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Waktu */}
                <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">{time_range}</span>
                </div>

                {/* Durasi */}
                <div className="flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">
                        {duration_minutes ? `${duration_minutes} menit` : '-'}
                    </span>
                </div>

                {/* Jumlah Data */}
                <div className="flex items-center gap-2 text-sm">
                    <Thermometer className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">{data_count} data</span>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 text-sm">
                    <Gauge className="w-4 h-4 text-slate-400" />
                    <span className={`${
                        isActive ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                        {isActive ? 'Berlangsung' : (isCompleted ? 'Selesai' : '-')}
                    </span>
                </div>
            </div>
        </button>
    );
}
