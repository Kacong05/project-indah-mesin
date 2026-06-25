import { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { Filter, Grid3X3, List, RefreshCw, Calendar, Search, Download } from 'lucide-react';
import ProcessCard from '@/Components/ProcessCard';
import ProcessDetail from '@/Components/ProcessDetail';

export default function HistoryIndex({ sessions, readings, machines, filters }) {
    const [viewMode, setViewMode] = useState('sessions');
    const [selectedSession, setSelectedSession] = useState(null);
    const [sessionDetail, setSessionDetail] = useState(null);
    const [loading, setLoading] = useState(false);

    // Auto Refresh Logic
    useEffect(() => {
        const interval = setInterval(() => {
            if (viewMode === 'sessions') {
                router.reload({ only: ['sessions'], preserveState: true, preserveScroll: true });
            } else if (viewMode === 'detail' && selectedSession) {
                fetch(`/api/history/sessions/${selectedSession.id}`)
                    .then(res => res.json())
                    .then(result => {
                        if (result.success) {
                            setSessionDetail(result.data);
                        }
                    })
                    .catch(err => console.error('Error auto-refreshing detail:', err));
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [viewMode, selectedSession]);

    // Filter state
    const [filterData, setFilterData] = useState({
        machine_id: filters.machine_id || '',
        start_date: filters.start_date || '',
        end_date: filters.end_date || '',
    });

    const handleFilterChange = (e) => {
        setFilterData({ ...filterData, [e.target.name]: e.target.value });
    };

    const applyFilters = () => {
        router.get(route('history'), filterData, {
            preserveState: true,
            replace: true,
        });
    };

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

    const handleBackToList = () => {
        setViewMode('sessions');
        setSelectedSession(null);
        setSessionDetail(null);
    };

    const refreshSessions = () => {
        router.reload({ only: ['sessions'] });
    };

    return (
        <AuthenticatedLayout header="Riwayat Data">
            <Head title="Riwayat Data" />

            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    {/* View Toggle */}
                    <div className="flex items-center gap-2 p-1 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <button
                            onClick={() => setViewMode('sessions')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'sessions'
                                    ? 'bg-[#FF7A00] text-white shadow-md'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                            }`}
                        >
                            <Grid3X3 className="w-4 h-4" />
                            Daftar Proses
                        </button>
                        <button
                            onClick={() => setViewMode('detail')}
                            disabled={!selectedSession}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                viewMode === 'detail'
                                    ? 'bg-[#FF7A00] text-white shadow-md'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                        >
                            <List className="w-4 h-4" />
                            Tabel Data
                        </button>
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={refreshSessions}
                        className="btn btn-outline"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {/* Filter Area */}
                {viewMode === 'sessions' && (
                    <div className="card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="w-5 h-5 text-gray-400" />
                            <h3 className="text-sm font-semibold text-gray-700">Filter Data</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="label">
                                    <Calendar className="w-4 h-4 inline mr-1" />
                                    Tanggal Mulai
                                </label>
                                <input
                                    type="date"
                                    name="start_date"
                                    value={filterData.start_date}
                                    onChange={handleFilterChange}
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="label">
                                    <Calendar className="w-4 h-4 inline mr-1" />
                                    Tanggal Selesai
                                </label>
                                <input
                                    type="date"
                                    name="end_date"
                                    value={filterData.end_date}
                                    onChange={handleFilterChange}
                                    className="input"
                                />
                            </div>

                            <div className="flex items-end">
                                <button
                                    onClick={applyFilters}
                                    className="btn btn-primary w-full"
                                >
                                    <Search className="w-4 h-4" />
                                    Terapkan Filter
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sessions List View */}
                {viewMode === 'sessions' && (
                    <div className="space-y-4">
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
                            <div className="card p-12 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                    <List className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Belum Ada Data</h3>
                                <p className="text-gray-500 text-sm max-w-md mx-auto">
                                    Data sesi proses akan muncul di sini setelah sensor mulai mengirim data ke sistem.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Detail View */}
                {viewMode === 'detail' && (
                    <>
                        {loading ? (
                            <div className="card p-12 flex flex-col items-center justify-center">
                                <div className="w-10 h-10 border-4 border-gray-200 border-t-[#FF7A00] rounded-full animate-spin mb-4"></div>
                                <p className="text-gray-500">Memuat detail sesi...</p>
                            </div>
                        ) : (
                            <ProcessDetail
                                session={sessionDetail}
                                onBack={handleBackToList}
                            />
                        )}
                    </>
                )}

                {/* Legacy Table View */}
                {viewMode === 'sessions' && !sessions?.length && readings?.data?.length > 0 && (
                    <div className="table-container">
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Mesin</th>
                                        <th>Suhu</th>
                                        <th>Tekanan</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {readings.data.map((item) => (
                                        <tr key={item.id}>
                                            <td className="text-gray-600">{item.timestamp}</td>
                                            <td className="font-medium text-gray-800">{item.machine_name}</td>
                                            <td className="text-gray-600">{item.temperature}°C</td>
                                            <td className="text-gray-600">{item.pressure} bar</td>
                                            <td>
                                                <span className="badge badge-gray">
                                                    {item.status || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {readings.links && (
                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                                <div className="text-sm text-gray-500">
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
