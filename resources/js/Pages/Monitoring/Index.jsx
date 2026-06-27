import { useEffect, useRef, useState, useCallback } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
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

export default function MonitoringIndex({ stats: initialStats, chartData: initialChartData, machineName }) {
    const [stats, setStats] = useState(initialStats);
    const [chartData, setChartData] = useState(initialChartData);
    const lastSeqRef = useRef(0);

    const chartScrollRef = useRef(null);
    const lastProcessKeyRef = useRef(null);
    const userScrollingRef = useRef(false);
    const [showJumpBtn, setShowJumpBtn] = useState(false);

    const applyPayload = useCallback((payload) => {
        if (!payload) return;
        if (payload.seq) lastSeqRef.current = payload.seq;
        if (payload.stats) setStats(payload.stats);
        if (payload.chartData) setChartData(payload.chartData);
    }, []);

    // Push real-time via SSE — data tampil segera setelah ESP mengirim ke server.
    useEffect(() => {
        let active = true;
        let es = null;
        let reconnectTimer = null;

        const fetchLive = async () => {
            try {
                const res = await fetch('/monitoring/live', {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    cache: 'no-store',
                    credentials: 'same-origin',
                });
                if (!res.ok || !active) return;
                const json = await res.json();
                if (json.success) applyPayload(json.data);
            } catch {
                // Abaikan — akan reconnect SSE
            }
        };

        const connect = () => {
            if (!active) return;

            es = new EventSource(`/monitoring/stream?since=${lastSeqRef.current}`);

            es.onmessage = (event) => {
                try {
                    applyPayload(JSON.parse(event.data));
                } catch {
                    // Abaikan payload tidak valid
                }
            };

            es.onerror = () => {
                es?.close();
                es = null;
                if (!active) return;
                fetchLive();
                reconnectTimer = setTimeout(connect, 200);
            };
        };

        connect();

        // Fallback polling — jika SSE/nginx macet, UI tetap update tiap 2 dtk.
        const pollId = setInterval(fetchLive, 2000);

        return () => {
            active = false;
            es?.close();
            clearInterval(pollId);
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, [applyPayload]);

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

    useEffect(() => {
        const el = chartScrollRef.current;
        if (!el || userScrollingRef.current) return;
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }, [chartData.labels?.length]);

    useEffect(() => {
        const el = chartScrollRef.current;
        if (!el) return;

        const handleScroll = () => {
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
    const hasChartData = pointCount > 0;

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

    // Warna fase: CUT (heating) → kuning, Sterilization → merah, Cooling → biru
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

    return (
        <AuthenticatedLayout header={`Monitoring — ${machineName}`}>
            <Head title="Monitoring" />

            <div className="space-y-6">
                <MonitoringPanel
                    pv={stats.currentTemperature}
                    sv={stats.sv}
                    mv={stats.mv}
                    processStep={stats.processStep}
                    processStepCode={stats.processStepCode}
                    processPhase={stats.processPhase}
                    timerTot={stats.timerTot}
                    timerStp={stats.timerStp}
                    isOnline={stats.isOnline}
                    displayMode={stats.displayMode}
                    lastUpdate={stats.lastUpdate}
                    runState={stats.runState}
                />

                <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-[#FFB800]" />
                            Grafik Suhu
                        </h3>
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
                        {hasChartData ? (
                            <div style={{ minWidth: chartMinWidth, height: '100%' }}>
                                <Line data={lineChartData} options={lineChartOptions} />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                                {stats.displayMode === 'idle'
                                    ? 'Siap proses berikutnya'
                                    : 'Belum ada data grafik — pastikan ESP terhubung MQTT'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
