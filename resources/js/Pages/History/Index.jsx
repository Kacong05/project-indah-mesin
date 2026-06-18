import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { Download, Filter, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function HistoryIndex({ readings, machines, filters }) {
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

    const exportCsv = () => {
        const queryParams = new URLSearchParams(filterData).toString();
        window.location.href = `${route('history.export')}?${queryParams}`;
    };

    return (
        <AuthenticatedLayout header="Riwayat Data">
            <Head title="Riwayat Data" />

            <div className="space-y-6">
                
                {/* Filter Area */}
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
                            <button
                                onClick={exportCsv}
                                className="flex-1 flex justify-center items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
                            >
                                <Download className="w-4 h-4" /> CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-white/5">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Timestamp</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Nama Mesin</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Suhu (°C)</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status Device</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status Sinkronisasi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {readings.data.length > 0 ? (
                                    readings.data.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-300">{item.timestamp}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">{item.machine_name}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-300">
                                                <span className={`px-2 py-1 rounded-md text-xs font-medium ${item.temperature >= 120 ? 'bg-red-500/20 text-red-400' : (item.temperature >= 110 ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400')}`}>
                                                    {item.temperature}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === 'Normal' ? 'bg-green-500/20 text-green-400' : (item.status === 'Warning' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400')}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-emerald-400 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                {item.sync_status}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="whitespace-nowrap px-6 py-8 text-center text-sm text-slate-500">
                                            Tidak ada data ditemukan untuk filter ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination */}
                    {readings.data.length > 0 && (
                        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                            <div className="text-sm text-slate-400">
                                Menampilkan <span className="font-medium text-white">{readings.from}</span> - <span className="font-medium text-white">{readings.to}</span> dari <span className="font-medium text-white">{readings.total}</span> data
                            </div>
                            <div className="flex gap-2">
                                {readings.links.map((link, k) => {
                                    const isPrevious = link.label.includes('Previous');
                                    const isNext = link.label.includes('Next');
                                    
                                    if (isPrevious || isNext) {
                                        return (
                                            <button
                                                key={k}
                                                onClick={() => link.url && router.get(link.url)}
                                                disabled={!link.url}
                                                className={`p-2 rounded-lg border border-white/10 flex items-center justify-center transition-colors ${!link.url ? 'opacity-50 cursor-not-allowed text-slate-500' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                                            >
                                                {isPrevious ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                            </button>
                                        );
                                    }
                                    
                                    return (
                                        <button
                                            key={k}
                                            onClick={() => link.url && router.get(link.url)}
                                            className={`w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-medium transition-colors ${link.active ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </AuthenticatedLayout>
    );
}
