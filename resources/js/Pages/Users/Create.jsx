import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link } from '@inertiajs/react';
import { UserPlus, ArrowLeft, User, Mail, Lock, Shield, Eye, EyeOff, Cpu } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';

export default function UserCreate() {
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        role: 'operator',
        machine_code: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('users.store'));
    };

    const roles = [
        { value: 'admin', label: 'Administrator', description: 'Akses penuh ke semua fitur', color: 'purple' },
        { value: 'operator', label: 'Operator', description: 'Monitoring dan kontrol mesin', color: 'green' },
    ];

    return (
        <AuthenticatedLayout header="Manajemen Pengguna">
            <Head title="Tambah Pengguna" />

            <div className="max-w-2xl mx-auto space-y-6">
                {/* Back Button + Title */}
                <div className="flex items-center gap-4">
                    <Link
                        href={route('users')}
                        className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF7A00] to-[#FFB800] flex items-center justify-center shadow-lg shadow-[#FF7A00]/20">
                            <UserPlus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Tambah Pengguna Baru</h2>
                            <p className="text-sm text-gray-500">Buat akun baru untuk pengguna produk</p>
                        </div>
                    </div>
                </div>

                {/* Form Card */}
                <form onSubmit={submit}>
                    <div className="card overflow-hidden">
                        {/* Section: Info Akun */}
                        <div className="px-6 pt-5 pb-3 border-b border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Informasi Akun</h3>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Name */}
                            <div>
                                <InputLabel htmlFor="name" value="Nama Lengkap" />
                                <div className="relative mt-1">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <User className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <TextInput
                                        id="name"
                                        name="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className="input pl-10"
                                        placeholder="Masukkan nama lengkap"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <InputError message={errors.name} className="mt-1" />
                            </div>

                            {/* Email */}
                            <div>
                                <InputLabel htmlFor="email" value="Alamat Email" />
                                <div className="relative mt-1">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <TextInput
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className="input pl-10"
                                        placeholder="contoh@email.com"
                                        required
                                    />
                                </div>
                                <InputError message={errors.email} className="mt-1" />
                            </div>

                            {/* Role Selection */}
                            <div>
                                <InputLabel value="Role / Hak Akses" />
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                    {roles.map((role) => (
                                        <button
                                            key={role.value}
                                            type="button"
                                            onClick={() => setData('role', role.value)}
                                            className={`relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${
                                                data.role === role.value
                                                    ? role.value === 'admin'
                                                        ? 'border-purple-500 bg-purple-50'
                                                        : 'border-green-500 bg-green-50'
                                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                            }`}
                                        >
                                            <Shield className={`w-5 h-5 mb-2 ${
                                                data.role === role.value
                                                    ? role.value === 'admin' ? 'text-purple-500' : 'text-green-500'
                                                    : 'text-gray-400'
                                            }`} />
                                            <span className={`text-sm font-semibold ${
                                                data.role === role.value ? 'text-gray-800' : 'text-gray-600'
                                            }`}>{role.label}</span>
                                            <span className="text-xs text-gray-500 mt-0.5 leading-tight">{role.description}</span>
                                        </button>
                                    ))}
                                </div>
                                <InputError message={errors.role} className="mt-1" />
                            </div>

                            {/* Machine Selection */}
                            {data.role === 'operator' && (
                                <div className="pt-2 border-t border-gray-100">
                                    <InputLabel htmlFor="machine_code" value="Nomor Seri Mesin" />
                                    <div className="relative mt-1">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                            <Cpu className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <TextInput
                                            id="machine_code"
                                            name="machine_code"
                                            value={data.machine_code}
                                            onChange={(e) => setData('machine_code', e.target.value.toUpperCase())}
                                            className="input pl-10"
                                            placeholder="Contoh: RT-001, SN-002..."
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">Masukkan nomor seri yang tertera pada mesin.</p>
                                    <InputError message={errors.machine_code} className="mt-1" />
                                </div>
                            )}
                        </div>

                        {/* Section: Password */}
                        <div className="px-6 py-3 border-t border-b border-gray-100 bg-gray-50">
                            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Kata Sandi</h3>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Password */}
                            <div>
                                <InputLabel htmlFor="password" value="Kata Sandi" />
                                <div className="relative mt-1">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <TextInput
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        className="input pl-10 pr-10"
                                        placeholder="Minimal 8 karakter"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                                <InputError message={errors.password} className="mt-1" />
                            </div>

                            {/* Password Confirmation */}
                            <div>
                                <InputLabel htmlFor="password_confirmation" value="Konfirmasi Kata Sandi" />
                                <div className="relative mt-1">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <TextInput
                                        id="password_confirmation"
                                        type={showPasswordConfirm ? 'text' : 'password'}
                                        name="password_confirmation"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        className="input pl-10 pr-10"
                                        placeholder="Ulangi kata sandi"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                                <InputError message={errors.password_confirmation} className="mt-1" />
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                            <Link
                                href={route('users')}
                                className="btn btn-secondary"
                            >
                                Batal
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="btn btn-primary"
                            >
                                {processing ? (
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <UserPlus className="w-4 h-4" />
                                )}
                                {processing ? 'Menyimpan...' : 'Tambah Pengguna'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
