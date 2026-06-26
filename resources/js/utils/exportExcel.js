/**
 * exportExcel.js
 * Utility untuk generate Excel laporan proses — tanpa grafik (data saja).
 * Dipakai dari ProcessCard (quick download) maupun ProcessDetail.
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Format tanggal/jam: M/D/YYYY  h:mm:ssAM/PM (zona Asia/Jakarta, spasi ganda)
export function fmtTanggalJam(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    const s = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    }).format(d);
    return s.replace(', ', '  ').replace(' PM', 'PM').replace(' AM', 'AM');
}

// Format rentang judul: YYYY-MM-DD HH:mm:ss (24 jam)
export function fmtFull(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(d).replace(', ', ' ');
}

// Angka 1 desimal, buang ".0" agar 97.0 → "97"
export function fmtNum(v) {
    if (v === null || v === undefined || v === '') return '-';
    const n = Number(v);
    if (isNaN(n)) return '-';
    return Number(n.toFixed(1)).toString();
}

/**
 * Generate dan download Excel data-saja (tanpa grafik).
 * @param {object} sessionInfo  — { name, started_at, ended_at, ... }
 * @param {Array}  readings     — array sensor readings
 */
export async function exportDataOnly(sessionInfo, readings) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Logger Data');

    // ── Load logo ────────────────────────────────────────────────
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
    } catch (_) { /* logo gagal load */ }

    // ── Kop perusahaan ───────────────────────────────────────────
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

    worksheet.getRow(1).height = 30;
    worksheet.getRow(2).height = 18;
    worksheet.getRow(3).height = 30;

    if (logoImageId !== null) {
        worksheet.addImage(logoImageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 70, height: 70 },
        });
    }

    worksheet.addRow([]); // baris 4 kosong

    // ── Judul rentang waktu ──────────────────────────────────────
    const startIso = readings.length ? readings[0].recorded_at : sessionInfo.started_at;
    const endIso   = readings.length ? readings[readings.length - 1].recorded_at : sessionInfo.ended_at;
    worksheet.mergeCells('A5:J5');
    worksheet.getCell('A5').value =
        `LOGGER DATA TEMPERATURE MULAI ${fmtFull(startIso)} SAMPAI ${fmtFull(endIso)}`;
    worksheet.getCell('A5').font = { bold: true, size: 11 };
    worksheet.getCell('A5').alignment = { wrapText: false };

    worksheet.addRow([]); // baris 6 kosong

    // ── Header tabel ─────────────────────────────────────────────
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

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Data_${sessionInfo.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
    saveAs(new Blob([buffer]), filename);
}
