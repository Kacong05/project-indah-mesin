import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { TrendingUp, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
    Decimation,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import MonitoringPanel from '@/Components/MonitoringPanel';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    Decimation,
    zoomPlugin,
);

/** Safety net di browser — server sudah decimate ke ~360 titik. */
const CHART_DECIMATION_SAMPLES = 360;

export default function MonitoringIndex({ stats: initialStats, chartData: initialChartData, machineName }) {
    const [stats, setStats] = useState(initialStats);
    const [chartData, setChartData] = useState(initialChartData);
    const lastSeqRef = useRef(0);
    const lastLiveAtRef = useRef('');
    const chartRef = useRef(null);

    const handleChartZoom = useCallback((factor) => {
        chartRef.current?.zoom(factor);
    }, []);

    const handleChartResetZoom = useCallback(() => {
        chartRef.current?.resetZoom();
    }, []);

    const applyPayload = useCallback((payload) => {
        if (!payload) return;

        if (payload.seq != null && payload.seq < lastSeqRef.current) {
            return;
        }

        if (payload.stats?.liveRecordedAt && lastSeqRef.current > 0) {
            const prevAt = lastLiveAtRef.current;
            if (prevAt && payload.stats.liveRecordedAt < prevAt) {
                return;
            }
            lastLiveAtRef.current = payload.stats.liveRecordedAt;
        }

        if (payload.seq != null) {
            lastSeqRef.current = payload.seq;
        }

        if (payload.stats) {
            setStats(payload.stats);
        }

        if (payload.chartData) {
            setChartData(payload.chartData);
        }
    }, []);

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

        const pollId = setInterval(() => {
            if (!es) fetchLive();
        }, 10000);

        return () => {
            active = false;
            es?.close();
            clearInterval(pollId);
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, [applyPayload]);

    const pointCount = chartData.labels?.length ?? 0;
    const totalPoints = chartData.totalPoints ?? pointCount;
    const hasChartData = pointCount > 0;
    const showPoints = pointCount <= 80;

    const resolveColor = useCallback((index, statuses, { yellow, red, blue }) => {
        if (!statuses || index === undefined || index === null) return yellow;
        const status = (statuses[index] ?? '').toLowerCase();
        if (status === 'cooling') return blue;
        if (status === 'sterilizing' || status === 'holding') return red;
        return yellow;
    }, []);

    const lineChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            decimation: {
                enabled: pointCount > CHART_DECIMATION_SAMPLES,
                algorithm: 'lttb',
                samples: CHART_DECIMATION_SAMPLES,
            },
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
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'xy',
                    modifierKey: 'shift',
                },
                zoom: {
                    wheel: { enabled: true },
                    pinch: { enabled: true },
                    drag: {
                        enabled: true,
                        backgroundColor: 'rgba(255, 184, 0, 0.15)',
                        borderColor: 'rgba(255, 184, 0, 0.6)',
                        borderWidth: 1,
                    },
                    mode: 'xy',
                },
                limits: {
                    x: { min: 'original', max: 'original' },
                    y: { min: 'original', max: 'original' },
                },
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
                    autoSkip: true,
                    maxTicksLimit: 12,
                    maxRotation: 0,
                    minRotation: 0,
                    font: { size: 10 },
                },
            },
        },
        elements: {
            point: {
                radius: showPoints ? 2 : 0,
                hoverRadius: 4,
            },
            line: {
                borderWidth: 2,
            },
        },
    }), [pointCount, showPoints]);

    const lineChartData = useMemo(() => ({
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
                tension: 0.3,
            },
            {
                fill: false,
                label: 'SV',
                data: chartData.svData || [],
                borderColor: '#00BF40',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                pointBackgroundColor: '#00BF40',
                tension: 0,
            },
        ],
    }), [chartData, resolveColor]);

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
                    valveClosed={stats.valveClosed}
                    lastUpdate={stats.lastUpdate}
                    runState={stats.runState}
                />

                <div className="card p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-[#FFB800]" />
                                Grafik Suhu
                            </h3>
                            {hasChartData && totalPoints > pointCount && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Tampilan {pointCount} titik (decimated dari {totalPoints} sampel)
                                </p>
                            )}
                        </div>
                        {hasChartData && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleChartZoom(1.25)}
                                    className="btn btn-outline text-sm py-2 px-3"
                                    title="Zoom in"
                                    aria-label="Zoom in"
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleChartZoom(0.8)}
                                    className="btn btn-outline text-sm py-2 px-3"
                                    title="Zoom out"
                                    aria-label="Zoom out"
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleChartResetZoom}
                                    className="btn btn-outline text-sm py-2 px-3"
                                    title="Reset zoom"
                                    aria-label="Reset zoom"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                    {hasChartData && (
                        <p className="text-xs text-gray-500 mb-3">
                            Scroll mouse untuk zoom • drag area untuk zoom kotak • Shift + drag untuk geser
                        </p>
                    )}
                    <div className="h-[400px] w-full">
                        {hasChartData ? (
                            <Line ref={chartRef} data={lineChartData} options={lineChartOptions} />
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
