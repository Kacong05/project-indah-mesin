<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Snapshot sensor terbaru + buffer grafik live per mesin (cache, bukan database).
 * Buffer grafik dipakai monitoring real-time — termasuk saat MV=0 / preview.
 */
class MonitoringLiveCache
{
    private const CHART_MAX_POINTS = 7200;

    public static function cacheKey(int $machineId): string
    {
        return "monitoring:live:{$machineId}";
    }

    public static function chartKey(int $machineId): string
    {
        return "monitoring:chart:{$machineId}";
    }

    /**
     * @param  array{temperature: float, sv: ?float, mv: float, pressure: float, process_status: string, recorded_at: string}  $data
     */
    public static function put(int $machineId, array $data, bool $recording): void
    {
        Cache::put(self::cacheKey($machineId), array_merge($data, [
            'recording' => $recording,
            'updated_at' => now()->toIso8601String(),
        ]), now()->addHours(2));
    }

    public static function get(int $machineId): ?array
    {
        $data = Cache::get(self::cacheKey($machineId));

        return is_array($data) ? $data : null;
    }

    public static function isPreview(?array $live): bool
    {
        return is_array($live) && ! ($live['recording'] ?? false);
    }

    /**
     * Titik grafik live — diisi setiap paket ESP masuk (preview & rekam).
     *
     * @param  array{temperature: float, sv: ?float, process_status: string, recorded_at: string}  $point
     */
    public static function appendChartPoint(int $machineId, array $point): void
    {
        $at = Carbon::parse($point['recorded_at'])->timezone('Asia/Jakarta');
        $secondKey = $at->format('Y-m-d H:i:s');

        $buf = self::getChartBuffer($machineId);
        $updated = false;

        foreach ($buf as $i => $existing) {
            $existingKey = Carbon::parse($existing['recorded_at'])
                ->timezone('Asia/Jakarta')
                ->format('Y-m-d H:i:s');
            if ($existingKey === $secondKey) {
                $buf[$i] = $point;
                $updated = true;
                break;
            }
        }

        if (! $updated) {
            $buf[] = $point;
        }

        if (count($buf) > self::CHART_MAX_POINTS) {
            $buf = array_slice($buf, -self::CHART_MAX_POINTS);
        }

        Cache::put(self::chartKey($machineId), $buf, now()->addHours(3));
    }

    /**
     * @return list<array{temperature: float, sv: ?float, process_status: string, recorded_at: string}>
     */
    public static function getChartBuffer(int $machineId): array
    {
        $buf = Cache::get(self::chartKey($machineId));

        return is_array($buf) ? $buf : [];
    }

    public static function clearChartBuffer(int $machineId): void
    {
        Cache::forget(self::chartKey($machineId));
    }
}
