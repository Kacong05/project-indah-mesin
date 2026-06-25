<?php

namespace App\Http\Controllers\Concerns;

use App\Models\ActivityLog;
use App\Models\SensorReading;
use App\Services\ProcessSessionService;
use Illuminate\Support\Collection;

trait ProvidesMachineData
{
    protected function getMachineStats($machine, $latestReading, $today)
    {
        $currentProcessReadings = $machine
            ? $this->getCurrentProcessReadings($machine)
            : collect();

        $currentLatest = $currentProcessReadings->last() ?? $latestReading;

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
            'processStep' => $currentLatest?->process_status,
            'timerTot' => '00:00:00',
            'timerStp' => '00:00:00',
            'timerRem' => '00:00:00',
        ];
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
