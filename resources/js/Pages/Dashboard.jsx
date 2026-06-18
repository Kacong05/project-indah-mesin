import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    Thermometer,
    Power,
    Wifi,
    Database,
    AlertTriangle,
    Clock
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

export default function Dashboard({ stats, recentActivities, chartData, alarmStats, machineName }) {

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#e2e8f0',
                bodyColor: '#e2e8f0',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
            },
        },
        scales: {
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#94a3b8' }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#94a3b8' }
            }
        },
        elements: {
            line: { tension: 0.4 }
        }
    };

    const lineChartData = {
        labels: chartData.labels,
        datasets: [
            {
                fill: true,
                label: 'Suhu (°C)',
                data: chartData.data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#6366f1',
                pointRadius: 3,
                pointHoverRadius: 5,
            },
        ],
    };

    const doughnutChartData = {
        labels: alarmStats.labels,
        datasets: [
            {
                data: alarmStats.data,
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)', // Red
                    'rgba(245, 158, 11, 0.8)', // Amber
                    'rgba(59, 130, 246, 0.8)', // Blue
                ],
                borderColor: [
                    'rgba(239, 68, 68, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(59, 130, 246, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    return (
        <AuthenticatedLayout header={`Dashboard Utama — ${machineName}`}>
            <Head title="Dashboard" />

            <div className="space-y-6">

                {/* Stat Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Suhu */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <div className="flex items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                                <Thermometer className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-slate-400">Suhu Saat Ini</h3>
                                <div className="mt-1 flex items-baseline">
                                    <p className="text-2xl font-bold text-white">{stats.currentTemperature}</p>
                                    <p className="ml-1 text-sm font-medium text-slate-400">°C</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Mesin */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <div className="flex items-center">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stats.machineStatus === 'Running' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                <Power className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-slate-400">Status Retort</h3>
                                <p className="mt-1 text-2xl font-bold text-white">{stats.machineStatus}</p>
                            </div>
                        </div>
                    </div>

                    {/* Koneksi IoT */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <div className="flex items-center">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stats.isOnline ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                                <Wifi className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-slate-400">Koneksi IoT</h3>
                                <p className="mt-1 text-2xl font-bold text-white">{stats.isOnline ? 'Online' : 'Offline'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Total Data */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <div className="flex items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                                <Database className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-slate-400">Data Hari Ini</h3>
                                <p className="mt-1 text-2xl font-bold text-white">{stats.totalDataToday}</p>
                            </div>
                        </div>
                    </div>

                    {/* Total Alarm */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <div className="flex items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-slate-400">Alarm Hari Ini</h3>
                                <p className="mt-1 text-2xl font-bold text-white">{stats.totalAlarmsToday}</p>
                            </div>
                        </div>
                    </div>

                    {/* Last Update */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <div className="flex items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400">
                                <Clock className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-slate-400">Update Terakhir</h3>
                                <p className="mt-1 text-sm font-bold text-white">{stats.lastUpdate}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Line Chart */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg lg:col-span-2">
                        <h3 className="text-lg font-medium text-white mb-4">Grafik Suhu</h3>
                        <div className="h-72 w-full">
                            <Line data={lineChartData} options={lineChartOptions} />
                        </div>
                    </div>

                    {/* Doughnut Chart */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <h3 className="text-lg font-medium text-white mb-4">Statistik Alarm</h3>
                        <div className="h-64 w-full flex items-center justify-center">
                            <Doughnut
                                data={doughnutChartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'bottom',
                                            labels: { color: '#e2e8f0' }
                                        }
                                    },
                                    cutout: '70%',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Recent Activity Table */}
                <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                        <h3 className="text-lg font-medium text-white">Aktivitas Terbaru</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-white/5">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Timestamp</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Aktivitas</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User/System</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Detail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {recentActivities.length > 0 ? (
                                    recentActivities.map((activity) => (
                                        <tr key={activity.id} className="hover:bg-white/5 transition-colors">
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-300">{activity.created_at}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-white">{activity.description}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-300">{activity.user}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                                                {activity.properties ? JSON.stringify(activity.properties) : '-'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="whitespace-nowrap px-6 py-8 text-center text-sm text-slate-500">
                                            Belum ada aktivitas terbaru hari ini.
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
