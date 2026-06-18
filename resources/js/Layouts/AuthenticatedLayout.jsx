import { useState } from 'react';
import { usePage } from '@inertiajs/react';
import Sidebar from '@/Components/Sidebar';
import NotificationPanel from '@/Components/NotificationPanel';
import { Menu } from 'lucide-react';

export default function AuthenticatedLayout({ header, children }) {
    const user = usePage().props.auth.user;
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#1e1b4b] to-black overflow-hidden relative">
            {/* Background Ornaments */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob pointer-events-none"></div>
            <div className="absolute top-0 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000 pointer-events-none"></div>

            <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/50 md:hidden" 
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div className="flex flex-1 flex-col overflow-hidden relative z-10">
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/50 backdrop-blur-md px-4 sm:px-6 lg:px-8 relative z-50">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="text-slate-400 hover:text-white md:hidden focus:outline-none"
                    >
                        <Menu className="h-6 w-6" />
                    </button>

                    <div className="flex flex-1 justify-between items-center md:justify-end">
                        <div className="hidden md:flex md:items-center md:gap-x-4">
                            <h1 className="text-xl font-semibold text-white tracking-tight">{header}</h1>
                        </div>
                        
                        <div className="flex items-center gap-x-3 ml-auto">
                            {/* Notification Bell */}
                            <NotificationPanel />

                            {/* User Avatar + Name */}
                            <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center">
                                <span className="text-sm font-medium text-indigo-300">
                                    {user.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="hidden md:block">
                                <p className="text-sm font-medium text-white">{user.name}</p>
                                <p className="text-xs text-slate-400">{user.role === 'admin' ? 'Administrator' : user.role === 'supervisor' ? 'Supervisor' : 'Operator'}</p>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
