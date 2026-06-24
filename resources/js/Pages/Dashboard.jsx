import { useEffect, useState, useRef, Suspense } from 'react';
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
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei';
import RetortModel from '@/Components/RetortModel';

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

const TARGET_TEMP = 121;
const TEMP_HIGH = TARGET_TEMP + 5;
const TEMP_LOW = TARGET_TEMP - 5;

// ─── Alarm Popup Component ───────────────────────────────────────────────────
function AlarmPopups({ alarms }) {
    const [dismissed, setDismissed] = useState([]);
    const prevIds = useRef([]);

    useEffect(() => {
        const currentIds = alarms.map(a => a.id);
        const newIds = currentIds.filter(id => !prevIds.current.includes(id));
        if (newIds.length) {
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
                    className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${alarm.severity === 'critical'
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

// ─── 3D Canvas loading fallback (rendered inside Canvas via drei Html) ─────────
function ModelLoader() {
    return (
        <Html center>
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                color: '#94a3b8', fontSize: 11, fontFamily: 'sans-serif',
                background: 'rgba(15,23,42,0.9)', padding: '12px 18px',
                borderRadius: 8, border: '1px solid #1e293b', whiteSpace: 'nowrap',
            }}>
                <div style={{
                    width: 22, height: 22,
                    border: '2px solid #1e293b',
                    borderTop: '2px solid #22d3ee',
                    borderRadius: '50%',
                    animation: 'r3f-spin 0.9s linear infinite',
                }} />
                <style>{`@keyframes r3f-spin{to{transform:rotate(360deg)}}`}</style>
                Memuat model 3D…
            </div>
        </Html>
    );
}

// ─── Retort 3D Viewer Card (embedded in dashboard) ───────────────────────────
function Retort3DCard({ temperature, processStatus }) {
    const tempLabel =
        temperature > 121 ? 'Kritis' :
            temperature > 115 ? 'Panas Tinggi' :
                temperature >= 100 ? 'Suhu Proses' : 'Ambient';

    const statusColor =
        processStatus === 'running' ? '#22c55e' :
            processStatus === 'error' ? '#ef4444' : '#eab308';

    const statusLabel =
        processStatus === 'running' ? 'Running' :
            processStatus === 'error' ? 'Error' : 'Standby';

    return (
        <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg flex flex-col" style={{ minHeight: 340 }}>
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Model 3D Retort</h3>
                <div className="flex items-center gap-1.5">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block', boxShadow: `0 0 6px ${statusColor}` }} />
                    <span className="text-xs text-slate-400">{statusLabel}</span>
                </div>
            </div>

            {/* Canvas area — MUST have explicit width+height */}
            <div style={{ flex: 1, position: 'relative', minHeight: 280 }}>
                <Canvas
                    style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', inset: 0 }}
                    camera={{ position: [0, 0.5, 3], fov: 50, near: 0.01, far: 500 }}
                    gl={{ antialias: true }}
                    shadows
                >
                    <ambientLight intensity={0.6} />
                    <directionalLight castShadow position={[4, 6, 4]} intensity={2} />
                    <pointLight position={[-2, 2, -2]} intensity={0.7} color="#4488ff" />
                    <pointLight position={[2, -1, 2]} intensity={0.4} color="#ff8844" />

                    <Environment preset="warehouse" />

                    <Grid
                        receiveShadow
                        position={[0, -0.8, 0]}
                        args={[6, 6]}
                        cellSize={0.2}
                        cellThickness={0.4}
                        cellColor="#1e293b"
                        sectionSize={1}
                        sectionThickness={0.8}
                        sectionColor="#334155"
                        fadeDistance={5}
                        fadeStrength={1}
                        infiniteGrid
                    />

                    <Suspense fallback={<ModelLoader />}>
                        <RetortModel temperature={temperature} processStatus={processStatus} />
                    </Suspense>

                    <OrbitControls
                        target={[0, 0, 0]}
                        enableDamping
                        dampingFactor={0.07}
                        minDistance={1}
                        maxDistance={8}
                        enablePan={false}
                        autoRotate={processStatus !== 'running'}
                        autoRotateSpeed={0.5}
                    />
                </Canvas>

                {/* Temp overlay badge — bottom-left of canvas */}
                <div style={{
                    position: 'absolute', bottom: 10, left: 10, zIndex: 10,
                    background: 'rgba(15,23,42,0.85)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '4px 10px',
                    display: 'flex', alignItems: 'baseline', gap: 4,
                    backdropFilter: 'blur(8px)',
                }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                        {typeof temperature === 'number' ? temperature.toFixed(1) : '—'}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>°C</span>
                    <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>{tempLabel}</span>
                </div>
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
            legend: {
                display: true,
                labels: { color: '#e2e8f0' }
            },
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
        datasets: [
            {
                fill: true,
                label: 'PV (°C)',
                data: chartData.data,
                segment: {
                    borderColor: ctx => {
                        if (!chartData.recordedAts || !chartData.recordedAts[0]) return '#eab308';
                        const start = new Date(chartData.recordedAts[0]).getTime();
                        const current = new Date(chartData.recordedAts[ctx.p1DataIndex]).getTime();
                        const minutes = (current - start) / 60000;
                        if (minutes <= 25) return '#eab308'; // yellow
                        if (minutes <= 50) return '#ef4444'; // red
                        return '#3b82f6'; // blue
                    },
                    backgroundColor: ctx => {
                        if (!chartData.recordedAts || !chartData.recordedAts[0]) return 'rgba(234,179,8,0.1)';
                        const start = new Date(chartData.recordedAts[0]).getTime();
                        const current = new Date(chartData.recordedAts[ctx.p1DataIndex]).getTime();
                        const minutes = (current - start) / 60000;
                        if (minutes <= 25) return 'rgba(234,179,8,0.1)';
                        if (minutes <= 50) return 'rgba(239,68,68,0.1)';
                        return 'rgba(59,130,246,0.1)';
                    }
                },
                pointBackgroundColor: ctx => {
                    if (ctx.dataIndex === undefined || !chartData.recordedAts || !chartData.recordedAts[0]) return '#eab308';
                    const start = new Date(chartData.recordedAts[0]).getTime();
                    const current = new Date(chartData.recordedAts[ctx.dataIndex]).getTime();
                    const minutes = (current - start) / 60000;
                    if (minutes <= 25) return '#eab308';
                    if (minutes <= 50) return '#ef4444';
                    return '#3b82f6';
                },
                borderWidth: 2,
                pointRadius: 2,
                tension: 0.3,
            },
            {
                fill: false,
                label: 'SV',
                data: chartData.svData || [],
                borderColor: '#22c55e',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 2,
                pointBackgroundColor: '#22c55e',
                tension: 0,
            }
        ],
    };

    // Derive processStatus from stats
    const currentTemp = parseFloat(stats.currentTemperature) || 0;
    const processStatus = !stats.isOnline ? 'standby'
        : currentTemp > TEMP_HIGH ? 'error'
            : currentTemp >= 10 ? 'running'
                : 'standby';

    return (
        <AuthenticatedLayout header={`Dashboard Utama — ${machineName}`}>
            <Head title="Dashboard" />

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

                {/* Charts + 3D Model Row */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                    {/* Line Chart */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg lg:col-span-2">
                        <h3 className="text-lg font-medium text-white mb-4">Grafik Suhu</h3>
                        <div className="h-72 w-full">
                            <Line data={lineChartData} options={lineChartOptions} />
                        </div>
                    </div>

                    {/* 3D Retort Model Card */}
                    <Retort3DCard temperature={currentTemp} processStatus={processStatus} />
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
                                                {activity.properties
                                                    ? Object.entries(activity.properties)
                                                        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                                                        .join(', ')
                                                    : '-'}
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
