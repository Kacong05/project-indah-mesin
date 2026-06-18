import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Users, UserPlus, Mail, Shield, Pencil, Trash2, CheckCircle, XCircle, AlertTriangle, User } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function UserIndex({ users }) {
    const { auth, flash } = usePage().props;
    const isAdmin = auth.user.role === 'admin';

    // Flash message auto-dismiss
    const [flashMsg, setFlashMsg] = useState(flash?.success || flash?.error || null);
    const [flashType, setFlashType] = useState(flash?.success ? 'success' : 'error');

    useEffect(() => {
        if (flash?.success || flash?.error) {
            setFlashMsg(flash.success || flash.error);
            setFlashType(flash.success ? 'success' : 'error');
            const timer = setTimeout(() => setFlashMsg(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [flash]);

    // Delete confirmation modal state
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const confirmDelete = (user) => setDeleteTarget(user);
    const cancelDelete  = () => setDeleteTarget(null);

    const handleDelete = () => {
        if (!deleteTarget) return;
        setDeleting(true);
        router.delete(route('users.destroy', deleteTarget.id), {
            onFinish: () => { setDeleting(false); setDeleteTarget(null); }
        });
    };

    const roleBadge = (role) => {
        const map = {
            admin:      { label: 'Administrator', cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
            operator:   { label: 'Operator',      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
            supervisor: { label: 'Supervisor',    cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        };
        return map[role] ?? { label: role, cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    };

    return (
        <AuthenticatedLayout header="Manajemen Pengguna">
            <Head title="Manajemen Pengguna" />

            <div className="space-y-6">

                {/* Flash Message */}
                {flashMsg && (
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                        flashType === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                        {flashType === 'success'
                            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            : <XCircle className="w-4 h-4 flex-shrink-0" />}
                        {flashMsg}
                    </div>
                )}

                {/* Header Actions */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Daftar Pengguna</h2>
                            <p className="text-sm text-slate-400">Kelola akses admin dan operator</p>
                        </div>
                    </div>
                    {isAdmin && (
                        <Link
                            href={route('users.create')}
                            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            <UserPlus className="w-4 h-4" /> Tambah User
                        </Link>
                    )}
                </div>

                {/* Users Table */}
                <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-white/5">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Pengguna</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Kontak</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Mesin Retort</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Bergabung</th>
                                    {isAdmin && (
                                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Aksi</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {users.data.length > 0 ? (
                                    users.data.map((user) => {
                                        const badge = roleBadge(user.role);
                                        return (
                                            <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg text-sm">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-white">{user.name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <div className="flex items-center text-sm text-slate-300">
                                                        <Mail className="w-4 h-4 mr-2 text-slate-500 flex-shrink-0" />
                                                        {user.email}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badge.cls}`}>
                                                        {user.role === 'admin' ? <Shield className="w-3.5 h-3.5 mr-1" /> : <User className="w-3.5 h-3.5 mr-1" />}
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm text-slate-300">
                                                        {user.machine_name}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                                    {user.created_at}
                                                </td>
                                                {isAdmin && (
                                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-medium">
                                                        <Link
                                                            href={route('users.edit', user.id)}
                                                            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 mr-4 transition-colors"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                                        </Link>
                                                        <button
                                                            onClick={() => confirmDelete(user)}
                                                            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={isAdmin ? 5 : 4} className="whitespace-nowrap px-6 py-12 text-center text-slate-500">
                                            Tidak ada data pengguna.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {users.last_page > 1 && (
                        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between text-sm text-slate-400">
                            <span>Menampilkan {users.from}–{users.to} dari {users.total} pengguna</span>
                            <div className="flex gap-1">
                                {users.links.map((link, i) => (
                                    <Link
                                        key={i}
                                        href={link.url ?? '#'}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                            link.active
                                                ? 'bg-indigo-600 text-white'
                                                : link.url
                                                ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                                                : 'bg-white/[0.02] text-slate-600 cursor-default'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={cancelDelete}
                    />
                    {/* Modal */}
                    <div className="relative z-10 w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-white">Hapus Pengguna</h3>
                                    <p className="mt-1 text-sm text-slate-400">
                                        Apakah Anda yakin ingin menghapus pengguna{' '}
                                        <span className="font-semibold text-white">{deleteTarget.name}</span>?
                                        Tindakan ini tidak dapat dibatalkan.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-white/[0.03] border-t border-white/10 flex justify-end gap-3">
                            <button
                                onClick={cancelDelete}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 text-sm font-medium text-white hover:bg-red-500 focus:outline-none transition-all disabled:opacity-60 shadow-lg shadow-red-500/20"
                            >
                                {deleting ? (
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
