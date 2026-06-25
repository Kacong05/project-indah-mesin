<?php

namespace App\Http\Controllers\Concerns;

use App\Models\ActivityLog;
use App\Models\SensorReading;
use App\Services\ProcessSessionService;
use Illuminate\Support\Collection;

trait ProvidesMachineData
{
    private const HEATING_TARGET_C = 120.0;

    private const COOLING_TARGET_C = 60.0;

    private const STERILIZING_TARGET_SEC = 50;

    private const COOLING_RATE_PER_SEC = 3.05;

    protected function getMachineStats($machine, $latestReading, $today)
    {
        $currentProcessReadings = $machine
            ? $this->getCurrentProcessReadings($machine)
            : collect();

        $currentLatest = $currentProcessReadings->last() ?? $latestReading;
        $timers = $this->calculateProcessTimers($currentProcessReadings);

        $currentTemperature = $currentLatest ? $currentLatest->temperature : 0;
        $machineStatus = $machine ? $machine->status : 'Offline';

        $lastHeartbeat = $machine?->last_heartbeat_at;
        $isOnline = $lastHeartbeat !== null && $lastHeartbeat->greaterThan(now()->subSeconds(15));

        if ($machine && ! $isOnline && $machine->status !== 'offline') {
            $machine->update(['status' => 'offline']);
        }

        $totalDataToday = $machine
            ? SensorReading::where('machine_id', $machine->id)->whereDate('recorded_at', $today)->count()
            : 0;

        $lastUpdate = $currentLatest
            ? $currentLatest->recorded_at->timezone('Asia/Jakarta')->format('Y-m-d H:i:s')
            : 'N/A';

        $dataIntervalMs = null;
        if ($machine) {
            $lastTwo = SensorReading::where('machine_id', $machine->id)
                ->orderByDesc('recorded_at')
                ->orderByDesc('id')
                ->take(2)
                ->get(['recorded_at']);

            if ($lastTwo->count() === 2) {
                $dataIntervalMs = (int) abs(
                    $lastTwo[0]->recorded_at->diffInMilliseconds($lastTwo[1]->recorded_at)
                );
            }
        }

        $isLogging = $currentLatest && $this->isLoggingStatus($currentLatest->process_status);

        return [
            'currentTemperature' => $currentTemperature,
            'machineStatus' => $machineStatus,
            'isOnline' => $isOnline,
            'isLogging' => $isLogging,
            'totalDataToday' => $totalDataToday,
            'lastUpdate' => $lastUpdate,
            'dataIntervalMs' => $dataIntervalMs,
            'sv' => $currentLatest?->sv ?? 121.1,
            'mv' => null,
            'processStep' => $this->formatProcessStepLabel($currentLatest?->process_status),
            'timerTot' => $timers['timerTot'],
            'timerStp' => $timers['timerStp'],
            'timerRem' => $timers['timerRem'],
        ];
    }

    protected function calculateProcessTimers(Collection $readings): array
    {
        $empty = [
            'timerTot' => '00:00:00',
            'timerStp' => '00:00:00',
            'timerRem' => '00:00:00',
        ];

        if ($readings->isEmpty()) {
            return $empty;
        }

        $first = $readings->first();
        $last = $readings->last();
        $currentPhase = $this->normalizePhase($last->process_status);
        $phaseStart = $this->findCurrentPhaseStart($readings, $currentPhase);

        $totalSeconds = (int) abs($first->recorded_at->diffInSeconds($last->recorded_at));
        $stepSeconds = (int) abs($phaseStart->recorded_at->diffInSeconds($last->recorded_at));

        return [
            'timerTot' => $this->formatTimer($totalSeconds),
            'timerStp' => $this->formatTimer($stepSeconds),
            'timerRem' => $this->estimatePhaseRemaining(
                $readings,
                $currentPhase,
                $stepSeconds,
                (float) $last->temperature
            ),
        ];
    }

    protected function findCurrentPhaseStart(Collection $readings, string $currentPhase): SensorReading
    {
        $phaseStart = $readings->last();

        for ($i = $readings->count() - 1; $i >= 0; $i--) {
            $reading = $readings->get($i);

            if ($this->normalizePhase($reading->process_status) !== $currentPhase) {
                break;
            }

            $phaseStart = $reading;
        }

        return $phaseStart;
    }

    protected function estimatePhaseRemaining(
        Collection $readings,
        string $phase,
        int $stepSeconds,
        float $currentTemp
    ): string {
        return match ($phase) {
            'sterilizing' => $this->formatTimer(max(0, self::STERILIZING_TARGET_SEC - $stepSeconds)),
            'heating' => $this->estimateHeatingRemaining($readings, $currentTemp),
            'cooling' => $this->estimateCoolingRemaining($readings, $currentTemp),
            default => '00:00:00',
        };
    }

    protected function estimateHeatingRemaining(Collection $readings, float $currentTemp): string
    {
        if ($currentTemp >= self::HEATING_TARGET_C) {
            return '00:00:00';
        }

        $heatingReadings = $readings
            ->filter(fn ($r) => $this->normalizePhase($r->process_status) === 'heating')
            ->values();

        if ($heatingReadings->count() < 2) {
            return '--:--:--';
        }

        $first = $heatingReadings->first();
        $last = $heatingReadings->last();
        $tempDelta = (float) $last->temperature - (float) $first->temperature;
        $timeDelta = abs($first->recorded_at->diffInSeconds($last->recorded_at));

        if ($timeDelta <= 0 || $tempDelta <= 0) {
            return '--:--:--';
        }

        $ratePerSecond = $tempDelta / $timeDelta;
        $tempToGo = self::HEATING_TARGET_C - $currentTemp;
        $remainSeconds = (int) ceil($tempToGo / $ratePerSecond);

        return $this->formatTimer($remainSeconds);
    }

    protected function estimateCoolingRemaining(Collection $readings, float $currentTemp): string
    {
        if ($currentTemp <= self::COOLING_TARGET_C) {
            return '00:00:00';
        }

        $coolingReadings = $readings
            ->filter(fn ($r) => $this->normalizePhase($r->process_status) === 'cooling')
            ->values();

        if ($coolingReadings->count() >= 2) {
            $first = $coolingReadings->first();
            $last = $coolingReadings->last();
            $tempDrop = (float) $first->temperature - (float) $last->temperature;
            $timeDelta = abs($first->recorded_at->diffInSeconds($last->recorded_at));

            if ($timeDelta > 0 && $tempDrop > 0) {
                $ratePerSecond = $tempDrop / $timeDelta;
                $tempToGo = $currentTemp - self::COOLING_TARGET_C;
                $remainSeconds = (int) ceil($tempToGo / $ratePerSecond);

                return $this->formatTimer($remainSeconds);
            }
        }

        $remainSeconds = (int) ceil(( $currentTemp - self::COOLING_TARGET_C) / self::COOLING_RATE_PER_SEC);

        return $this->formatTimer($remainSeconds);
    }

    protected function normalizePhase(?string $status): string
    {
        $phase = strtolower($status ?? 'heating');

        if (in_array($phase, ['holding', 'sterilizing'], true)) {
            return 'sterilizing';
        }

        if ($phase === 'cooling') {
            return 'cooling';
        }

        return 'heating';
    }

    protected function formatProcessStepLabel(?string $status): ?string
    {
        return match ($this->normalizePhase($status)) {
            'sterilizing' => 'STERILISASI',
            'cooling' => 'PENDINGINAN',
            default => 'PEMANASAN',
        };
    }

    protected function formatTimer(int $seconds): string
    {
        $seconds = max(0, $seconds);

        return sprintf(
            '%02d:%02d:%02d',
            intdiv($seconds, 3600),
            intdiv($seconds % 3600, 60),
            $seconds % 60
        );
    }

    protected function getRecentActivities($userId)
    {
        return ActivityLog::with('user')
            ->where('user_id', $userId)
            ->latest()
            ->take(5)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'description' => $log->action,
                    'user' => $log->user ? $log->user->name : 'System',
                    'created_at' => $log->created_at->timezone('Asia/Jakarta')->format('Y-m-d H:i:s'),
                    'properties' => $log->properties,
                ];
            });
    }

    /**
     * Ambil data sensor proses yang sedang berjalan.
     * Proses baru = gap recorded_at antar data ≥ 3 menit.
     */
    protected function getCurrentProcessReadings($machine, int $scanLimit = 500): Collection
    {
        if (! $machine) {
            return collect();
        }

        $gapSeconds = ProcessSessionService::GAP_THRESHOLD_MINUTES * 60;

        $readings = SensorReading::where('machine_id', $machine->id)
            ->orderByDesc('recorded_at')
            ->orderByDesc('id')
            ->take($scanLimit)
            ->get()
            ->values();

        if ($readings->isEmpty()) {
            return collect();
        }

        $currentProcess = collect([$readings->first()]);

        for ($i = 1; $i < $readings->count(); $i++) {
            $newer = $readings->get($i - 1);
            $older = $readings->get($i);
            $gap = abs($newer->recorded_at->diffInSeconds($older->recorded_at));

            if ($gap >= $gapSeconds) {
                break;
            }

            $currentProcess->push($older);
        }

        return $currentProcess->reverse()->values();
    }

    protected function getTemperatureChartData($machine)
    {
        $labels = [];
        $data = [];
        $svData = [];
        $recordedAts = [];
        $statuses = [];
        $processSessionId = null;
        $processStartedAt = null;

        if ($machine) {
            $readings = $this->getCurrentProcessReadings($machine);

            if ($readings->isNotEmpty()) {
                $firstReading = $readings->first();

                $processSessionId = $firstReading->process_session_id;
                $processStartedAt = $firstReading->recorded_at
                    ->timezone('Asia/Jakarta')
                    ->toIso8601String();

                foreach ($readings as $reading) {
                    $labels[] = $reading->recorded_at->timezone('Asia/Jakarta')->format('H:i:s.v');
                    $data[] = $reading->temperature;
                    $svData[] = $reading->sv ?? 121.1;
                    $recordedAts[] = $reading->recorded_at->toIso8601String();
                    $statuses[] = $reading->process_status;
                }
            }
        }

        return [
            'labels' => $labels,
            'statuses' => $statuses,
            'data' => $data,
            'svData' => $svData,
            'recordedAts' => $recordedAts,
            'processSessionId' => $processSessionId,
            'processStartedAt' => $processStartedAt,
        ];
    }

    protected function isLoggingStatus(?string $processStatus): bool
    {
        if ($processStatus === null) {
            return false;
        }

        return in_array(strtolower($processStatus), ['logging', 'running', 'heating', 'holding', 'sterilizing'], true);
    }
}
