<?php

namespace App\Http\Controllers\Concerns;

use App\Models\ActivityLog;
use App\Models\ProcessSession;
use App\Models\SensorReading;
use Carbon\Carbon;

trait ProvidesMachineData
{
    protected function getMachineStats($machine, $latestReading, $today)
    {
        $currentTemperature = $latestReading ? $latestReading->temperature : 0;
        $machineStatus = $machine ? $machine->status : 'Offline';

        $lastHeartbeat = $machine?->last_heartbeat_at;

        $isOnline = $lastHeartbeat !== null && $lastHeartbeat->greaterThan(now()->subSeconds(15));

        if ($machine && ! $isOnline && $machine->status !== 'offline') {
            $machine->update(['status' => 'offline']);
        }

        $totalDataToday = $machine ? SensorReading::where('machine_id', $machine->id)->whereDate('created_at', $today)->count() : 0;
        $lastUpdate = $latestReading ? $latestReading->created_at->timezone('Asia/Jakarta')->format('Y-m-d H:i:s') : 'N/A';

        $dataIntervalMs = null;
        if ($machine) {
            $lastTwo = SensorReading::where('machine_id', $machine->id)
                ->latest('created_at')
                ->take(2)
                ->pluck('created_at');
            if ($lastTwo->count() === 2) {
                $dataIntervalMs = (int) abs($lastTwo[0]->diffInMilliseconds($lastTwo[1]));
            }
        }

        $isLogging = $latestReading && $this->isLoggingStatus($latestReading->process_status);

        $processSession = $machine
            ? ProcessSession::where('machine_id', $machine->id)->latest()->first()
            : null;

        return [
            'currentTemperature' => $currentTemperature,
            'machineStatus' => $machineStatus,
            'isOnline' => $isOnline,
            'isLogging' => $isLogging,
            'totalDataToday' => $totalDataToday,
            'lastUpdate' => $lastUpdate,
            'dataIntervalMs' => $dataIntervalMs,
            'sv' => $processSession?->target_temperature ?? 121.1,
            'mv' => null,
            'processStep' => $processSession?->current_step,
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

    protected function getTemperatureChartData($machine)
    {
        $labels = [];
        $data = [];
        $svData = [];
        $recordedAts = [];

        if ($machine) {
            $latestSession = ProcessSession::where('machine_id', $machine->id)
                ->latest()
                ->first();

            if ($latestSession) {
                $readings = SensorReading::where('machine_id', $machine->id)
                    ->where('process_session_id', $latestSession->id)
                    ->latest()
                    ->take(100)
                    ->get()
                    ->reverse();

                foreach ($readings as $reading) {
                    $labels[] = $reading->created_at->timezone('Asia/Jakarta')->format('H:i:s.v');
                    $data[] = $reading->temperature;
                    $svData[] = $reading->sv ?? 121.1;
                    $recordedAts[] = $reading->recorded_at ?? $reading->created_at;
                }
            }
        }

        return [
            'labels' => $labels,
            'data' => $data,
            'svData' => $svData,
            'recordedAts' => $recordedAts,
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
