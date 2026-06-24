/**
 * ProcessCard.jsx
 * Komponen kartu untuk menampilkan satu sesi proses
 */

import { Clock, Thermometer, Activity } from 'lucide-react';

export default function ProcessCard({ session, isSelected, onClick }) {
    const {
        name,
        time_range,
        duration_minutes,
        data_count,
        status,
        started_at,
        latest_temperature, // PV - suhu terkini
        latest_sv          // SV - dari alat
    } = session;

    const isActive = status === 'active';

    // SV (Set Value) - dari data session, default 121.1 jika tidak ada
    const SV = latest_sv || 121.1;

    // Format tanggal
    const dateStr = new Date(started_at).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    // Warna PV berdasarkan kondisi
    const getPVColor = (pv) => {
        if (!pv) return 'text-slate-400';
        const diff = Math.abs(pv - SV);
        if (diff <= 2) return 'text-emerald-400'; // Normal
        if (diff <= 5) return 'text-yellow-400'; // Warning
        return 'text-red-400'; // Critical
    };

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

            {/* SV & PV Display */}
            <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-white/5">
                <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase">SV</p>
                    <p className="text-lg font-bold text-indigo-400">
                        {latest_sv ? `${latest_sv.toFixed(1)}°C` : `${SV.toFixed(1)}°C`}
                    </p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase">PV</p>
                    <p className={`text-lg font-bold ${getPVColor(latest_temperature)}`}>
                        {latest_temperature ? `${latest_temperature.toFixed(1)}°C` : '-'}
                    </p>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-3 gap-3">
                {/* Waktu */}
                <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">{time_range}</span>
                </div>

                {/* Durasi */}
                <div className="flex items-center gap-2 text-xs">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">
                        {duration_minutes ? `${duration_minutes}m` : '-'}
                    </span>
                </div>

                {/* Jumlah Data */}
                <div className="flex items-center gap-2 text-xs">
                    <Thermometer className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">{data_count} data</span>
                </div>
            </div>
        </button>
    );
}
