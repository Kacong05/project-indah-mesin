<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Snapshot sensor terbaru per mesin (cache, bukan database).
 * Dipakai untuk tampilan web saat katup/MV tertutup — PV & SV tetap live tanpa perekaman proses.
 */
class MonitoringLiveCache
{
    public static function cacheKey(int $machineId): string
    {
        return "monitoring:live:{$machineId}";
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
}
