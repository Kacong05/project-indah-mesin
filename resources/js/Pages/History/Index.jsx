import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { Filter, Grid3X3, List, RefreshCw } from 'lucide-react';
import ProcessCard from '@/Components/ProcessCard';
import ProcessDetail from '@/Components/ProcessDetail';

export default function HistoryIndex({ sessions, readings, machines, filters }) {
    // State untuk UI
    const [viewMode, setViewMode] = useState('sessions'); // 'sessions' | 'detail'
    const [selectedSession, setSelectedSession] = useState(null);
    const [sessionDetail, setSessionDetail] = useState(null);
    const [loading, setLoading] = useState(false);

    // Filter state
    const [filterData, setFilterData] = useState({
        machine_id: filters.machine_id || '',
        start_date: filters.start_date || '',
        end_date: filters.end_date || '',
    });

    // Handle filter change
    const handleFilterChange = (e) => {
        setFilterData({ ...filterData, [e.target.name]: e.target.value });
    };

    // Apply filters
    const applyFilters = () => {
        router.get(route('history'), filterData, {
            preserveState: true,
            replace: true,
        });
    };

    // Load detail sesi saat diklik
    const handleSessionClick = async (session) => {
        setSelectedSession(session);
        setLoading(true);

        try {
            const response = await fetch(`/api/history/sessions/${session.id}`);
            const result = await response.json();

            if (result.success) {
                setSessionDetail(result.data);
                setViewMode('detail');
            }
        } catch (error) {
            console.error('Error loading session detail:', error);
        } finally {
            setLoading(false);
        }
    };

    // Kembali ke daftar sesi
    const handleBackToList = () => {
        setViewMode('sessions');
        setSelectedSession(null);
        setSessionDetail(null);
    };

    // Refresh data sesi
    const refreshSessions = () => {
        router.reload({ only: ['sessions'] });
    };

    return (
        <AuthenticatedLayout header="Riwayat Data">
            <Head title="Riwayat Data" />

            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    {/* View Toggle */}
                    <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5">
                        <button
                            onClick={() => setViewMode('sessions')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                viewMode === 'sessions'
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Grid3X3 className="w-4 h-4" />
                            Daftar Proses
                        </button>
                        <button
                            onClick={() => setViewMode('detail')}
                            disabled={!selectedSession}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                viewMode === 'detail'
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-400 hover:text-white disabled:opacity-50'
                            }`}
                        >
                            <List className="w-4 h-4" />
                            Tabel Data
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={refreshSessions}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Filter Area - hanya tampil di mode sessions */}
                {viewMode === 'sessions' && (
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="w-full md:w-1/4">
                                <label className="block text-sm font-medium text-slate-400 mb-1">Mesin Retort</label>
                                <select
                                    name="machine_id"
                                    value={filterData.machine_id}
                                    onChange={handleFilterChange}
                                    className="w-full rounded-lg border-white/20 bg-white/5 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                >
                                    <option value="" className="text-slate-900">Semua Mesin</option>
                                    {machines.map(m => (
                                        <option key={m.id} value={m.id} className="text-slate-900">{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full md:w-1/4">
                                <label className="block text-sm font-medium text-slate-400 mb-1">Tanggal Mulai</label>
                                <input
                                    type="date"
                                    name="start_date"
                                    value={filterData.start_date}
                                    onChange={handleFilterChange}
                                    className="w-full rounded-lg border-white/20 bg-white/5 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                />
                            </div>

                            <div className="w-full md:w-1/4">
                                <label className="block text-sm font-medium text-slate-400 mb-1">Tanggal Selesai</label>
                                <input
                                    type="date"
                                    name="end_date"
                                    value={filterData.end_date}
                                    onChange={handleFilterChange}
                                    className="w-full rounded-lg border-white/20 bg-white/5 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                />
                            </div>

                            <div className="w-full md:w-1/4 flex gap-2">
                                <button
                                    onClick={applyFilters}
                                    className="flex-1 flex justify-center items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
                                >
                                    <Filter className="w-4 h-4" /> Filter
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sessions List View */}
                {viewMode === 'sessions' && (
                    <div className="space-y-4">
                        {/* Info Banner */}
                        <div className="overflow-hidden rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-4">
                            <p className="text-sm text-indigo-300">
                                <strong>Tip:</strong> Data dikelompokkan berdasarkan sesi proses. Klik salah satu kartu untuk melihat detail data sensor pada sesi tersebut.
                                Sesi baru dibuat ketika jeda waktu antar data ≥ 10 menit.
                            </p>
                        </div>

                        {/* Sessions Grid */}
                        {sessions && sessions.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sessions.map((session) => (
                                    <ProcessCard
                                        key={session.id}
                                        session={session}
                                        isSelected={selectedSession?.id === session.id}
                                        onClick={() => handleSessionClick(session)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-slate-500">Belum ada data sesi proses.</p>
                                <p className="text-sm text-slate-600 mt-2">
                                    Data akan otomatis dikelompokkan saat sensor mulai mengirim data.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Detail View */}
                {viewMode === 'detail' && (
                    <>
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                            </div>
                        ) : (
                            <ProcessDetail
                                session={sessionDetail}
                                onBack={handleBackToList}
                            />
                        )}
                    </>
                )}

                {/* Legacy Table View - Fallback */}
                {viewMode === 'sessions' && !sessions?.length && readings?.data?.length > 0 && (
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/10">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase">Timestamp</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase">Mesin</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase">Suhu</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase">Tekanan</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {readings.data.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/5">
                                            <td className="px-6 py-4 text-sm text-slate-300">{item.timestamp}</td>
                                            <td className="px-6 py-4 text-sm text-white">{item.machine_name}</td>
                                            <td className="px-6 py-4 text-sm text-slate-300">{item.temperature}°C</td>
                                            <td className="px-6 py-4 text-sm text-slate-300">{item.pressure} bar</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-slate-500/20 text-slate-300">
                                                    {item.status || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {readings.links && (
                            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                                <div className="text-sm text-slate-400">
                                    Menampilkan {readings.from} - {readings.to} dari {readings.total} data
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
