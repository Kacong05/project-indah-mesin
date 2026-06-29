import { Link } from '@inertiajs/react';
import MobileBlock from '@/Components/MobileBlock';
import ThemeToggle from '@/Components/ThemeToggle';

export default function GuestLayout({ children }) {
    return (
        <MobileBlock>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-50 to-orange-50 dark:from-[#0f1115] dark:via-[#0f1115] dark:to-[#14171d] px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Theme Toggle — pojok kanan atas */}
            <div className="absolute top-4 right-4 z-20">
                <ThemeToggle />
            </div>

            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgb(0_0_0/_3%)_1px,_transparent_0)] [background-size:24px_24px]"></div>

            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-orange-200/30 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-orange-200/30 to-transparent rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo Card */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <img
                                src="/logo.png"
                                alt="Logo"
                                className="w-14 h-14 object-contain drop-shadow-md"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                            {/* Fallback SVG icon - shown when image fails */}
                            <svg
                                className="w-10 h-10 text-[#FFB800] drop-shadow-md"
                                style={{ display: 'none' }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                    </Link>
                    <h1 className="text-3xl font-extrabold tracking-widest uppercase" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                        <span style={{ color: '#00BFFF' }}>INDAH</span>
                        <span style={{ color: '#FFB800' }}> MESIN</span>
                    </h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Sistem Monitoring Retort Sterilisasi
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    {/* Card Header */}
                    <div className="px-8 pt-8 pb-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white dark:from-[#21252e] dark:to-[#1a1d24]">
                        <h2 className="text-xl font-bold text-gray-800">Selamat Datang</h2>
                        <p className="mt-1 text-sm text-gray-500">Silakan masuk dengan akun Anda</p>
                    </div>

                    {/* Form Area */}
                    <div className="px-8 py-6">
                        {children}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-400">
                        &copy; 2026 Indah Mesin. Hak cipta dilindungi.
                    </p>
                </div>
            </div>
        </div>
        </MobileBlock>
    );
}
