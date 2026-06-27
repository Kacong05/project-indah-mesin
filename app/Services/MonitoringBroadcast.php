<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Sinyal perubahan data monitoring per mesin (untuk SSE push ke browser).
 */
class MonitoringBroadcast
{
    public static function cacheKey(int $machineId): string
    {
        return "monitoring:seq:{$machineId}";
    }

    public static function tick(int $machineId): void
    {
        $key = self::cacheKey($machineId);
        $next = ((int) Cache::get($key, 0)) + 1;
        Cache::put($key, $next, now()->addHours(2));
    }

    public static function currentSeq(int $machineId): int
    {
        return (int) Cache::get(self::cacheKey($machineId), 0);
    }
}
