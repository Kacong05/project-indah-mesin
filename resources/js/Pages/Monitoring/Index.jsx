import { useEffect, useRef, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { TrendingUp, ChevronsRight } from 'lucide-react';
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
    Filler,
} from 'chart.js';
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

export default function MonitoringIndex({ stats, chartData, machineName }) {
    const chartScrollRef = useRef(null);
    const lastProcessKeyRef = useRef(null);
    const userScrollingRef = useRef(false);   // user sedang lihat data lama
    const [showJumpBtn, setShowJumpBtn] = useState(false);

    // ── Auto-refresh data setiap 2 detik ────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({
                only: ['stats', 'chartData'],
                preserveState: true,
                preserveScroll: true,
            });
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // ── Reset scroll ke kiri saat sesi proses baru dimulai ──────────
    useEffect(() => {
        const processKey = chartData.processStartedAt
            ?? chartData.processSessionId
            ?? chartData.labels?.[0]
            ?? null;

        if (
            lastProcessKeyRef.current !== null
            && processKey !== null
            && processKey !== lastProcessKeyRef.current
        ) {
            userScrollingRef.current = false;
            chartScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
        }

        lastProcessKeyRef.current = processKey;
    }, [chartData.processStartedAt, chartData.processSessionId, chartData.labels]);

    // ── Auto-scroll ke kanan saat data baru, kecuali user sedang scroll ──
    useEffect(() => {
        const el = chartScrollRef.current;
        if (!el || userScrollingRef.current) return;
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }, [chartData.labels?.length]);

    // ── Deteksi apakah user sedang scroll ke data lama ──────────────
    useEffect(() => {
        const el = chartScrollRef.current;
        if (!el) return;

        const handleScroll = () => {
            // Threshold 80px: dianggap "di ujung kanan" jika sisa < 80px
            const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 80;
            userScrollingRef.current = !atEnd;
            setShowJumpBtn(!atEnd);
        };

        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToLatest = () => {
        const el = chartScrollRef.current;
        if (!el) return;
        userScrollingRef.current = false;
        setShowJumpBtn(false);
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    };

    const pointCount = chartData.labels?.length ?? 0;
    const chartMinWidth = Math.max(pointCount * 28, 600);

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
                labels: { color: '#666', usePointStyle: true, padding: 20 },
            },
            tooltip: {
                backgroundColor: 'rgba(255,255,255,0.95)',
                titleColor: '#1A1A1A',
                bodyColor: '#666',
                borderColor: '#e0e0e0',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
            },
        },
        scales: {
            y: {
                grid: { color: '#f0f0f0' },
                ticks: { color: '#999' },
                title: {
                    display: true,
                    text: 'Suhu (°C)',
                    color: '#FFB800',
                },
            },
            x: {
                grid: { color: '#f0f0f0' },
                ticks: {
                    color: '#999',
                    autoSkip: false,
                    maxRotation: 45,
                    minRotation: 35,
                    font: { size: 9 },
                },
            },
        },
    };

    // Warna mengikuti fase proses: heating → kuning, sterilisasi → merah, cooling → biru
    const resolveColor = (index, statuses, { yellow, red, blue }) => {
        if (!statuses || index === undefined || index === null) return yellow;
        const status = (statuses[index] ?? '').toLowerCase();
        if (status === 'cooling') return blue;
        if (status === 'sterilizing' || status === 'holding') return red;
        return yellow;
    };

    const lineChartData = {
        labels: chartData.labels,
        datasets: [
            {
                fill: true,
                label: 'PV',
                data: chartData.data,
                segment: {
                    borderColor: ctx => resolveColor(ctx.p1DataIndex, chartData.statuses, {
                        yellow: '#FFB800',
                        red: '#FF3B30',
                        blue: '#007BFF',
                    }),
                    backgroundColor: ctx => resolveColor(ctx.p1DataIndex, chartData.statuses, {
                        yellow: 'rgba(255,184,0,0.1)',
                        red: 'rgba(255,59,48,0.1)',
                        blue: 'rgba(0,123,255,0.1)',
                    }),
                },
                pointBackgroundColor: ctx => resolveColor(ctx.dataIndex, chartData.statuses, {
                    yellow: '#FFB800',
                    red: '#FF3B30',
                    blue: '#007BFF',
                }),
                pointRadius: 3,
                borderWidth: 2,
                tension: 0.3,
            },
            {
                fill: false,
                label: 'SV',
                data: chartData.svData || [],
                borderColor: '#00BF40',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 2,
                pointBackgroundColor: '#00BF40',
                tension: 0,
            },
        ],
    };

    const currentTemp = parseFloat(stats.currentTemperature) || 0;
    const processStatus = !stats.isOnline ? 'standby'
        : currentTemp > TEMP_HIGH ? 'error'
            : currentTemp >= 10 ? 'running'
                : 'standby';

    return (
        <AuthenticatedLayout header={`Monitoring — ${machineName}`}>
            <Head title="Monitoring" />

            <div className="space-y-6">
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

                <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-[#FFB800]" />
                            Grafik Suhu
                        </h3>
                        {/* Tombol lompat ke data terbaru */}
                        {showJumpBtn && (
                            <button
                                onClick={scrollToLatest}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#FFB800] text-white hover:bg-[#FFC933] transition-colors shadow-sm animate-slideDown"
                            >
                                <ChevronsRight className="w-4 h-4" />
                                Data Terbaru
                            </button>
                        )}
                    </div>
                    <div className="h-[400px] w-full overflow-x-auto" ref={chartScrollRef}>
                        <div style={{ minWidth: chartMinWidth, height: '100%' }}>
                            <Line data={lineChartData} options={lineChartOptions} />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
