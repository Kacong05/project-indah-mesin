import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    Users,
    Activity,
    CheckCircle,
    XCircle,
    Clock,
    BarChart3,
    CalendarDays,
    CalendarClock,
    Cpu,
} from 'lucide-react';

// ─── Summary Stat Card ───────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, color, iconBg }) {
    return (
        <div className="card p-5 flex items-center gap-4 hover-lift">
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${iconBg}`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
            </div>
        </div>
    );
}

// ─── Status Badge ────────────────────────────────────────────────────
function StatusBadge({ count, label, colorClass }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            {count} {label}
        </span>
    );
}

// ─── Progress Bar ────────────────────────────────────────────────────
function MiniBar({ value, max, colorClass }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
            <div
                className={`h-1.5 rounded-full transition-all ${colorClass}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function AdminDashboard({ userBatchStats, summary }) {
    const maxBatches = userBatchStats.reduce((max, u) => Math.max(max, u.total_batches), 0);

    return (
        <AuthenticatedLayout header="Dashboard Admin — Statistik Proses">
            <Head title="Dashboard Admin" />

            <div className="space-y-6">

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard
                        icon={Users}
                        label="Total Operator"
                        value={summary.total_operators}
                        color="text-indigo-500"
                        iconBg="bg-indigo-100"
                    />
                    <SummaryCard
                        icon={BarChart3}
                        label="Total Proses"
                        value={summary.total_batches}
                        color="text-blue-500"
                        iconBg="bg-blue-100"
                    />
                    <SummaryCard
                        icon={CalendarDays}
                        label="Proses Hari Ini"
                        value={summary.batches_today}
                        color="text-yellow-500"
                        iconBg="bg-yellow-100"
                    />
                    <SummaryCard
                        icon={CalendarClock}
                        label="Proses Bulan Ini"
                        value={summary.batches_this_month}
                        color="text-teal-500"
                        iconBg="bg-teal-100"
                    />
                </div>

                {/* Status Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="card p-5 flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-100">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Selesai</p>
                            <p className="text-2xl font-bold text-gray-900">{summary.completed_batches}</p>
                        </div>
                    </div>
                    <div className="card p-5 flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-100">
                            <Clock className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Sedang Berjalan</p>
                            <p className="text-2xl font-bold text-gray-900">{summary.in_progress_batches}</p>
                        </div>
                    </div>
                    <div className="card p-5 flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-100">
                            <XCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Gagal</p>
                            <p className="text-2xl font-bold text-gray-900">{summary.failed_batches}</p>
                        </div>
                    </div>
                </div>

                {/* Per-User Table */}
                <div className="table-container">
                    <div className="card-header">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-[#FFB800]" />
                            Jumlah Proses per Operator
                        </h3>
                        <span className="text-sm text-gray-400">{userBatchStats.length} operator</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Operator</th>
                                    <th>Mesin</th>
                                    <th>Hari Ini</th>
                                    <th>Bulan Ini</th>
                                    <th>Total Proses</th>
                                    <th>Status Batch</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userBatchStats.length > 0 ? (
                                    userBatchStats.map((user) => (
                                        <tr key={user.id}>
                                            {/* Operator */}
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FFC933] flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800">{user.name}</p>
                                                        <p className="text-xs text-gray-400">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Mesin */}
                                            <td>
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <Cpu className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-sm font-medium">{user.machine_name}</p>
                                                        <p className="text-xs text-gray-400">{user.machine_code}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Hari ini */}
                                            <td>
                                                <span className="text-lg font-bold text-gray-800">{user.batches_today}</span>
                                            </td>

                                            {/* Bulan ini */}
                                            <td>
                                                <span className="text-lg font-bold text-gray-800">{user.batches_this_month}</span>
                                            </td>

                                            {/* Total + mini bar */}
                                            <td>
                                                <span className="text-lg font-bold text-indigo-600">{user.total_batches}</span>
                                                <MiniBar
                                                    value={user.total_batches}
                                                    max={maxBatches}
                                                    colorClass="bg-indigo-400"
                                                />
                                            </td>

                                            {/* Status badges */}
                                            <td>
                                                <div className="flex flex-wrap gap-1">
                                                    {user.completed_batches > 0 && (
                                                        <StatusBadge
                                                            count={user.completed_batches}
                                                            label="Selesai"
                                                            colorClass="bg-green-100 text-green-700"
                                                        />
                                                    )}
                                                    {user.in_progress_batches > 0 && (
                                                        <StatusBadge
                                                            count={user.in_progress_batches}
                                                            label="Berjalan"
                                                            colorClass="bg-yellow-100 text-yellow-700"
                                                        />
                                                    )}
                                                    {user.failed_batches > 0 && (
                                                        <StatusBadge
                                                            count={user.failed_batches}
                                                            label="Gagal"
                                                            colorClass="bg-red-100 text-red-700"
                                                        />
                                                    )}
                                                    {user.total_batches === 0 && (
                                                        <span className="text-xs text-gray-400">Belum ada proses</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center py-12 text-gray-400">
                                            Belum ada data operator.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </AuthenticatedLayout>
    );
}
