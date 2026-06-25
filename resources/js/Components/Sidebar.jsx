import { Link, usePage } from '@inertiajs/react';
import {
    LayoutDashboard,
    Activity,
    History,
    Users,
    LogOut,
    ChevronRight,
} from 'lucide-react';

export default function Sidebar({ open, setOpen }) {
    const { url, props } = usePage();
    const isAdmin = props.auth?.user?.role === 'admin';

    const menuItems = isAdmin ? [
        { name: 'Manajemen Pengguna', icon: Users, href: route('users'), active: url.startsWith('/users') }
    ] : [
        { name: 'Dashboard', icon: LayoutDashboard, href: route('dashboard'), active: url.startsWith('/dashboard') },
        { name: 'Monitoring', icon: Activity, href: route('monitoring'), active: url.startsWith('/monitoring') },
        { name: 'Riwayat Data', icon: History, href: route('history'), active: url.startsWith('/history') },
    ];

    const allMenuItems = [
        { name: 'Dashboard', icon: LayoutDashboard, href: route('dashboard'), active: url.startsWith('/dashboard') },
        ...menuItems.filter(item => item.name !== 'Dashboard'),
    ];

    return (
        <>
            {/* Desktop Sidebar - Vertical Dark */}
            <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-[#16191F]">
                {/* Logo */}
                <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10">
                    <img src="/logo.png" alt="Logo" className="w-8 h-8" />
                    <h1 className="text-lg font-bold text-white tracking-wide">
                        Retort<span className="text-[#FFB800]">Monitor</span>
                    </h1>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                    {/* Section Label */}
                    <p className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Menu Utama
                    </p>

                    {allMenuItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                item.active
                                    ? 'bg-[#FFB800] text-white shadow-lg shadow-[#FFB800]/20'
                                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <item.icon className={`w-5 h-5 flex-shrink-0 ${
                                item.active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                            }`} />
                            {item.name}
                            {item.active && (
                                <ChevronRight className="w-4 h-4 ml-auto" />
                            )}
                        </Link>
                    ))}
                </nav>

                {/* Bottom Section - Logout */}
                <div className="px-3 py-4 border-t border-white/10">
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                    >
                        <LogOut className="w-5 h-5 flex-shrink-0 text-gray-500 group-hover:text-red-400" />
                        Keluar
                    </Link>
                </div>
            </aside>

            {/* Mobile Sidebar */}
            <div
                className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
                    open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60"
                    onClick={() => setOpen(false)}
                />

                {/* Sidebar Panel */}
                <div
                    className={`absolute inset-y-0 left-0 w-72 bg-[#16191F] transform transition-transform duration-300 ${
                        open ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    {/* Logo */}
                    <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10">
                        <img src="/logo.png" alt="Logo" className="w-8 h-8" />
                        <h1 className="text-lg font-bold text-white tracking-wide">
                            Retort<span className="text-[#FFB800]">Monitor</span>
                        </h1>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                        <p className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Menu Utama
                        </p>

                        {allMenuItems.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    item.active
                                        ? 'bg-[#FFB800] text-white shadow-lg shadow-[#FFB800]/20'
                                        : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                <item.icon className={`w-5 h-5 flex-shrink-0 ${
                                    item.active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                                }`} />
                                {item.name}
                            </Link>
                        ))}
                    </nav>

                    {/* Bottom Section */}
                    <div className="px-3 py-4 border-t border-white/10">
                        <Link
                            href={route('logout')}
                            method="post"
                            as="button"
                            onClick={() => setOpen(false)}
                            className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                        >
                            <LogOut className="w-5 h-5 flex-shrink-0 text-gray-500 group-hover:text-red-400" />
                            Keluar
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
