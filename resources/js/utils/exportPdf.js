/**
 * exportPdf.js
 * Generate PDF laporan proses menggunakan html2pdf.js
 * Mode: 'data' | 'chart' | 'both'
 */

import html2pdf from 'html2pdf.js';

function fmtTanggalJam(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    const tgl = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
    const jam = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(d);
    // Beri jarak 3 spasi (pakai &nbsp; agar tidak diciutkan HTML) antara tanggal & jam
    return `${tgl}&nbsp;&nbsp;&nbsp;${jam}`;
}

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

function fmtNum(v) {
    if (v === null || v === undefined || v === '') return '-';
    const n = Number(v);
    if (isNaN(n)) return '-';
    return Number(n.toFixed(1)).toString();
}

async function loadLogoBase64() {
    try {
        const resp = await fetch('/logo.png');
        const blob = await resp.blob();
        return await new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch { return null; }
}

function buildHeader(sessionInfo, logoSrc) {
    return `
    <div style="display:flex;align-items:center;gap:14px;padding-bottom:10px;border-bottom:2px solid #333;margin-bottom:10px;">
      ${logoSrc ? `<img src="${logoSrc}" style="width:60px;height:60px;object-fit:contain;" />` : ''}
      <div>
        <div style="font-size:18px;font-weight:900;letter-spacing:1px;">INDAHMESIN.COM</div>
        <div style="font-size:12px;font-weight:700;">INDAH JAYA TEKNIK, CV</div>
        <div style="font-size:10px;color:#555;">Jalan Raya Randugading No.137 RT 12 RW 03 Kel. Randugading Kec. Tajinan, Kabupaten Malang, Jawa Timur 65172</div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;margin-bottom:12px;">
      LOGGER DATA TEMPERATURE &nbsp;
      MULAI ${fmtFull(sessionInfo.started_at)} &nbsp; SAMPAI ${fmtFull(sessionInfo.ended_at)}
    </div>`;
}

function buildDataTable(readings) {
    const rows = readings.map(r => `
      <tr>
        <td style="padding:3px 6px;border:1px solid #ccc;">${fmtTanggalJam(r.recorded_at)}</td>
        <td style="padding:3px 6px;border:1px solid #ccc;text-align:center;">${fmtNum(r.temperature)}</td>
        <td style="padding:3px 6px;border:1px solid #ccc;text-align:center;">${fmtNum(r.sv)}</td>
      </tr>`).join('');

    return `
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th style="padding:4px 6px;border:1px solid #ccc;text-align:left;">Tanggal Jam</th>
          <th style="padding:4px 6px;border:1px solid #ccc;text-align:center;">Actual (°C)</th>
          <th style="padding:4px 6px;border:1px solid #ccc;text-align:center;">Setting (°C)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/**
 * Export PDF
 * @param {object} sessionInfo
 * @param {Array}  readings
 * @param {'data'|'chart'|'both'} mode
 * @param {string|null} chartBase64  — PNG dari canvas chart (opsional)
 */
export async function exportPdf(sessionInfo, readings, mode, chartBase64 = null) {
    const logoSrc = await loadLogoBase64();
    const header = buildHeader(sessionInfo, logoSrc);

    let body = '';

    if (mode === 'chart' && chartBase64) {
        body = `<img src="${chartBase64}" style="width:100%;margin-top:10px;" />`;
    } else if (mode === 'data') {
        body = buildDataTable(readings);
    } else {
        // both
        const tableHtml = buildDataTable(readings);
        const chartHtml = chartBase64
            ? `<div style="page-break-before:always;padding-top:16px;">
                 ${buildHeader(sessionInfo, logoSrc)}
                 <img src="${chartBase64}" style="width:100%;" />
               </div>`
            : '';
        body = tableHtml + chartHtml;
    }

    const container = document.createElement('div');
    container.style.cssText = 'font-family:Arial,sans-serif;padding:20px;background:#fff;';
    container.innerHTML = header + body;
    document.body.appendChild(container);

    const filename = `Laporan_${mode}_${sessionInfo.name?.replace(/\s+/g, '_') ?? 'proses'}_${Date.now()}.pdf`;

    await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: mode === 'chart' ? 'landscape' : 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css'] },
    }).from(container).save();

    document.body.removeChild(container);
}
