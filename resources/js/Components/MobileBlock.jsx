import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

/**
 * Tampilkan layar blokir jika lebar viewport < 1024px (tablet/mobile).
 * Wrap seluruh konten dengan komponen ini.
 */
export default function MobileBlock({ children }) {
    const [isDesktop, setIsDesktop] = useState(true);

    useEffect(() => {
        const check = () => setIsDesktop(window.innerWidth >= 1024);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    if (!isDesktop) {
        return (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1a1d2e] px-8 text-center">
                {/* Icon */}
                <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10">
                    <Monitor className="w-10 h-10 text-[#FFB800]" />
                </div>

                {/* Brand */}
                <h1 className="text-2xl font-extrabold tracking-widest uppercase mb-2"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}>
                    <span style={{ color: '#00BFFF' }}>INDAH</span>
                    <span style={{ color: '#FFB800' }}> MESIN</span>
                </h1>

                {/* Message */}
                <p className="mt-4 text-lg font-semibold text-white">
                    Akses Desktop Diperlukan
                </p>
                <p className="mt-2 text-sm text-gray-400 max-w-xs leading-relaxed">
                    Sistem monitoring ini dirancang untuk tampilan desktop.
                    Silakan buka menggunakan komputer atau laptop.
                </p>

                {/* Divider */}
                <div className="mt-8 w-16 h-px bg-white/20" />

                <p className="mt-4 text-xs text-gray-600">
                    Resolusi minimum: 1024px
                </p>
            </div>
        );
    }

    return children;
}
