import { useState, useEffect, useRef } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { Menu, LogOut, Maximize, Minimize } from 'lucide-react';
import NavbarMenu from '@/Components/NavbarMenu';
import MobileBlock from '@/Components/MobileBlock';
import ThemeToggle from '@/Components/ThemeToggle';

export default function AuthenticatedLayout({ header, children }) {
    const user = usePage().props.auth.user;
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    useEffect(() => {
        function handleFullscreenChange() {
            setIsFullscreen(!!document.fullscreenElement);
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch {
            // Browser may block fullscreen without user gesture
        }
        setDropdownOpen(false);
    };

    return (
        <MobileBlock>
        <div className="min-h-screen bg-[#f4f5fa] flex flex-col">
            {/* Top Header Bar */}
            <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#d9dee3]/50 shadow-sm">
                <div className="max-w-[1440px] mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* Left: Brand / Logo */}
                    <div className="flex items-center gap-3">
                        <Link href={route('monitoring')} className="flex items-center gap-2">
                            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain drop-shadow-sm" />
                            <h1 className="text-xl font-extrabold tracking-widest uppercase hidden sm:block" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                                <span style={{ color: '#00BFFF' }}>INDAH</span>
                                <span style={{ color: '#FFB800' }}> MESIN</span>
                            </h1>
                        </Link>
                    </div>

                    {/* Right: Search + Notifications + User */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 text-[#566a7f] hover:text-[#32475c] focus:outline-none"
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        {/* Theme Toggle — di kiri profil */}
                        <ThemeToggle />

                        {/* User Dropdown */}
                        <div className="relative ml-2" ref={dropdownRef}>
                            <button 
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="flex items-center gap-2 focus:outline-none"
                            >
                                <div className="w-9 h-9 rounded-full bg-[#666cff]/10 flex items-center justify-center text-[#666cff] overflow-hidden">
                                    <span className="text-sm font-semibold">{user.name.charAt(0).toUpperCase()}</span>
                                </div>
                            </button>
                            
                            {/* Dropdown Menu */}
                            {dropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-[#d9dee3] py-1 z-50">
                                    <div className="px-4 py-2 border-b border-[#d9dee3]">
                                        <p className="text-sm font-semibold text-[#32475c] truncate">{user.name}</p>
                                        <p className="text-xs text-[#566a7f] capitalize">{user.role}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={toggleFullscreen}
                                        className="w-full text-left px-4 py-2 text-sm text-[#566a7f] hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                    >
                                        {isFullscreen ? (
                                            <>
                                                <Minimize className="w-4 h-4" />
                                                Keluar Layar Penuh
                                            </>
                                        ) : (
                                            <>
                                                <Maximize className="w-4 h-4" />
                                                Layar Penuh
                                            </>
                                        )}
                                    </button>
                                    <Link
                                        href={route('logout')}
                                        method="post"
                                        as="button"
                                        className="w-full text-left px-4 py-2 text-sm text-[#ff3e1d] hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Keluar
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Horizontal Menu (Desktop) */}
            <NavbarMenu />

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
                <div className="md:hidden bg-white border-b border-[#d9dee3]">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {user.role === 'admin' ? (
                            <>
                                <Link href={route('admin.dashboard')} className="block px-3 py-2 rounded-md text-base font-medium text-[#566a7f] hover:bg-gray-50">Dashboard Admin</Link>
                                <Link href={route('users')} className="block px-3 py-2 rounded-md text-base font-medium text-[#566a7f] hover:bg-gray-50">Manajemen Pengguna</Link>
                            </>
                        ) : (
                            <>
                                <Link href={route('monitoring')} className="block px-3 py-2 rounded-md text-base font-medium text-[#566a7f] hover:bg-gray-50">Monitoring</Link>
                                <Link href={route('history')} className="block px-3 py-2 rounded-md text-base font-medium text-[#566a7f] hover:bg-gray-50">Riwayat Data</Link>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 lg:p-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 mt-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-[#566a7f]">
                    <p>&copy; 2026 Indah Mesin. Hak cipta dilindungi.</p>
                    <p>Versi 1.3.0</p>
                </div>
            </footer>
        </div>
        </MobileBlock>
    );
}
