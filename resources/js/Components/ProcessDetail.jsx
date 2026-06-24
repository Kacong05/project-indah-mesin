/**
 * ProcessDetail.jsx
 * Komponen untuk menampilkan detail satu sesi proses (tabel + chart)
 */

import { useState, useRef } from 'react';
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
import { ChevronLeft, Download, TrendingUp, TrendingDown } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
    const [exporting, setExporting] = useState(false);
    const chartRef = useRef(null);

    if (!session) return null;

    const { session: sessionInfo, stats, readings } = session;

    // SV (Set Value) & PV (Present Value) - Ambil dari data terkini (data paling akhir dari backend)
    const latestData = readings && readings.length > 0 ? readings[readings.length - 1] : null;
    const currentSV = latestData?.sv || sessionInfo.latest_sv || 121.1;
    const currentPV = latestData?.temperature ?? sessionInfo.latest_temperature;

    // Handle Export Excel
    const handleExport = async () => {
        setExporting(true);

        try {
            const chartBase64 = chartRef.current ? chartRef.current.toBase64Image() : null;

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Data Sesi');

            // Header info
            worksheet.mergeCells('A1:C1');
            worksheet.getCell('A1').value = sessionInfo.name;
            worksheet.getCell('A1').font = { bold: true, size: 16 };

            worksheet.mergeCells('A2:C2');
            worksheet.getCell('A2').value = `Waktu: ${sessionInfo.time_range}`;
            worksheet.getCell('A2').font = { size: 11, color: { argb: 'FF666666' } };

            worksheet.mergeCells('A3:C3');
            worksheet.getCell('A3').value = `Durasi: ${sessionInfo.duration_minutes || '-'} menit | Total Data: ${stats?.total_readings || 0}`;
            worksheet.getCell('A3').font = { size: 11, color: { argb: 'FF666666' } };

            // Spacer
            worksheet.addRow([]);

            // Tabel header
            const headerRow = worksheet.addRow(['Waktu', 'SV (°C)', 'PV (°C)']);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4F46E5' }
                };
                cell.alignment = { horizontal: 'center' };
            });

            // Data rows
            readings.forEach((reading) => {
                const row = worksheet.addRow([
                    reading.time_formatted || reading.recorded_at?.split('T')[1]?.substring(0, 8),
                    reading.sv ? reading.sv.toFixed(1) : '-',
                    reading.temperature.toFixed(1),
                ]);

                // Color PV based on value
                const pvCell = row.getCell(3);
                if (reading.temperature >= 120) {
                    pvCell.font = { color: { argb: 'FFEF4444' } }; // Red
                } else if (reading.temperature >= 110) {
                    pvCell.font = { color: { argb: 'FFF97316' } }; // Orange
                } else {
                    pvCell.font = { color: { argb: 'FF94A3B8' } }; // Gray
                }

                // Color SV
                const svCell = row.getCell(2);
                if (reading.sv) {
                    svCell.font = { color: { argb: 'FF22C55E' } }; // Green
                }

                row.alignment = { horizontal: 'center' };
            });

            // Set column widths
            worksheet.getColumn(1).width = 15;
            worksheet.getColumn(2).width = 12;
            worksheet.getColumn(3).width = 12;

            // Add chart if available
            if (chartBase64) {
                const chartImage = workbook.addImage({
                    base64: chartBase64,
                    extension: 'png',
                });
                worksheet.addImage(chartImage, {
                    tl: { col: 4, row: 4 }, // Menempatkan grafik di kolom E (indeks 4) dan baris 5 (indeks 4)
                    ext: { width: 600, height: 300 }
                });
            }

            // Generate and download
            const buffer = await workbook.xlsx.writeBuffer();
            const filename = `Laporan_${sessionInfo.name.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`;
            saveAs(new Blob([buffer]), filename);

            // Log activity to backend
            try {
                await window.axios.post('/history/log-export');
            } catch (err) {
                console.error('Failed to log export activity:', err);
            }

        } catch (error) {
            console.error('Export error:', error);
            alert('Gagal export data');
        } finally {
            setExporting(false);
        }
    };

    // Prepare Chart Data (Urut dari lama ke baru agar mengalir ke kanan)
    const chartReadings = readings || [];
    const chartData = {
        labels: chartReadings.map(r => r.time_formatted || r.recorded_at?.split('T')[1]?.substring(0, 8) || ''),
        datasets: [
            {
                fill: true,
                label: 'PV',
                data: chartReadings.map(r => r.temperature),
                segment: {
                    borderColor: ctx => {
                        if (!chartReadings[0]) return '#eab308';
                        const start = new Date(chartReadings[0].recorded_at).getTime();
                        const current = new Date(chartReadings[ctx.p1DataIndex]?.recorded_at).getTime();
                        const minutes = (current - start) / 60000;
                        if (minutes <= 25) return '#eab308'; // yellow
                        if (minutes <= 50) return '#ef4444'; // red
                        return '#3b82f6'; // blue
                    },
                    backgroundColor: ctx => {
                        if (!chartReadings[0]) return 'rgba(234, 179, 8, 0.1)';
                        const start = new Date(chartReadings[0].recorded_at).getTime();
                        const current = new Date(chartReadings[ctx.p1DataIndex]?.recorded_at).getTime();
                        const minutes = (current - start) / 60000;
                        if (minutes <= 25) return 'rgba(234, 179, 8, 0.1)';
                        if (minutes <= 50) return 'rgba(239, 68, 68, 0.1)';
                        return 'rgba(59, 130, 246, 0.1)';
                    }
                },
                pointBackgroundColor: ctx => {
                    if (ctx.dataIndex === undefined || !chartReadings[0]) return '#eab308';
                    const start = new Date(chartReadings[0].recorded_at).getTime();
                    const current = new Date(chartReadings[ctx.dataIndex]?.recorded_at).getTime();
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
                label: `SV`,
                data: chartReadings.map(r => r.sv || currentSV),
                borderColor: '#22c55e',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5], // garis putus-putus
                pointRadius: 2,
                pointBackgroundColor: '#22c55e',
                tension: 0,
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
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-medium transition-colors"
                >
                    <Download className="w-4 h-4" />
                    {exporting ? 'Exporting...' : 'Download Excel'}
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

                    {/* SV & PV Display */}
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5">
                        <div className="text-center">
                            <p className="text-xs text-slate-400 uppercase">SV</p>
                            <p className="text-xl font-bold text-indigo-400">
                                        {currentSV.toFixed(1)}°C
                                    </p>
                        </div>
                        <div className="w-px h-12 bg-white/10" />
                        <div className="text-center">
                            <p className="text-xs text-slate-400 uppercase">PV</p>
                            <p className={`text-xl font-bold ${
                                currentPV >= 119 && currentPV <= 123
                                    ? 'text-emerald-400'
                                    : currentPV >= 116 && currentPV <= 126
                                    ? 'text-yellow-400'
                                    : 'text-red-400'
                            }`}>
                                {currentPV !== null && currentPV !== undefined
                                    ? `${currentPV.toFixed(1)}°C`
                                    : '-'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>



            {/* Chart */}
            <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Grafik PV vs SV</h3>
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
                                <th className="px-6 py-4 text-left text-sm font-bold text-slate-200 uppercase tracking-wider">Waktu</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-slate-200 uppercase tracking-wider">SV (°C)</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-slate-200 uppercase tracking-wider">PV (°C)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {readings.length > 0 ? (
                                [...readings].reverse().map((reading) => (
                                    <tr key={reading.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-base text-slate-200 whitespace-nowrap font-medium">
                                            {reading.time_formatted || reading.recorded_at?.split('T')[1]?.substring(0, 8)}
                                        </td>
                                        <td className="px-6 py-4 text-base text-emerald-400 whitespace-nowrap font-bold">
                                            {reading.sv ? reading.sv.toFixed(1) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-base whitespace-nowrap">
                                            <span className={`font-bold ${
                                                reading.temperature >= 120 ? 'text-red-400' :
                                                reading.temperature >= 110 ? 'text-orange-400' :
                                                'text-slate-200'
                                            }`}>
                                                {reading.temperature}°C
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3" className="px-6 py-8 text-center text-sm text-slate-500">
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
