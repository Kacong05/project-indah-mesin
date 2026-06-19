import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, Bell, Filter, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function AlarmIndex({ alarms, filters }) {
    const [statusFilter, setStatusFilter] = useState(filters.status || '');

    const handleFilterChange = (e) => {
        const newStatus = e.target.value;
        setStatusFilter(newStatus);
        
        router.get(route('alarms'), { status: newStatus }, {
            preserveState: true,
            replace: true,
        });
    };

    return (
        <AuthenticatedLayout header="Alarm & Notifikasi">
            <Head title="Alarm" />

            <div className="space-y-6">
                
                {/* Header/Filter Area */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-red-500/20 text-red-400">
                            <Bell className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Log Alarm</h2>
                            <p className="text-sm text-slate-400">Riwayat kejadian abnormal pada mesin</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={handleFilterChange}
                            className="rounded-lg border-white/20 bg-slate-800 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                            <option value="">Semua Status</option>
                            <option value="active">Active</option>
                            <option value="acknowledged">Acknowledged</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>
                </div>

                {/* Alarm Table */}
                <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-white/5">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Waktu</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Mesin</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Tipe & Pesan</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {alarms.data.length > 0 ? (
                                    alarms.data.map((alarm) => (
                                        <tr key={alarm.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-300">
                                                {alarm.triggered_at}
                                                {alarm.resolved_at !== '-' && (
                                                    <div className="text-xs text-slate-500 mt-1">Selesai: {alarm.resolved_at}</div>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">{alarm.machine_name}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {alarm.severity === 'critical' ? (
                                                        <AlertTriangle className="w-4 h-4 text-red-500" />
                                                    ) : (
                                                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                                                    )}
                                                    <span className={`font-semibold ${alarm.severity === 'critical' ? 'text-red-400' : 'text-orange-400'}`}>
                                                        {alarm.type}
                                                    </span>
                                                </div>
                                                <span className="text-slate-300">{alarm.message}</span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    alarm.status === 'active' ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 
                                                    (alarm.status === 'acknowledged' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')
                                                }`}>
                                                    {alarm.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-right">
                                                {alarm.status !== 'acknowledged' && (
                                                    <button 
                                                        onClick={() => router.post(route('alarms.acknowledge', alarm.id), {}, { preserveScroll: true })}
                                                        className="inline-flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-1 text-xs font-semibold text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors border border-indigo-500/30">
                                                        <CheckCircle2 className="w-3 h-3" /> Tandai Dibaca
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="whitespace-nowrap px-6 py-12 text-center">
                                            <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                            <p className="text-sm text-slate-400">Tidak ada alarm yang sesuai dengan kriteria.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination */}
                    {alarms.data.length > 0 && (
                        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                            <div className="text-sm text-slate-400">
                                Menampilkan <span className="font-medium text-white">{alarms.from}</span> - <span className="font-medium text-white">{alarms.to}</span> dari <span className="font-medium text-white">{alarms.total}</span> alarm
                            </div>
                            <div className="flex gap-2">
                                {alarms.links.map((link, k) => {
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
