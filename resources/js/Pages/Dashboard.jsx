import { useEffect, useState, Suspense } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage } from '@inertiajs/react';
import {
    Thermometer,
    Zap,
    Wifi,
    Database,
    Clock,
    ActivitySquare,
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei';
import RetortModel from '@/Components/RetortModel';

const TARGET_TEMP = 121;
const TEMP_HIGH = TARGET_TEMP + 5;
const TEMP_LOW = TARGET_TEMP - 5;

// ─── 3D Canvas loading fallback ─────────────────────────────────────
function ModelLoader() {
    return (
        <Html center>
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                color: '#666', fontSize: 11, fontFamily: 'sans-serif',
                background: 'rgba(255,255,255,0.95)', padding: '12px 18px',
                borderRadius: 8, border: '1px solid #e0e0e0', whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
                <div style={{
                    width: 22, height: 22,
                    border: '2px solid #e0e0e0',
                    borderTop: '2px solid #FFB800',
                    borderRadius: '50%',
                    animation: 'r3f-spin 0.9s linear infinite',
                }} />
                <style>{`@keyframes r3f-spin{to{transform:rotate(360deg)}}`}</style>
                Memuat model 3D…
            </div>
        </Html>
    );
}

// ─── Stat Card Component ────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, unit, color, bgColor, iconBgColor }) {
    return (
        <div className="card p-5 flex items-center gap-4 hover-lift">
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${iconBgColor}`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
                <p className="text-sm text-gray-500">{label}</p>
                <div className="flex items-baseline gap-1 mt-1">
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    {unit && <p className="text-sm font-medium text-gray-400">{unit}</p>}
                </div>
            </div>
        </div>
    );
}

// ─── Retort 3D Viewer Card ──────────────────────────────────────────
function Retort3DCard({ temperature, processStatus }) {
    const tempLabel =
        temperature > 121 ? 'Kritis' :
            temperature > 115 ? 'Panas Tinggi' :
                temperature >= 100 ? 'Suhu Proses' : 'Ambient';

    const statusColor =
        processStatus === 'running' ? '#00BF40' :
            processStatus === 'error' ? '#FF3B30' : '#FFB800';

    const statusLabel =
        processStatus === 'running' ? 'Running' :
            processStatus === 'error' ? 'Error' : 'Standby';

    return (
        <div className="card overflow-hidden flex flex-col h-full">
            {/* Card header */}
            <div className="card-header">
                <h3 className="text-sm font-semibold text-gray-700">Model 3D Retort</h3>
                <div className="flex items-center gap-2">
                    <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: statusColor,
                        display: 'inline-block',
                        boxShadow: `0 0 6px ${statusColor}`
                    }} />
                    <span className="text-xs text-gray-500">{statusLabel}</span>
                </div>
            </div>

            {/* Canvas area */}
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
                        cellColor="#e0e0e0"
                        sectionSize={1}
                        sectionThickness={0.8}
                        sectionColor="#bdbdbd"
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

                {/* Temp overlay badge */}
                <div style={{
                    position: 'absolute', bottom: 10, left: 10, zIndex: 10,
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid #e0e0e0',
                    borderRadius: 8, padding: '6px 12px',
                    display: 'flex', alignItems: 'baseline', gap: 4,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
                        {typeof temperature === 'number' ? temperature.toFixed(1) : '—'}
                    </span>
                    <span style={{ fontSize: 11, color: '#666' }}>°C</span>
                    <span style={{ fontSize: 10, color: '#999', marginLeft: 4 }}>{tempLabel}</span>
                </div>
            </div>
        </div>
    );
}

// ─── Main Dashboard ─────────────────────────────────────────────────
export default function Dashboard({ stats, recentActivities, machineName, machineCode }) {
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
                only: ['stats', 'recentActivities'],
                preserveState: true,
                preserveScroll: true,
            });
        }, 2000);
        return () => clearInterval(interval);
    }, []);
    const currentTemp = parseFloat(stats.currentTemperature) || 0;
    const processStatus = !stats.isOnline ? 'standby'
        : currentTemp > TEMP_HIGH ? 'error'
            : currentTemp >= 10 ? 'running'
                : 'standby';

    return (
        <AuthenticatedLayout header={`Dashboard Utama — ${machineName}`}>
            <Head title="Dashboard" />

            <div className="space-y-6">

                {/* Flash Messages */}
                {flashMsg && (
                    <div className={`rounded-xl border px-4 py-3 text-sm animate-slideDown ${
                        flashType === 'success'
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                        {flashMsg}
                    </div>
                )}



                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <StatCard
                        icon={Thermometer}
                        label="Suhu Saat Ini"
                        value={stats.currentTemperature}
                        unit="°C"
                        color="text-yellow-500"
                        iconBgColor="bg-yellow-100"
                    />
                    <StatCard
                        icon={Zap}
                        label="Kecepatan Data"
                        value={stats.dataIntervalMs !== null ? stats.dataIntervalMs.toLocaleString() : '—'}
                        unit={stats.dataIntervalMs !== null ? 'ms' : ''}
                        color="text-purple-500"
                        iconBgColor="bg-purple-100"
                    />
                    <StatCard
                        icon={Wifi}
                        label="Koneksi IoT"
                        value={stats.isOnline ? 'Online' : 'Offline'}
                        color={stats.isOnline ? 'text-green-500' : 'text-red-500'}
                        iconBgColor={stats.isOnline ? 'bg-green-100' : 'bg-red-100'}
                    />
                    <StatCard
                        icon={Database}
                        label="Data Hari Ini"
                        value={stats.totalDataToday}
                        color="text-blue-500"
                        iconBgColor="bg-blue-100"
                    />
                    <StatCard
                        icon={Clock}
                        label="Update Terakhir"
                        value={stats.lastUpdate}
                        color="text-teal-500"
                        iconBgColor="bg-teal-100"
                    />
                </div>

                {/* Recent Activity Table */}
                <div className="table-container">
                    <div className="card-header">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <ActivitySquare className="w-5 h-5 text-[#FFB800]" />
                            Aktivitas Terbaru
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Aktivitas</th>
                                    <th>User/System</th>
                                    <th>Detail</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentActivities.length > 0 ? (
                                    recentActivities.map((activity) => (
                                        <tr key={activity.id}>
                                            <td className="text-gray-600">{activity.created_at}</td>
                                            <td className="font-medium text-gray-800">{activity.description}</td>
                                            <td className="text-gray-600">{activity.user}</td>
                                            <td className="text-gray-500">
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
                                        <td colSpan="4" className="text-center py-8 text-gray-400">
                                            Belum ada aktivitas terbaru hari ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Model 3D */}
                <div style={{ minHeight: 420 }}>
                    <Retort3DCard temperature={currentTemp} processStatus={processStatus} />
                </div>

            </div>
        </AuthenticatedLayout>
    );
}
