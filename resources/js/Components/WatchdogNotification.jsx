import { useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { AlertTriangle, Bell, X } from 'lucide-react';

export default function WatchdogNotification() {
    const { latestWdtEvent: initialEvent, auth } = usePage().props;
    const machineCode = auth?.machineCode;
    const [event, setEvent] = useState(initialEvent ?? null);
    const [open, setOpen] = useState(false);
    const [dismissedId, setDismissedId] = useState(null);
    const panelRef = useRef(null);

    useEffect(() => {
        setEvent(initialEvent ?? null);
    }, [initialEvent]);

    useEffect(() => {
        const onWdt = (e) => {
            if (e.detail) {
                setEvent(e.detail);
                setDismissedId(null);
            }
        };
        window.addEventListener('retort:wdt', onWdt);
        return () => window.removeEventListener('retort:wdt', onWdt);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    if (!event || dismissedId === event.id) {
        return null;
    }

    const label = event.displayAt || event.iso || event.created_at;

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative p-2 rounded-lg text-[#566a7f] hover:text-[#ff3e1d] hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                aria-label="Notifikasi Watchdog"
                title="Watchdog reset terdeteksi"
            >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#1a1d24]" />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#1f2128] rounded-xl shadow-lg border border-red-200 dark:border-red-900/50 z-50 overflow-hidden">
                    <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                                Watchdog Reset
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-relaxed">
                                ESP {machineCode || 'IoT'} restart otomatis ({event.reason || 'WDT'}) pada{' '}
                                <strong>{label}</strong>.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setDismissedId(event.id);
                                setOpen(false);
                            }}
                            className="shrink-0 p-1 rounded text-red-400 hover:text-red-600"
                            aria-label="Tutup notifikasi"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
