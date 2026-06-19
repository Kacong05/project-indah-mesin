import { Link, usePage } from '@inertiajs/react';
import {
    LayoutDashboard,
    Activity,
    History,
    Bell,
    Users,
    LogOut
} from 'lucide-react';

export default function Sidebar({ open, setOpen }) {
    const { url, props } = usePage();
    const isAdmin = props.auth?.user?.role === 'admin';

    const menuItems = isAdmin ? [
        { name: 'Manajemen Pengguna', icon: Users, href: route('users'), active: url.startsWith('/users') }
    ] : [
        { name: 'Dashboard', icon: LayoutDashboard, href: route('dashboard'), active: url.startsWith('/dashboard') },
        { name: 'Riwayat Data', icon: History, href: route('history'), active: url.startsWith('/history') },
        { name: 'Alarm & Notifikasi', icon: Bell, href: route('alarms'), active: url.startsWith('/alarms') },
    ];

    return (
        <aside
            className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-slate-900/80 backdrop-blur-xl border-r border-white/10 transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
            <div className="flex h-16 shrink-0 items-center justify-center border-b border-white/10 px-4">
                <h1 className="text-xl font-bold text-white tracking-wider">
                    Retort<span className="text-indigo-400">Monitor</span>
                </h1>
            </div>

            <nav className="flex flex-1 flex-col overflow-y-auto px-4 py-4 space-y-1">
                {menuItems.map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${item.active
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${item.active ? 'text-indigo-300' : 'text-slate-500 group-hover:text-white'}`} />
                        {item.name}
                    </Link>
                ))}

                <div className="mt-8 pt-8 border-t border-white/10 space-y-1">
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="w-full group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                        <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-slate-500 group-hover:text-red-400" />
                        Keluar
                    </Link>
                </div>
            </nav>
        </aside>
    );
}
