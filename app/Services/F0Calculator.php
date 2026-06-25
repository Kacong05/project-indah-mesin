<?php

namespace App\Services;

use Illuminate\Support\Collection;

class F0Calculator
{
    private const T_REF = 121.1;

    private const Z = 10;

    /**
     * Hitung F₀ dengan metode trapezoidal dari time series suhu.
     *
     * @see CLAUDE.md
     */
    public static function fromReadings(Collection $readings): ?float
    {
        if ($readings->isEmpty()) {
            return null;
        }

        if ($readings->count() === 1) {
            return 0.0;
        }

        $sorted = $readings->sortBy('recorded_at')->values();
        $f0 = 0.0;

        for ($i = 1; $i < $sorted->count(); $i++) {
            $prev = $sorted[$i - 1];
            $curr = $sorted[$i];

            $tPrev = (float) $prev->temperature;
            $tCurr = (float) $curr->temperature;
            $dtMinutes = abs($prev->recorded_at->diffInSeconds($curr->recorded_at)) / 60;

            $lPrev = pow(10, ($tPrev - self::T_REF) / self::Z);
            $lCurr = pow(10, ($tCurr - self::T_REF) / self::Z);

            $f0 += (($lPrev + $lCurr) / 2) * $dtMinutes;
        }

        return round($f0, 2);
    }
}
