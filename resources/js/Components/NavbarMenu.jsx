import { Link, usePage } from '@inertiajs/react';
import {
    LayoutDashboard,
    History,
    Users,
    Activity,
    BarChart3,
} from 'lucide-react';

export default function NavbarMenu() {
    const { url, props } = usePage();
    const isAdmin = props.auth?.user?.role === 'admin';

    const allMenuItems = isAdmin ? [
        { name: 'Dashboard Admin', icon: BarChart3, href: route('admin.dashboard'), active: url.startsWith('/admin/dashboard') },
        { name: 'Manajemen Pengguna', icon: Users, href: route('users'), active: url.startsWith('/users') },
    ] : [
        { name: 'Dashboard', icon: LayoutDashboard, href: route('dashboard'), active: url.startsWith('/dashboard') },
        { name: 'Monitoring', icon: Activity, href: route('monitoring'), active: url.startsWith('/monitoring') },
        { name: 'Riwayat Data', icon: History, href: route('history'), active: url.startsWith('/history') },
    ];

    return (
        <nav className="sticky top-16 z-30 bg-[#ffffff]/90 backdrop-blur-md border-b border-[#d9dee3]/50 shadow-sm hidden md:block">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-14 items-center gap-2 overflow-x-auto">
                    {allMenuItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                                item.active
                                    ? 'bg-[#666cff] text-white shadow-md shadow-[#666cff]/40'
                                    : 'text-[#566a7f] hover:bg-gray-100'
                            }`}
                        >
                            <item.icon className={`w-4 h-4 ${item.active ? 'text-white' : 'text-[#697a8d]'}`} />
                            {item.name}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}
