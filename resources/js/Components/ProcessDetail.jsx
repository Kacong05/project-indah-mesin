/**
 * ProcessDetail.jsx
 * Komponen untuk menampilkan detail satu sesi proses (tabel + chart)
 */

import { useState, useRef, useEffect } from 'react';
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
import { ChevronLeft, Download, TrendingUp, TrendingDown, Minimize2, Maximize2 } from 'lucide-react';

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

export default function ProcessDetail({ session, onBack }) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const chartRef = useRef(null);

    if (!session) return null;

    const { session: sessionInfo, stats, readings } = session;

    // Prepare Chart Data
    const chartReadings = [...readings].reverse();
    const chartData = {
        labels: chartReadings.map(r => r.time_formatted || r.recorded_at?.split('T')[1]?.substring(0, 8) || ''),
        datasets: [
            {
                fill: true,
                label: 'Suhu (°C)',
                data: chartReadings.map(r => r.temperature),
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#f97316',
                pointRadius: 2,
                tension: 0.3,
            },
            {
                fill: false,
                label: 'Tekanan',
                data: chartReadings.map(r => r.pressure),
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointBackgroundColor: '#3b82f6',
                pointRadius: 2,
                tension: 0.3,
                yAxisID: 'y1',
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: { color: '#94a3b8' }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#f1f5f9',
                bodyColor: '#cbd5e1',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Suhu (°C)',
                    color: '#f97316'
                },
                ticks: { color: '#94a3b8' },
                grid: { color: 'rgba(255,255,255,0.05)' }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'Tekanan (bar)',
                    color: '#3b82f6'
                },
                ticks: { color: '#94a3b8' },
                grid: { drawOnChartArea: false }
            },
            x: {
                ticks: { color: '#94a3b8', maxTicksLimit: 10 },
                grid: { color: 'rgba(255,255,255,0.05)' }
            }
        }
    };

    const content = (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                    <span>Kembali ke Daftar</span>
                </button>

                <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
            </div>

            {/* Session Info */}
            <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{sessionInfo.name}</h2>
                        <p className="text-slate-400 mt-1">
                            {sessionInfo.time_range} • {sessionInfo.duration_minutes || '-'} menit
                        </p>
                    </div>
                    <div className={`px-4 py-2 rounded-lg ${
                        sessionInfo.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-500/20 text-slate-400'
                    }`}>
                        {sessionInfo.status === 'active' ? 'Sedang Berlangsung' : 'Selesai'}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Rata-rata Suhu"
                    value={`${stats?.avg_temperature?.toFixed(1) || '-'}°C`}
                    icon={<TrendingUp className="w-5 h-5 text-orange-400" />}
                    color="orange"
                />
                <StatCard
                    label="Suhu Tertinggi"
                    value={`${stats?.max_temperature?.toFixed(1) || '-'}°C`}
                    icon={<TrendingUp className="w-5 h-5 text-red-400" />}
                    color="red"
                />
                <StatCard
                    label="Suhu Terendah"
                    value={`${stats?.min_temperature?.toFixed(1) || '-'}°C`}
                    icon={<TrendingDown className="w-5 h-5 text-blue-400" />}
                    color="blue"
                />
                <StatCard
                    label="Total Data"
                    value={stats?.total_readings || 0}
                    icon={<Download className="w-5 h-5 text-indigo-400" />}
                    color="indigo"
                />
            </div>

            {/* Chart */}
            <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Grafik Sensor</h3>
                <div className="h-72">
                    <Line ref={chartRef} data={chartData} options={chartOptions} />
                </div>
            </div>

            {/* Data Table */}
            <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase">Waktu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase">Mesin</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase">Suhu (°C)</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase">Tekanan</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {readings.length > 0 ? (
                                readings.map((reading) => (
                                    <tr key={reading.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-sm text-slate-300 whitespace-nowrap">
                                            {reading.time_formatted || reading.recorded_at?.split('T')[1]?.substring(0, 8)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-white whitespace-nowrap">
                                            {reading.machine?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                                            <span className={`font-medium ${
                                                reading.temperature >= 120 ? 'text-red-400' :
                                                reading.temperature >= 110 ? 'text-orange-400' :
                                                'text-slate-300'
                                            }`}>
                                                {reading.temperature}°C
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-300 whitespace-nowrap">
                                            {reading.pressure} bar
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-slate-500/20 text-slate-300">
                                                {reading.process_status || '-'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-sm text-slate-500">
                                        Tidak ada data
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-900 p-6 overflow-auto">
                {content}
            </div>
        );
    }

    return content;
}

function StatCard({ label, value, icon, color }) {
    const colorClasses = {
        orange: 'bg-orange-500/10 border-orange-500/20',
        red: 'bg-red-500/10 border-red-500/20',
        blue: 'bg-blue-500/10 border-blue-500/20',
        indigo: 'bg-indigo-500/10 border-indigo-500/20',
    };

    return (
        <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5">
                    {icon}
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase">{label}</p>
                    <p className="text-xl font-bold text-white">{value}</p>
                </div>
            </div>
        </div>
    );
}
