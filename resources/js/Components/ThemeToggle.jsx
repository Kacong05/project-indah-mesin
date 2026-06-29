import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * Tombol pengganti tema gelap/terang.
 * Status disimpan di localStorage('theme') dan diterapkan dengan menambah
 * class `dark` pada <html> (lihat juga script init di app.blade.php).
 */
export default function ThemeToggle({ className = '' }) {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    const toggle = () => {
        const next = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', next);
        try {
            localStorage.setItem('theme', next ? 'dark' : 'light');
        } catch {
            // localStorage tidak tersedia — abaikan, tema tetap berlaku untuk sesi ini
        }
        setIsDark(next);
    };

    return (
        <button
            type="button"
            onClick={toggle}
            title={isDark ? 'Mode terang' : 'Mode gelap'}
            aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            className={`theme-toggle-btn inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-600 bg-white/70 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFB800]/40 ${className}`}
        >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
    );
}
