/**
 * ProcessDetail.jsx
 * Komponen untuk menampilkan detail satu sesi proses - Light Theme
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
    const [exportMode, setExportMode] = useState('both');
    const chartRef = useRef(null);

    if (!session) return null;

    const { session: sessionInfo, stats, readings } = session;

    const latestData = readings && readings.length > 0 ? readings[readings.length - 1] : null;
    const currentSV = latestData?.sv || sessionInfo.latest_sv || 121.1;
    const currentPV = latestData?.temperature ?? sessionInfo.latest_temperature;

    const handleExport = async () => {
        setExporting(true);
        const includeChart = exportMode === 'both';

        try {
            const chartBase64 = includeChart && chartRef.current
                ? chartRef.current.toBase64Image()
                : null;

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Data Sesi');

            worksheet.mergeCells('A1:C1');
            worksheet.getCell('A1').value = sessionInfo.name;
            worksheet.getCell('A1').font = { bold: true, size: 16 };

            worksheet.mergeCells('A2:C2');
            worksheet.getCell('A2').value = `Waktu: ${sessionInfo.time_range}`;
            worksheet.getCell('A2').font = { size: 11, color: { argb: 'FF666666' } };

            worksheet.mergeCells('A3:C3');
            worksheet.getCell('A3').value = `Durasi: ${sessionInfo.duration_minutes || '-'} menit | Total Data: ${stats?.total_readings || 0}`;
            worksheet.getCell('A3').font = { size: 11, color: { argb: 'FF666666' } };

            worksheet.addRow([]);

            const headerRow = worksheet.addRow(['Waktu', 'SV (°C)', 'PV (°C)']);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFF7A00' }
                };
                cell.alignment = { horizontal: 'center' };
            });

            readings.forEach((reading) => {
                const row = worksheet.addRow([
                    reading.time_formatted || reading.recorded_at?.split('T')[1]?.substring(0, 8),
                    reading.sv ? reading.sv.toFixed(1) : '-',
                    reading.temperature.toFixed(1),
                ]);

                const pvCell = row.getCell(3);
                if (reading.temperature >= 120) {
                    pvCell.font = { color: { argb: 'FFEF4444' } };
                } else if (reading.temperature >= 110) {
                    pvCell.font = { color: { argb: 'FFF97316' } };
                } else {
                    pvCell.font = { color: { argb: 'FF666666' } };
                }

                const svCell = row.getCell(2);
                if (reading.sv) {
                    svCell.font = { color: { argb: 'FFFF7A00' } };
                }

                row.alignment = { horizontal: 'center' };
            });

            worksheet.getColumn(1).width = 15;
            worksheet.getColumn(2).width = 12;
            worksheet.getColumn(3).width = 12;

            if (chartBase64) {
                const chartImage = workbook.addImage({
                    base64: chartBase64,
                    extension: 'png',
                });
                worksheet.addImage(chartImage, {
                    tl: { col: 4, row: 4 },
                    ext: { width: 600, height: 300 }
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const suffix = includeChart ? 'Data_Grafik' : 'Data';
            const filename = `Laporan_${suffix}_${sessionInfo.name.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`;
            saveAs(new Blob([buffer]), filename);

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

    const chartReadings = readings || [];
    const pointCount = chartReadings.length;
    const chartMinWidth = Math.max(pointCount * 28, 600);

    const formatChartTime = (reading) =>
        reading.time_formatted
        || (reading.recorded_at
            ? new Date(reading.recorded_at).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            })
            : '');

    const chartData = {
        labels: chartReadings.map(formatChartTime),
        datasets: [
            {
                fill: true,
                label: 'PV',
                data: chartReadings.map(r => r.temperature),
                segment: {
                    borderColor: ctx => {
                        if (!chartReadings[0]) return '#FFB800';
                        const start = new Date(chartReadings[0].recorded_at).getTime();
                        const current = new Date(chartReadings[ctx.p1DataIndex]?.recorded_at).getTime();
                        const minutes = (current - start) / 60000;
                        if (minutes <= 25) return '#FFB800';
                        if (minutes <= 50) return '#FF3B30';
                        return '#007BFF';
                    },
                    backgroundColor: ctx => {
                        if (!chartReadings[0]) return 'rgba(255,184,0,0.1)';
                        const start = new Date(chartReadings[0].recorded_at).getTime();
                        const current = new Date(chartReadings[ctx.p1DataIndex]?.recorded_at).getTime();
                        const minutes = (current - start) / 60000;
                        if (minutes <= 25) return 'rgba(255,184,0,0.1)';
                        if (minutes <= 50) return 'rgba(255,59,48,0.1)';
                        return 'rgba(0,123,255,0.1)';
                    }
                },
                pointBackgroundColor: ctx => {
                    if (ctx.dataIndex === undefined || !chartReadings[0]) return '#FFB800';
                    const start = new Date(chartReadings[0].recorded_at).getTime();
                    const current = new Date(chartReadings[ctx.dataIndex]?.recorded_at).getTime();
                    const minutes = (current - start) / 60000;
                    if (minutes <= 25) return '#FFB800';
                    if (minutes <= 50) return '#FF3B30';
                    return '#007BFF';
                },
                borderWidth: 2,
                pointRadius: 3,
                tension: 0.3,
            },
            {
                fill: false,
                label: `SV`,
                data: chartReadings.map(r => r.sv || currentSV),
                borderColor: '#00BF40',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 2,
                pointBackgroundColor: '#00BF40',
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
                labels: { color: '#666', usePointStyle: true, padding: 20 }
            },
            tooltip: {
                backgroundColor: 'rgba(255,255,255,0.95)',
                titleColor: '#1A1A1A',
                bodyColor: '#666',
                borderColor: '#e0e0e0',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
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
                    color: '#FF7A00'
                },
                ticks: { color: '#999' },
                grid: { color: '#f0f0f0' }
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
        }
    };

    const content = (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="font-medium">Kembali ke Daftar</span>
                </button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                        value={exportMode}
                        onChange={(e) => setExportMode(e.target.value)}
                        disabled={exporting}
                        className="input text-sm py-2 min-w-[180px]"
                    >
                        <option value="data">Data saja</option>
                        <option value="both">Data + Grafik</option>
                    </select>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="btn btn-success"
                    >
                        <Download className="w-4 h-4" />
                        {exporting ? 'Exporting...' : 'Download Excel'}
                    </button>
                </div>
            </div>

            {/* Session Info */}
            <div className="card p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">{sessionInfo.name}</h2>
                        <p className="text-gray-500 mt-1">
                            {sessionInfo.time_range} • {sessionInfo.duration_minutes || '-'} menit
                        </p>
                    </div>

                    {/* SV & PV Display */}
                    <div className="flex items-center gap-6 p-4 rounded-xl bg-orange-50 border border-orange-100">
                        <div className="text-center">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">SV</p>
                            <p className="text-2xl font-bold text-[#FF7A00]">
                                {currentSV.toFixed(1)}°C
                            </p>
                        </div>
                        <div className="w-px h-12 bg-orange-200" />
                        <div className="text-center">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">PV</p>
                            <p className={`text-2xl font-bold ${
                                currentPV >= 119 && currentPV <= 123
                                    ? 'text-green-600'
                                    : currentPV >= 116 && currentPV <= 126
                                        ? 'text-amber-600'
                                        : 'text-red-600'
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
            <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#FF7A00]" />
                    Grafik PV vs SV
                </h3>
                <div className="h-72 w-full overflow-x-auto">
                    <div style={{ minWidth: chartMinWidth, height: '100%' }}>
                        <Line ref={chartRef} data={chartData} options={chartOptions} />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Waktu</th>
                            <th>SV (°C)</th>
                            <th>PV (°C)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {readings.length > 0 ? (
                            [...readings].reverse().map((reading) => (
                                <tr key={reading.id}>
                                    <td className="font-medium text-gray-800 whitespace-nowrap">
                                        {reading.time_formatted || reading.recorded_at?.split('T')[1]?.substring(0, 8)}
                                    </td>
                                    <td className="font-bold text-[#FF7A00] whitespace-nowrap">
                                        {reading.sv ? reading.sv.toFixed(1) : '-'}
                                    </td>
                                    <td className="whitespace-nowrap">
                                        <span className={`font-bold ${
                                            reading.temperature >= 120 ? 'text-red-600' :
                                                reading.temperature >= 110 ? 'text-orange-500' :
                                                    'text-gray-700'
                                        }`}>
                                            {reading.temperature}°C
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="3" className="text-center py-8 text-gray-400">
                                    Tidak ada data
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return content;
}
