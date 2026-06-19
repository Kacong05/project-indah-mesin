import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link } from '@inertiajs/react';
import { UserCog, ArrowLeft, User, Mail, Lock, Shield, Eye, EyeOff, Cpu } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';

export default function UserEdit({ user }) {
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        name: user.name,
        email: user.email,
        role: user.role,
        machine_code: user.machine_code || '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();
        put(route('users.update', user.id));
    };

    const roles = [
        { value: 'admin', label: 'Administrator', description: 'Akses penuh ke semua fitur', color: 'purple' },
        { value: 'operator', label: 'Operator', description: 'Monitoring dan kontrol mesin', color: 'emerald' },
    ];

    return (
        <AuthenticatedLayout header="Manajemen Pengguna">
            <Head title={`Edit ${user.name}`} />

            <div className="max-w-2xl mx-auto space-y-6">

                {/* Back Button + Title */}
                <div className="flex items-center gap-4">
                    <Link
                        href={route('users')}
                        className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                            <UserCog className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Edit Pengguna</h2>
                            <p className="text-sm text-slate-400">Ubah data akun <span className="text-white font-medium">{user.name}</span></p>
                        </div>
                    </div>
                </div>

                {/* Form Card */}
                <form onSubmit={submit}>
                    <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg overflow-hidden">

                        {/* Section: Info Akun */}
                        <div className="px-6 pt-6 pb-4 border-b border-white/10">
                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Informasi Akun</h3>
                        </div>

                        <div className="p-6 space-y-5">

                            {/* Name */}
                            <div>
                                <InputLabel htmlFor="name" value="Nama Lengkap" className="text-slate-300 mb-1.5" />
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <User className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <TextInput
                                        id="name"
                                        name="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className="block w-full pl-10 bg-white/5 border-white/10 text-white placeholder-slate-500 rounded-xl focus:border-indigo-500 focus:ring-indigo-500"
                                        placeholder="Masukkan nama lengkap"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <InputError message={errors.name} className="mt-1.5" />
                            </div>

                            {/* Email */}
                            <div>
                                <InputLabel htmlFor="email" value="Alamat Email" className="text-slate-300 mb-1.5" />
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Mail className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <TextInput
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className="block w-full pl-10 bg-white/5 border-white/10 text-white placeholder-slate-500 rounded-xl focus:border-indigo-500 focus:ring-indigo-500"
                                        placeholder="contoh@email.com"
                                        required
                                    />
                                </div>
                                <InputError message={errors.email} className="mt-1.5" />
                            </div>

                            {/* Role Selection */}
                            <div>
                                <InputLabel value="Role / Hak Akses" className="text-slate-300 mb-1.5" />
                                <div className="grid grid-cols-2 gap-3">
                                    {roles.map((role) => (
                                        <button
                                            key={role.value}
                                            type="button"
                                            onClick={() => setData('role', role.value)}
                                            className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                                                data.role === role.value
                                                    ? role.value === 'admin'
                                                        ? 'bg-purple-500/15 border-purple-500/50 ring-1 ring-purple-500/30'
                                                        : role.value === 'operator'
                                                        ? 'bg-emerald-500/15 border-emerald-500/50 ring-1 ring-emerald-500/30'
                                                        : 'bg-blue-500/15 border-blue-500/50 ring-1 ring-blue-500/30'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            <Shield className={`w-4 h-4 mb-2 ${
                                                data.role === role.value
                                                    ? role.value === 'admin'
                                                        ? 'text-purple-400'
                                                        : role.value === 'operator'
                                                        ? 'text-emerald-400'
                                                        : 'text-blue-400'
                                                    : 'text-slate-500'
                                            }`} />
                                            <span className={`text-xs font-semibold ${
                                                data.role === role.value ? 'text-white' : 'text-slate-300'
                                            }`}>{role.label}</span>
                                            <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">{role.description}</span>
                                        </button>
                                    ))}
                                </div>
                                <InputError message={errors.role} className="mt-1.5" />
                            </div>

                            {/* Machine Selection */}
                            {data.role === 'operator' && (
                                <div className="pt-2 border-t border-white/5">
                                    <InputLabel htmlFor="machine_code" value="Nomer Seri Mesin" className="text-slate-300 mb-1.5" />
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <Cpu className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <TextInput
                                            id="machine_code"
                                            name="machine_code"
                                            value={data.machine_code}
                                            onChange={(e) => setData('machine_code', e.target.value.toUpperCase())}
                                            className="block w-full pl-10 bg-white/5 border-white/10 text-white placeholder-slate-500 rounded-xl focus:border-indigo-500 focus:ring-indigo-500"
                                            placeholder="Contoh: RT-001, SN-002..."
                                        />
                                    </div>
                                    <p className="mt-1.5 text-xs text-slate-400">Masukkan nomer seri yang tertera pada mesin. Mesin akan otomatis terdaftar ke sistem.</p>
                                    <InputError message={errors.machine_code} className="mt-1.5" />
                                </div>
                            )}
                        </div>

                        {/* Section: Password */}
                        <div className="px-6 pt-4 pb-4 border-t border-b border-white/10">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Ganti Kata Sandi</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Kosongkan jika tidak ingin mengganti kata sandi</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">

                            {/* Password */}
                            <div>
                                <InputLabel htmlFor="password" value="Kata Sandi Baru" className="text-slate-300 mb-1.5" />
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Lock className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <TextInput
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        className="block w-full pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder-slate-500 rounded-xl focus:border-indigo-500 focus:ring-indigo-500"
                                        placeholder="Kosongkan jika tidak diubah"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <InputError message={errors.password} className="mt-1.5" />
                            </div>

                            {/* Password Confirmation */}
                            <div>
                                <InputLabel htmlFor="password_confirmation" value="Konfirmasi Kata Sandi Baru" className="text-slate-300 mb-1.5" />
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Lock className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <TextInput
                                        id="password_confirmation"
                                        type={showPasswordConfirm ? 'text' : 'password'}
                                        name="password_confirmation"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        className="block w-full pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder-slate-500 rounded-xl focus:border-indigo-500 focus:ring-indigo-500"
                                        placeholder="Ulangi kata sandi baru"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
                                    >
                                        {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <InputError message={errors.password_confirmation} className="mt-1.5" />
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-end gap-3">
                            <Link
                                href={route('users')}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                            >
                                Batal
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 text-sm font-medium text-white hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
                            >
                                {processing ? (
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <UserCog className="w-4 h-4" />
                                )}
                                {processing ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
