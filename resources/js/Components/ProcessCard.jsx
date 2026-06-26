/**
 * ProcessCard.jsx
 * Komponen kartu untuk menampilkan satu sesi proses - Light Theme
 */

import { useState, useEffect, useRef } from 'react';
import { Clock, Thermometer, Activity, MoreVertical, Trash2 } from 'lucide-react';

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

export default function ProcessCard({ session, isSelected, onClick, onDelete }) {
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

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Tutup menu saat klik di luar
    useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const isActive = status === 'active';

    const dateStr = new Date(started_at).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            className={`relative w-full text-left p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                menuOpen ? 'z-30' : 'hover-lift'
            } ${
                isSelected
                    ? 'bg-yellow-50 border-[#FFB800] shadow-lg shadow-[#FFB800]/10'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
            }`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800">{name}</h3>
                    {isActive && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            Aktif
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm font-semibold text-gray-500">{dateStr}</span>
                    {onDelete && (
                        <div className="relative" ref={menuRef}>
                            <button
                                type="button"
                                aria-label="Opsi proses"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen((o) => !o);
                                }}
                                className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>
                            {menuOpen && (
                                <div className="absolute right-0 top-8 z-50 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuOpen(false);
                                            onDelete();
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors rounded-md"
                                    >
                                        <Trash2 className="w-4 h-4 flex-shrink-0" />
                                        Hapus Proses
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className={`flex items-center gap-4 mb-4 p-3 rounded-lg border ${getCardBgColor(f0)}`}>
                <div className="text-center flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-gray-500 leading-tight mb-1">
                        Prosesnya sampai dimana
                    </p>
                    <p className="text-sm font-bold text-[#FFB800] truncate">
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
                <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 font-semibold">{time_range}</span>
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
        </div>
    );
}
