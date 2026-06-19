import { useEffect, useState, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import {
    Thermometer,
    Zap,
    Wifi,
    Database,
    AlertTriangle,
    Clock,
    X,
    Activity,
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

const TARGET_TEMP = 121;
const TEMP_HIGH   = TARGET_TEMP + 5;
const TEMP_LOW    = TARGET_TEMP - 5;

// ─── Alarm Popup Component ───────────────────────────────────────────────────
function AlarmPopups({ alarms }) {
    const [dismissed, setDismissed] = useState([]);
    const prevIds = useRef([]);

    // Auto-show new alarms when list changes
    useEffect(() => {
        const currentIds = alarms.map(a => a.id);
        const newIds = currentIds.filter(id => !prevIds.current.includes(id));
        if (newIds.length) {
            // Remove newly appeared alarms from dismissed list so they show again
            setDismissed(d => d.filter(id => !newIds.includes(id)));
        }
        prevIds.current = currentIds;
    }, [alarms]);

    const visible = alarms.filter(a => !dismissed.includes(a.id));
    if (!visible.length) return null;

    return (
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full">
            {visible.map(alarm => (
                <div
                    key={alarm.id}
                    className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl animate-[slideIn_0.3s_ease] ${
                        alarm.severity === 'critical'
                            ? 'bg-red-900/80 border-red-500/60 text-red-100'
                            : 'bg-amber-900/80 border-amber-500/60 text-amber-100'
                    }`}
                    style={{ animation: 'slideIn 0.3s ease' }}
                >
                    <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg ${alarm.severity === 'critical' ? 'bg-red-500/30' : 'bg-amber-500/30'}`}>
                        <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight">
                            {alarm.severity === 'critical' ? '🚨 KRITIS' : '⚠️ PERINGATAN'}
                        </p>
                        <p className="text-xs mt-1 leading-snug opacity-90">{alarm.message}</p>
                        <p className="text-[10px] mt-1 opacity-60">{alarm.triggered_at}</p>
                    </div>
                    <button
                        onClick={() => setDismissed(d => [...d, alarm.id])}
                        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

// ─── Temperature Gauge Component ─────────────────────────────────────────────
function TempGauge({ temperature, isOnline }) {
    const maxTemp     = 150;
    const currentTemp = parseFloat(temperature) || 0;
    const remaining   = Math.max(0, maxTemp - currentTemp);

    let color = 'rgba(148,163,184,1)'; // slate (cold/off)
    if (!isOnline)                    color = 'rgba(148,163,184,1)'; // slate for offline
    else if (currentTemp >= TEMP_HIGH) color = 'rgba(239,68,68,1)';   // red
    else if (currentTemp >= TEMP_LOW)  color = 'rgba(34,197,94,1)';   // green
    else if (currentTemp >= 10)        color = 'rgba(245,158,11,1)';  // amber (warming)

    const gaugeData = {
        datasets: [{
            data: [currentTemp, remaining],
            backgroundColor: [color, 'rgba(255,255,255,0.05)'],
            borderColor: ['transparent', 'transparent'],
            circumference: 270,
            rotation: 225,
            cutout: '80%',
            borderRadius: 5,
        }]
    };

    return (
        <div className="flex flex-col items-center justify-center h-full py-4">
            <h3 className="text-base font-medium text-slate-300 mb-2">Suhu Saat Ini</h3>
            <div className="relative w-52 h-52 flex items-center justify-center">
                <Doughnut
                    data={gaugeData}
                    options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: { tooltip: { enabled: false } },
                        animation: { animateRotate: false, animateScale: false },
                    }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-8">
                    <span className="text-4xl font-bold text-white tracking-tighter">
                        {currentTemp.toFixed(1)}
                    </span>
                    <span className="text-base text-slate-400 font-medium">°C</span>
                </div>
            </div>
            <div className="mt-2 flex gap-4 text-[11px]">
                <span className="text-blue-400">↓ {TEMP_LOW}°C</span>
                <span className="text-slate-300 font-semibold">Target {TARGET_TEMP}°C</span>
                <span className="text-red-400">↑ {TEMP_HIGH}°C</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                <span className="text-[11px] font-medium tracking-wider uppercase">Live Active</span>
            </div>
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ stats, recentActivities, chartData, machineName, activeAlarms }) {

    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({
                only: ['stats', 'chartData', 'recentActivities', 'activeAlarms', 'notifications'],
                preserveState: true,
                preserveScroll: true,
            });
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(15,23,42,0.9)',
                titleColor: '#e2e8f0',
                bodyColor: '#e2e8f0',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
            },
        },
        scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        },
        elements: { line: { tension: 0.4 } }
    };

    const lineChartData = {
        labels: chartData.labels,
        datasets: [{
            fill: true,
            label: 'Suhu (°C)',
            data: chartData.data,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#6366f1',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#6366f1',
            pointRadius: 3,
            pointHoverRadius: 5,
        }],
    };

    return (
        <AuthenticatedLayout header={`Dashboard Utama — ${machineName}`}>
            <Head title="Dashboard" />

            {/* Alarm Popups */}
            <AlarmPopups alarms={activeAlarms ?? []} />

            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(100%); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            `}</style>

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

                    {/* Kecepatan Data */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <div className="flex items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400">
                                <Zap className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-slate-400">Kecepatan Data</h3>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <p className="text-2xl font-bold text-white">
                                        {stats.dataIntervalMs !== null ? stats.dataIntervalMs.toLocaleString() : '—'}
                                    </p>
                                    {stats.dataIntervalMs !== null && (
                                        <p className="text-sm font-medium text-slate-400">ms</p>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">Interval antar kiriman data</p>
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

                    {/* Temperature Gauge (menggantikan Statistik Alarm) */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg flex items-center justify-center">
                        <TempGauge temperature={stats.currentTemperature} isOnline={stats.isOnline} />
                    </div>
                </div>

                {/* Recent Activity Table */}
                <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg">
                    <div className="p-6 border-b border-white/10">
                        <h3 className="text-lg font-medium text-white">Aktivitas Terbaru</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Timestamp</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Aktivitas</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User/System</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Detail</th>
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
                                        <td colSpan="4" className="px-6 py-8 text-center text-sm text-slate-500">
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
