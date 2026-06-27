/**
 * ProcessDetail.jsx
 * Komponen untuk menampilkan detail satu sesi proses - Light Theme
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
import zoomPlugin from 'chartjs-plugin-zoom';
import { ChevronLeft, Download, TrendingUp, ArrowUp, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
    Filler,
    zoomPlugin,
);

const PIXELS_PER_POINT = 28;
const EXPORT_CHART_HEIGHT = 400;
const CHART_HEIGHT_CLASS = 'h-[32rem]';
const TABLE_PAGE_SIZE = 50;
const TABLE_PAGE_SIZE_OPTIONS = [25, 50, 100];

function formatChartTime(reading) {
    if (reading.time_formatted) {
        return reading.time_formatted.replace(/\.\d+$/, '');
    }

    if (!reading.recorded_at) {
        return '';
    }

    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(new Date(reading.recorded_at));
}

// Warna mengikuti fase proses: heating → orange, sterilisasi → merah, cooling → biru
function resolvePhaseColor(reading, { yellow, red, blue }) {
    const status = (reading?.process_status ?? '').toLowerCase();
    if (status === 'cooling') return blue;
    if (status === 'sterilizing' || status === 'holding') return red;
    return yellow;
}

function buildChartData(chartReadings, currentSV) {
    return {
        labels: chartReadings.map(formatChartTime),
        datasets: [
            {
                fill: true,
                label: 'PV',
                data: chartReadings.map(r => r.temperature),
                segment: {
                    borderColor: ctx => resolvePhaseColor(chartReadings[ctx.p1DataIndex], {
                        yellow: '#FFB800',
                        red: '#FF3B30',
                        blue: '#007BFF',
                    }),
                    backgroundColor: ctx => resolvePhaseColor(chartReadings[ctx.p1DataIndex], {
                        yellow: 'rgba(255,184,0,0.1)',
                        red: 'rgba(255,59,48,0.1)',
                        blue: 'rgba(0,123,255,0.1)',
                    }),
                },
                pointBackgroundColor: ctx => resolvePhaseColor(chartReadings[ctx.dataIndex], {
                    yellow: '#FFB800',
                    red: '#FF3B30',
                    blue: '#007BFF',
                }),
                borderWidth: 2,
                pointRadius: 3,
                tension: 0.3,
            },
            {
                fill: false,
                label: 'SV',
                data: chartReadings.map(r => r.sv || currentSV),
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
}

function buildChartOptions(forExport = false) {
    return {
        responsive: !forExport,
        maintainAspectRatio: false,
        animation: forExport ? false : undefined,
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
            ...(!forExport && {
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
            }),
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Suhu (°C)',
                    color: '#FFB800',
                },
                ticks: { color: '#999' },
                grid: { color: '#f0f0f0' },
            },
            x: {
                title: {
                    display: true,
                    text: 'Waktu (H:M:S)',
                    color: '#666',
                },
                grid: { color: '#f0f0f0' },
                ticks: {
                    color: '#999',
                    autoSkip: forExport ? true : false,
                    maxTicksLimit: forExport ? 30 : undefined,
                    maxRotation: forExport ? 90 : 45,
                    minRotation: forExport ? 90 : 35,
                    font: { size: forExport ? 7 : 9 },
                },
            },
        },
    };
}

async function renderFullWidthChartImage(chartReadings, currentSV) {
    const pointCount = chartReadings.length;
    // Batasi lebar maksimal agar tidak terlalu besar — pakai pixel per point lebih kecil untuk data banyak
    const pxPerPoint = pointCount > 300 ? 8 : pointCount > 100 ? 14 : PIXELS_PER_POINT;
    const logicalWidth = Math.min(Math.max(pointCount * pxPerPoint, 600), 2400);
    const logicalHeight = EXPORT_CHART_HEIGHT;

    // Render 3x resolusi untuk ketajaman maksimal
    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
    canvas.style.position = 'fixed';
    canvas.style.left = '-9999px';
    canvas.style.top = '0';
    document.body.appendChild(canvas);

    // Isi background putih dulu
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    const chart = new ChartJS(canvas, {
        type: 'line',
        data: buildChartData(chartReadings, currentSV),
        options: {
            ...buildChartOptions(true),
            responsive: false,
            animation: false,
            elements: {
                point: {
                    // Kurangi titik untuk data banyak agar tidak penuh
                    radius: pointCount > 200 ? 0 : 3,
                },
            },
        },
    });

    chart.resize(logicalWidth, logicalHeight);
    chart.update('none');

    await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    const base64 = canvas.toDataURL('image/png', 1.0);
    chart.destroy();
    document.body.removeChild(canvas);

    return { base64, width: logicalWidth, height: logicalHeight };
}

// Format tanggal/jam mengikuti report Indah Mesin (zona Asia/Jakarta).
// Format: M/D/YYYY  h:mm:ssAM/PM — spasi ganda antara tanggal & jam
function fmtTanggalJam(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    const s = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    }).format(d);
    // Ganti koma+spasi antara tanggal dan waktu dengan dua spasi agar lebih mudah dibaca
    return s.replace(', ', '  ').replace(' PM', 'PM').replace(' AM', 'AM');
}

// Rentang judul: YYYY-MM-DD HH:mm:ss (24 jam)
function fmtFull(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(d).replace(', ', ' ');
}

// Angka 1 desimal, buang ".0" agar 97.0 → "97" (sesuai tampilan report)
function fmtNum(v) {
    if (v === null || v === undefined || v === '') return '-';
    const n = Number(v);
    if (isNaN(n)) return '-';
    return Number(n.toFixed(1)).toString();
}

export default function ProcessDetail({ session, onBack }) {
    const [exporting, setExporting] = useState(false);
    const [exportMode, setExportMode] = useState('both');
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [tablePage, setTablePage] = useState(1);
    const [tablePageSize, setTablePageSize] = useState(TABLE_PAGE_SIZE);
    const chartRef = useRef(null);

    const handleChartZoom = useCallback((factor) => {
        chartRef.current?.zoom(factor);
    }, []);

    const handleChartResetZoom = useCallback(() => {
        chartRef.current?.resetZoom();
    }, []);

    // Deteksi scroll untuk tampilkan tombol ke atas
    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 300);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Reset halaman tabel & zoom grafik saat sesi berubah
    useEffect(() => {
        setTablePage(1);
        handleChartResetZoom();
    }, [session?.session?.id, handleChartResetZoom]);

    if (!session) return null;

    const { session: sessionInfo, stats, readings } = session;

    const latestData = readings && readings.length > 0 ? readings[readings.length - 1] : null;
    const currentSV = latestData?.sv || sessionInfo.latest_sv || 121.1;
    const chartReadings = readings || [];
    const chartMinWidth = Math.max(chartReadings.length * PIXELS_PER_POINT, 600);
    const chartData = buildChartData(chartReadings, currentSV);
    const chartOptions = buildChartOptions(false);

    const tableReadings = [...chartReadings].sort(
        (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at),
    );
    const totalTableRows = tableReadings.length;
    const totalTablePages = Math.max(1, Math.ceil(totalTableRows / tablePageSize));
    const safeTablePage = Math.min(tablePage, totalTablePages);
    const tableStartIndex = (safeTablePage - 1) * tablePageSize;
    const paginatedReadings = tableReadings.slice(tableStartIndex, tableStartIndex + tablePageSize);
    const tableRangeStart = totalTableRows === 0 ? 0 : tableStartIndex + 1;
    const tableRangeEnd = Math.min(tableStartIndex + tablePageSize, totalTableRows);

    const handleTablePageSizeChange = (e) => {
        setTablePageSize(Number(e.target.value));
        setTablePage(1);
    };

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    const handleExport = async () => {
        setExporting(true);
        const includeChart = exportMode === 'both';

        try {
            let chartBase64 = null;
            let chartWidth = 600;
            let chartHeight = EXPORT_CHART_HEIGHT;

            if (includeChart && chartReadings.length > 0) {
                const exportChart = await renderFullWidthChartImage(chartReadings, currentSV);
                chartBase64 = exportChart.base64;
                chartWidth = exportChart.width;
                chartHeight = exportChart.height;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Logger Data');

            // ── Load logo dari public folder ──────────────────────────
            let logoImageId = null;
            try {
                const logoResp = await fetch('/logo.png');
                const logoBlob = await logoResp.blob();
                const logoBase64 = await new Promise((res) => {
                    const reader = new FileReader();
                    reader.onloadend = () => res(reader.result.split(',')[1]);
                    reader.readAsDataURL(logoBlob);
                });
                logoImageId = workbook.addImage({ base64: logoBase64, extension: 'png' });
            } catch (_) { /* logo gagal load, lanjut tanpa logo */ }

            // ── Kop perusahaan ────────────────────────────────────────
            // Logo di kolom A baris 1-3, teks di kolom B-J
            worksheet.mergeCells('B1:J1');
            worksheet.getCell('B1').value = 'INDAHMESIN.COM';
            worksheet.getCell('B1').font = { bold: true, size: 16 };

            worksheet.mergeCells('B2:J2');
            worksheet.getCell('B2').value = 'INDAH JAYA TEKNIK, CV';
            worksheet.getCell('B2').font = { bold: true, size: 11 };

            worksheet.mergeCells('B3:J3');
            worksheet.getCell('B3').value = 'Jalan Raya Randugading No.137 RT 12 RW 03 Kel. Randugading Kec. Tajinan, Kabupaten Malang, Jawa Timur 65172';
            worksheet.getCell('B3').font = { size: 9, color: { argb: 'FF666666' } };
            worksheet.getCell('B3').alignment = { wrapText: false };

            // Set tinggi baris kop agar logo muat
            worksheet.getRow(1).height = 30;
            worksheet.getRow(2).height = 18;
            worksheet.getRow(3).height = 30;

            // Embed logo jika berhasil di-load
            if (logoImageId !== null) {
                worksheet.addImage(logoImageId, {
                    tl: { col: 0, row: 0 },
                    ext: { width: 70, height: 70 },
                });
            }

            // Garis pemisah bawah kop
            worksheet.addRow([]); // baris 4 kosong

            // ── Judul rentang waktu (merge A:J agar tidak terpotong) ──
            const startIso = readings.length ? readings[0].recorded_at : sessionInfo.started_at;
            const endIso = readings.length ? readings[readings.length - 1].recorded_at : sessionInfo.ended_at;
            worksheet.mergeCells('A5:J5');
            worksheet.getCell('A5').value =
                `LOGGER DATA TEMPERATURE MULAI ${fmtFull(startIso)} SAMPAI ${fmtFull(endIso)}`;
            worksheet.getCell('A5').font = { bold: true, size: 11 };
            worksheet.getCell('A5').alignment = { wrapText: false };

            worksheet.addRow([]); // baris 6 kosong

            // ── Header tabel ──────────────────────────────────────────
            const headerRow = worksheet.addRow(['Tanggal Jam', 'Actual', 'Setting']);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true };
                cell.border = { bottom: { style: 'thin' } };
                cell.alignment = { horizontal: 'left' };
            });

            readings.forEach((reading) => {
                worksheet.addRow([
                    fmtTanggalJam(reading.recorded_at),
                    fmtNum(reading.temperature),
                    fmtNum(reading.sv),
                ]);
            });

            worksheet.getColumn(1).width = 26;
            worksheet.getColumn(2).width = 10;
            worksheet.getColumn(3).width = 10;
            worksheet.getColumn(4).width = 10;
            worksheet.getColumn(5).width = 10;

            if (chartBase64) {
                const chartImage = workbook.addImage({
                    base64: chartBase64.replace(/^data:image\/\w+;base64,/, ''),
                    extension: 'png',
                });
                const chartStartRow = headerRow.number + readings.length + 2;
                worksheet.addImage(chartImage, {
                    tl: { col: 0, row: chartStartRow },
                    ext: { width: chartWidth, height: chartHeight },
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

    const content = (
        <>
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

                <div className="flex items-center gap-2">
                    <select
                        value={exportMode}
                        onChange={(e) => setExportMode(e.target.value)}
                        disabled={exporting}
                        className="input text-sm py-2 min-w-[160px]"
                    >
                        <option value="data">Data saja</option>
                        <option value="both">Data + Grafik</option>
                    </select>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="btn btn-success whitespace-nowrap"
                    >
                        <Download className="w-4 h-4 flex-shrink-0" />
                        {exporting ? 'Exporting...' : 'Download Excel'}
                    </button>
                </div>
            </div>

            {/* Session Info */}
            <div className="card p-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">{sessionInfo.name}</h2>
                    <p className="text-gray-500 mt-1">
                        {sessionInfo.time_range} • {sessionInfo.duration_minutes || '-'} menit
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div className="card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-[#FFB800]" />
                        Grafik Suhu
                    </h3>
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
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    Scroll mouse untuk zoom • drag area untuk zoom kotak • Shift + drag untuk geser
                </p>
                <div className={`${CHART_HEIGHT_CLASS} w-full overflow-x-auto`}>
                    <div style={{ minWidth: chartMinWidth, height: '100%' }}>
                        <Line ref={chartRef} data={chartData} options={chartOptions} />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="table-container">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-600">
                        {totalTableRows > 0
                            ? `Menampilkan ${tableRangeStart}–${tableRangeEnd} dari ${totalTableRows} data`
                            : 'Tidak ada data'}
                    </p>
                    <div className="flex items-center gap-2">
                        <label htmlFor="table-page-size" className="text-sm text-gray-500 whitespace-nowrap">
                            Per halaman
                        </label>
                        <select
                            id="table-page-size"
                            value={tablePageSize}
                            onChange={handleTablePageSizeChange}
                            className="input text-sm py-1.5 min-w-[72px]"
                        >
                            {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Waktu</th>
                            <th>SV (°C)</th>
                            <th>PV (°C)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedReadings.length > 0 ? (
                            paginatedReadings.map((reading) => (
                                <tr key={reading.id}>
                                    <td className="font-medium text-gray-800 whitespace-nowrap text-base">
                                        {formatChartTime(reading)}
                                    </td>
                                    <td className="font-bold text-[#FFB800] whitespace-nowrap text-base">
                                        {reading.sv ? reading.sv.toFixed(1) : '-'}
                                    </td>
                                    <td className="whitespace-nowrap text-base">
                                        <span className={`font-bold ${
                                            reading.temperature >= 120 ? 'text-red-600' :
                                                reading.temperature >= 110 ? 'text-yellow-500' :
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
                {totalTableRows > tablePageSize && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <button
                            type="button"
                            onClick={() => setTablePage((p) => Math.max(1, Math.min(totalTablePages, p) - 1))}
                            disabled={safeTablePage <= 1}
                            className="btn btn-outline text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Sebelumnya
                        </button>
                        <span className="text-sm font-medium text-gray-600">
                            Halaman {safeTablePage} dari {totalTablePages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                            disabled={safeTablePage >= totalTablePages}
                            className="btn btn-outline text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Berikutnya
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Tombol scroll ke atas — floating pojok kanan bawah */}
        {showScrollTop && (
            <button
                onClick={scrollToTop}
                className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-[#FFB800] text-white shadow-lg hover:bg-[#FFC933] hover:shadow-xl transition-all flex items-center justify-center animate-slideUp"
                aria-label="Kembali ke atas"
            >
                <ArrowUp className="w-5 h-5" />
            </button>
        )}
        </>
    );

    return content;
}
