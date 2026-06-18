import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { Download, Filter, Search, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useRef } from 'react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function HistoryIndex({ readings, machines, filters }) {
    const [filterData, setFilterData] = useState({
        machine_id: filters.machine_id || '',
        start_date: filters.start_date || '',
        end_date: filters.end_date || '',
    });

    const handleFilterChange = (e) => {
        setFilterData({ ...filterData, [e.target.name]: e.target.value });
    };

    const chartRef = useRef(null);

    const applyFilters = () => {
        router.get(route('history'), filterData, {
            preserveState: true,
            replace: true,
        });
    };

    const exportExcel = async () => {
        const queryParams = new URLSearchParams(filterData).toString();
        const response = await fetch(`${route('history.export')}?${queryParams}`, {
            headers: { 'Accept': 'application/json' }
        });
        const data = await response.json();

        const chartBase64 = chartRef.current.toBase64Image();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Riwayat Data');

        const imageId = workbook.addImage({
            base64: chartBase64,
            extension: 'png',
        });
        worksheet.addImage(imageId, {
            tl: { col: 6, row: 1 },
            ext: { width: 600, height: 300 }
        });

        worksheet.columns = [
            { header: 'Timestamp', key: 'timestamp', width: 22 },
            { header: 'Nama Mesin', key: 'machine_name', width: 20 },
            { header: 'Suhu (°C)', key: 'temperature', width: 15 },
            { header: 'Status Device', key: 'status', width: 15 },
            { header: 'Status Sinkronisasi', key: 'sync_status', width: 20 },
        ];

        worksheet.getRow(1).font = { bold: true };

        data.forEach(item => worksheet.addRow(item));

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Laporan_Riwayat_${new Date().getTime()}.xlsx`);
    };

    // Prepare Chart Data
    const chartReadings = [...readings.data].reverse();
    const chartData = {
        labels: chartReadings.map(r => r.timestamp.split(' ')[1] || r.timestamp),
        datasets: [
            {
                fill: true,
                label: 'Suhu (°C)',
                data: chartReadings.map(r => r.temperature),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#6366f1',
                pointRadius: 2,
            }
        ]
    };
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { ticks: { color: '#94a3b8' } },
            x: { ticks: { color: '#94a3b8' } }
        }
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
                                onClick={exportExcel}
                                className="flex-1 flex justify-center items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
                            >
                                <FileText className="w-4 h-4" /> Export Excel
                            </button>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg">
                    {/* Report Container */}
                    <div className="p-4 bg-slate-900 rounded-xl">
                        
                        {/* Header for PDF */}
                        <div className="mb-6 hidden print-header">
                            <h2 className="text-2xl font-bold text-white mb-2">Laporan Riwayat Data Retort</h2>
                            <p className="text-slate-400">Dicetak pada: {new Date().toLocaleString()}</p>
                        </div>

                        {/* Chart Area */}
                        {readings.data.length > 0 && (
                            <div className="mb-8 overflow-hidden rounded-xl bg-white/5 border border-white/10 shadow-lg p-4">
                                <h3 className="text-sm font-medium text-slate-300 mb-4">Grafik Suhu</h3>
                                <div className="h-64 w-full">
                                    <Line ref={chartRef} data={chartData} options={chartOptions} />
                                </div>
                            </div>
                        )}

                        <div className="overflow-x-auto rounded-xl bg-white/5 border border-white/10">
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
