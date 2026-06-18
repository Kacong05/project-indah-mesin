import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';

export default function GuestLayout({ children }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#1e1b4b] to-black px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Ornaments */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-0 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-40 left-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            <div className="relative z-10 w-full max-w-md space-y-8">
                <div className="text-center">
                    <Link href="/">
                        <ApplicationLogo className="mx-auto h-12 w-auto" />
                    </Link>
                    <h2 className="mt-6 text-3xl font-extrabold text-white tracking-tight">
                        Retort<span className="text-indigo-400">Monitor</span>
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Sign in to access your dashboard
                    </p>
                </div>

                <div className="mt-8 bg-white/10 backdrop-blur-xl border border-white/20 py-8 px-6 shadow-2xl sm:rounded-2xl sm:px-10">
                    {children}
                </div>
            </div>
        </div>
    );
}
