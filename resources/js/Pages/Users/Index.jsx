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
    const cancelDelete = () => setDeleteTarget(null);

    const handleDelete = () => {
        if (!deleteTarget) return;
        setDeleting(true);
        router.delete(route('users.destroy', deleteTarget.id), {
            onFinish: () => { setDeleting(false); setDeleteTarget(null); }
        });
    };

    const roleBadge = (role) => {
        const map = {
            admin: { label: 'Administrator', cls: 'bg-purple-100 text-purple-700' },
            operator: { label: 'Operator', cls: 'bg-green-100 text-green-700' },
            supervisor: { label: 'Supervisor', cls: 'bg-blue-100 text-blue-700' },
        };
        return map[role] ?? { label: role, cls: 'bg-gray-100 text-gray-600' };
    };

    return (
        <AuthenticatedLayout header="Manajemen Pengguna">
            <Head title="Manajemen Pengguna" />

            <div className="space-y-6">
                {/* Flash Message */}
                {flashMsg && (
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-slideDown ${
                        flashType === 'success'
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                        {flashType === 'success'
                            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            : <XCircle className="w-4 h-4 flex-shrink-0" />}
                        {flashMsg}
                    </div>
                )}

                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF7A00] to-[#FFB800] flex items-center justify-center shadow-lg shadow-[#FF7A00]/20">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Daftar Pengguna</h2>
                            <p className="text-sm text-gray-500">Kelola akses admin dan operator</p>
                        </div>
                    </div>
                    {isAdmin && (
                        <Link
                            href={route('users.create')}
                            className="btn btn-primary"
                        >
                            <UserPlus className="w-4 h-4" />
                            Tambah User
                        </Link>
                    )}
                </div>

                {/* Users Table */}
                <div className="table-container">
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Pengguna</th>
                                    <th>Kontak</th>
                                    <th>Role</th>
                                    <th>Mesin Retort</th>
                                    <th>Bergabung</th>
                                    {isAdmin && (
                                        <th className="text-right">Aksi</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {users.data.length > 0 ? (
                                    users.data.map((user) => {
                                        const badge = roleBadge(user.role);
                                        return (
                                            <tr key={user.id}>
                                                <td>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#FF7A00] to-[#FFB800] flex items-center justify-center text-white font-bold shadow-md text-sm">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-medium text-gray-800">{user.name}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                        {user.email}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.cls}`}>
                                                        {user.role === 'admin' ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="text-gray-600">
                                                    {user.machine_name || '-'}
                                                </td>
                                                <td className="text-gray-500">
                                                    {user.created_at}
                                                </td>
                                                {isAdmin && (
                                                    <td className="text-right">
                                                        <Link
                                                            href={route('users.edit', user.id)}
                                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mr-4 transition-colors"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                            Edit
                                                        </Link>
                                                        <button
                                                            onClick={() => confirmDelete(user)}
                                                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Hapus
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-gray-400">
                                            Tidak ada data pengguna.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {users.last_page > 1 && (
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                            <span>Menampilkan {users.from}–{users.to} dari {users.total} pengguna</span>
                            <div className="flex gap-1">
                                {users.links.map((link, i) => (
                                    <Link
                                        key={i}
                                        href={link.url ?? '#'}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                            link.active
                                                ? 'bg-[#FF7A00] text-white'
                                                : link.url
                                                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                                    : 'bg-gray-50 text-gray-400 cursor-default'
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
                        className="absolute inset-0 bg-black/40"
                        onClick={cancelDelete}
                    />
                    {/* Modal */}
                    <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">Hapus Pengguna</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Apakah Anda yakin ingin menghapus pengguna{' '}
                                        <span className="font-semibold text-gray-700">{deleteTarget.name}</span>?
                                        Tindakan ini tidak dapat dibatalkan.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={cancelDelete}
                                className="btn btn-secondary"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="btn btn-danger"
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
