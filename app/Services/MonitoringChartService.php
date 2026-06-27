<?php

namespace App\Services;

use Illuminate\Support\Collection;

/**
 * Grafik monitoring live — batas titik & decimation (standar HMI/trend industri).
 *
 * Buffer mentah: cukup untuk satu batch (~1 jam @ 1 Hz).
 * Tampilan: maks ~360 titik (decimation bucket) agar SSE + browser ringan.
 */
class MonitoringChartService
{
    /** Buffer mentah per mesin (detik @ 1 Hz ≈ 1 jam). */
    public const BUFFER_MAX_POINTS = 3600;

    /** Titik maks dikirim ke browser saat proses rekam aktif. */
    public const DISPLAY_MAX_POINTS = 360;

    /** Preview katup tertutup — cukup ~5 menit @ 1 Hz. */
    public const PREVIEW_DISPLAY_MAX_POINTS = 120;

    /**
     * Decimation bucket: ambil titik terakhir tiap bucket (cocok live trend).
     *
     * @param  Collection<int, array<string, mixed>>  $points
     * @return Collection<int, array<string, mixed>>
     */
    public static function downsample(Collection $points, int $maxPoints): Collection
    {
        $count = $points->count();

        if ($count <= $maxPoints || $maxPoints < 2) {
            return $points->values();
        }

        $bucketSize = $count / $maxPoints;
        $sampled = collect();

        for ($i = 0; $i < $maxPoints; $i++) {
            $start = (int) floor($i * $bucketSize);
            $end = (int) floor(($i + 1) * $bucketSize) - 1;
            $end = max($start, min($end, $count - 1));

            // Titik akhir bucket = nilai terbaru di interval (live SCADA trend).
            $sampled->push($points->get($end));
        }

        return $sampled->values();
    }

    public static function displayLimit(bool $previewMode): int
    {
        return $previewMode ? self::PREVIEW_DISPLAY_MAX_POINTS : self::DISPLAY_MAX_POINTS;
    }
}
