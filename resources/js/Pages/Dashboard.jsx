import { useEffect, useState, useRef, Suspense } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage } from '@inertiajs/react';
import {
    Thermometer,
    Zap,
    Wifi,
    Database,
    AlertTriangle,
    Clock,
    X,
    Activity,
    Play,
    Square,
    CircleDot,
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
import MonitoringPanel from '@/Components/MonitoringPanel';

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
        <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg flex flex-col h-full">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
                <h3 className="text-sm font-semibold text-white">Model 3D Retort</h3>
                <div className="flex items-center gap-1.5">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block', boxShadow: `0 0 6px ${statusColor}` }} />
                    <span className="text-xs text-slate-400">{statusLabel}</span>
                </div>
            </div>

            {/* Canvas area — fills remaining height */}
            <div style={{ flex: 1, position: 'relative', minHeight: 300 }}>
                <Canvas
                    style={{ width: '100%', height: '100%', display: 'block' }}
                    camera={{ position: [0, 0.2, 5.5], fov: 40, near: 0.01, far: 500 }}
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
                        target={[0, 0.5, 0]}
                        enableDamping
                        dampingFactor={0.07}
                        minDistance={1}
                        maxDistance={8}
                        enablePan={false}
                        enableZoom={false}
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
export default function Dashboard({ stats, recentActivities, chartData, machineName, machineCode, activeAlarms }) {
    const { flash } = usePage().props;
    const [cmdLoading, setCmdLoading] = useState(false);
    const [flashMsg, setFlashMsg] = useState(null);
    const [flashType, setFlashType] = useState('success');

    useEffect(() => {
        if (flash?.success || flash?.error) {
            setFlashMsg(flash.success || flash.error);
            setFlashType(flash.success ? 'success' : 'error');
            const t = setTimeout(() => setFlashMsg(null), 5000);
            return () => clearTimeout(t);
        }
    }, [flash]);

    const sendCommand = (cmd) => {
        setCmdLoading(true);
        router.post(route('dashboard.command'), { cmd }, {
            preserveScroll: true,
            onFinish: () => setCmdLoading(false),
        });
    };

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
                backgroundColor: 'rgba(15,23,42,0.9)',
                titleColor: '#f1f5f9',
                bodyColor: '#cbd5e1',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
            },
        },
        scales: {
            y: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#94a3b8' },
                title: {
                    display: true,
                    text: 'Suhu (°C)',
                    color: '#f97316',
                },
            },
            x: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    color: '#94a3b8',
                    maxTicksLimit: 100,
                    maxRotation: 90,
                    minRotation: 45,
                    callback: function(value, index) {
                        // Tampilkan label setiap data point
                        return this.getLabelForValue(value);
                    }
                }
            }
        },
    };

    // Helper: resolusi warna per segmen/titik berdasarkan menit dari data pertama
    const resolveColor = (index, recordedAts, { yellow, red, blue }) => {
        if (!recordedAts || !recordedAts[0] || index === undefined || index === null) return yellow;
        const start = new Date(recordedAts[0]).getTime();
        const current = new Date(recordedAts[index]).getTime();
        const minutes = (current - start) / 60000;
        if (minutes <= 25) return yellow;
        if (minutes <= 50) return red;
        return blue;
    };

    const lineChartData = {
        labels: chartData.labels,
        datasets: [
            {
                fill: true,
                label: 'PV',
                data: chartData.data,
                segment: {
                    borderColor: ctx => resolveColor(ctx.p1DataIndex, chartData.recordedAts, {
                        yellow: '#eab308',
                        red: '#ef4444',
                        blue: '#3b82f6',
                    }),
                    backgroundColor: ctx => resolveColor(ctx.p1DataIndex, chartData.recordedAts, {
                        yellow: 'rgba(234,179,8,0.1)',
                        red: 'rgba(239,68,68,0.1)',
                        blue: 'rgba(59,130,246,0.1)',
                    }),
                },
                pointBackgroundColor: ctx => resolveColor(ctx.dataIndex, chartData.recordedAts, {
                    yellow: '#eab308',
                    red: '#ef4444',
                    blue: '#3b82f6',
                }),
                pointRadius: 2,
                borderWidth: 2,
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

                {flashMsg && (
                    <div className={`rounded-xl border px-4 py-3 text-sm ${flashType === 'success'
                        ? 'bg-green-500/10 border-green-500/30 text-green-200'
                        : 'bg-red-500/10 border-red-500/30 text-red-200'
                        }`}>
                        {flashMsg}
                    </div>
                )}

                {/* Kontrol Perekaman — sinkron dengan ESP via MQTT */}
                <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-white">Kontrol Perekaman</h3>
                            <p className="text-sm text-slate-400 mt-1">
                                Perintah dikirim ke logger ESP32 lewat MQTT
                                {machineCode ? ` (${machineCode})` : ''}.
                                Nomor mesin di ESP Settings harus sama persis.
                                Saat offline, gunakan dashboard lokal ESP (WiFi AP).
                            </p>
                            {!stats.isOnline && (
                                <p className="text-sm text-amber-400/90 mt-2">
                                    Belum ada data sensor masuk ke server — Start tetap bisa dikirim,
                                    tetapi pastikan mqtt-bridge jalan dan kode mesin ESP cocok.
                                </p>
                            )}
                            <div className="mt-2 flex items-center gap-2 text-sm">
                                <CircleDot className={`w-4 h-4 ${stats.isLogging ? 'text-amber-400' : 'text-slate-500'}`} />
                                <span className={stats.isLogging ? 'text-amber-300 font-medium' : 'text-slate-400'}>
                                    {stats.isLogging ? 'Sedang merekam (LOGGING)' : 'Tidak merekam (IDLE)'}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => sendCommand('start')}
                                disabled={cmdLoading || stats.isLogging}
                                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <Play className="w-4 h-4" />
                                Start
                            </button>
                            <button
                                type="button"
                                onClick={() => sendCommand('stop')}
                                disabled={cmdLoading || !stats.isLogging}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <Square className="w-4 h-4" />
                                Stop
                            </button>
                        </div>
                    </div>
                </div>

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

                {/* Grafik Suhu — Full Width */}
                <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                    <h3 className="text-lg font-medium text-white mb-4">Grafik Suhu</h3>
                    <div className="h-[420px] w-full">
                        <Line data={lineChartData} options={lineChartOptions} />
                    </div>
                </div>

                {/* Monitoring Panel + Model 3D (side by side, equal height) */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5" style={{ minHeight: 500 }}>

                    {/* Monitoring Panel — 40% lebar */}
                    <div className="lg:col-span-2 h-full">
                        <MonitoringPanel
                            pv={stats.currentTemperature}
                            sv={stats.sv}
                            mv={stats.mv}
                            status={processStatus === 'running' ? 'running' : processStatus === 'error' ? 'alarm' : 'stop'}
                            processStep={stats.processStep}
                            timerTot={stats.timerTot}
                            timerStp={stats.timerStp}
                            timerRem={stats.timerRem}
                            isOnline={stats.isOnline}
                        />
                    </div>

                    {/* Model 3D — 60% lebar */}
                    <div className="lg:col-span-3 h-full">
                        <Retort3DCard temperature={currentTemp} processStatus={processStatus} />
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
