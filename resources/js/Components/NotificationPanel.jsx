import { useState, useRef, useEffect } from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import { Bell, AlertTriangle, AlertCircle, Info, ArrowRight, CheckCheck, Clock, Check } from 'lucide-react';

export default function NotificationPanel() {
    const { notifications } = usePage().props;
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);

    const items       = notifications?.items       ?? [];
    const unreadCount = notifications?.unread_count ?? 0;

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const severityConfig = {
        critical: {
            icon: AlertCircle,
            iconCls: 'text-red-400',
            badgeCls: 'bg-red-500/15 border-red-500/30 text-red-400',
            dotCls: 'bg-red-400',
            label: 'Kritis',
        },
        warning: {
            icon: AlertTriangle,
            iconCls: 'text-amber-400',
            badgeCls: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
            dotCls: 'bg-amber-400',
            label: 'Peringatan',
        },
    };

    const cfg = (severity) => severityConfig[severity] ?? {
        icon: Info,
        iconCls: 'text-blue-400',
        badgeCls: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
        dotCls: 'bg-blue-400',
        label: severity,
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button
                id="notification-bell-btn"
                onClick={() => setOpen((v) => !v)}
                className={`relative p-2 rounded-xl transition-all duration-200 ${
                    open
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-slate-900 animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {open && (
                <div
                    id="notification-panel"
                    className="absolute right-0 top-full mt-2 w-80 origin-top-right"
                    style={{ zIndex: 9999 }}
                >
                    {/* Glass Panel */}
                    <div className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                            <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4 text-indigo-400" />
                                <span className="text-sm font-semibold text-white">Notifikasi</span>
                                {unreadCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-xs font-bold text-red-400">
                                        {unreadCount} aktif
                                    </span>
                                )}
                            </div>
                            {unreadCount > 0 ? (
                                <button
                                    onClick={() => router.post(route('alarms.acknowledge-all'), {}, { preserveScroll: true })}
                                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-colors"
                                    title="Tandai semua sudah dibaca"
                                >
                                    <CheckCheck className="h-4 w-4" />
                                </button>
                            ) : (
                                <CheckCheck className="h-4 w-4 text-emerald-400" />
                            )}
                        </div>

                        {/* Items */}
                        <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-8 px-4">
                                    <CheckCheck className="h-8 w-8 text-emerald-400/60" />
                                    <p className="text-sm text-slate-400 text-center">
                                        Tidak ada alarm aktif saat ini
                                    </p>
                                </div>
                            ) : (
                                items.map((item) => {
                                    const { icon: Icon, iconCls, badgeCls, dotCls, label } = cfg(item.severity);
                                    return (
                                        <div
                                            key={item.id}
                                            className="flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                                        >
                                            {/* Icon */}
                                            <div className={`mt-0.5 flex-shrink-0 ${iconCls}`}>
                                                <Icon className="h-4 w-4" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${badgeCls}`}>
                                                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotCls}`} />
                                                        {label}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 truncate">
                                                        {item.machine_name}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-300 leading-snug line-clamp-2">
                                                    {item.message}
                                                </p>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Clock className="h-3 w-3 text-slate-500" />
                                                    <span className="text-[10px] text-slate-500">
                                                        {item.triggered_at}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action */}
                                            <button
                                                onClick={() => router.post(route('alarms.acknowledge', item.id), {}, { preserveScroll: true })}
                                                className="mt-0.5 flex-shrink-0 p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                                title="Tandai sudah dibaca"
                                            >
                                                <Check className="h-4 w-4" />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-white/10 bg-white/5">
                            <Link
                                href={route('alarms')}
                                onClick={() => setOpen(false)}
                                className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                                Lihat Semua Alarm
                                <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
