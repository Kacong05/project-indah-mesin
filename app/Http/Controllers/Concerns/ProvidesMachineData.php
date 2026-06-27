<?php

namespace App\Http\Controllers\Concerns;

use App\Models\ActivityLog;
use App\Models\SensorReading;
use App\Services\MonitoringLiveCache;
use App\Services\ProcessSessionService;
use Carbon\Carbon;
use Illuminate\Support\Collection;

trait ProvidesMachineData
{
    private const HEATING_TARGET_C = 120.0;

    private const COOLING_TARGET_C = 60.0;

    private const HOLDING_TARGET_SEC = 1200;

    private const COOLING_RATE_PER_SEC = 3.05;

    /** Deteksi koneksi aktif (heartbeat server). */
    private const ONLINE_THRESHOLD_SECONDS = 15;

    /** Tanpa data baru ≥ threshold → kosongkan tampilan monitoring. */
    private const IDLE_THRESHOLD_MINUTES = 10;

    protected function getMachineStats($machine, $latestReading, $today)
    {
        $displayMode = $this->resolveMonitoringDisplayMode($machine);
        $isOnline = $displayMode === 'active';

        if ($machine && ! $isOnline && $machine->status !== 'offline') {
            $machine->update(['status' => 'offline']);
        }

        $totalDataToday = $machine
          ? SensorReading::where('machine_id', $machine->id)->whereDate('recorded_at', $today)->count()
          : 0;

        if ($displayMode === 'idle' || ! $machine) {
            return $this->buildIdleMonitoringStats($machine, $totalDataToday);
        }

        $live = MonitoringLiveCache::get($machine->id);

        // Katup tertutup: tampilkan PV/SV live dari cache, tanpa perekaman proses.
        if ($displayMode === 'active' && MonitoringLiveCache::isPreview($live)) {
            return $this->buildPreviewMonitoringStats($machine, $live, $totalDataToday);
        }

        $currentProcessReadings = $this->getCurrentProcessReadings($machine);
        $currentLatest = $currentProcessReadings->last() ?? $latestReading;

        if (! $currentLatest) {
            return $this->buildIdleMonitoringStats($machine, $totalDataToday);
        }

        $timers = $this->calculateProcessTimers($currentProcessReadings);
        $processPhase = $this->normalizePhase($currentLatest->process_status);
        $isRunning = $processPhase !== 'idle';

        $lastUpdate = $currentLatest->recorded_at
            ->timezone('Asia/Jakarta')
            ->format('d/m/Y H:i:s');

        $dataIntervalMs = $this->resolveDataIntervalMs($machine);

        return [
            'displayMode' => $displayMode,
            'currentTemperature' => $isRunning ? (float) $currentLatest->temperature : 0,
            'machineStatus' => $machine->status,
            'isOnline' => $isOnline,
            'isLogging' => $this->isLoggingStatus($currentLatest->process_status),
            'runState' => $isRunning ? 'run' : 'stop',
            'totalDataToday' => $totalDataToday,
            'lastUpdate' => $lastUpdate,
            'dataIntervalMs' => $dataIntervalMs,
            'sv' => $this->formatSvForDisplay($currentLatest, $isRunning),
            'mv' => 0,
            'processStep' => $this->formatProcessStepLabel($currentLatest->process_status),
            'processStepCode' => $this->formatProcessStepCode($currentLatest->process_status),
            'processPhase' => $processPhase,
            'timerTot' => $timers['timerTot'],
            'timerStp' => $timers['timerStp'],
        ];
    }

    /**
     * Mode tampilan monitoring berdasarkan waktu server (bukan recorded_at).
     * - active: data masuk ≤ 15 detik
     * - paused: putus jaringan < 10 menit — tampilkan proses terakhir
     * - idle:   tidak ada data ≥ 10 menit — kosongkan tampilan
     */
    protected function resolveMonitoringDisplayMode($machine): string
    {
        if (! $machine || ! $machine->last_heartbeat_at) {
            return 'idle';
        }

        $secondsSinceHeartbeat = abs($machine->last_heartbeat_at->diffInSeconds(now()));

        if ($secondsSinceHeartbeat <= self::ONLINE_THRESHOLD_SECONDS) {
            return 'active';
        }

        if ($secondsSinceHeartbeat >= self::IDLE_THRESHOLD_MINUTES * 60) {
            return 'idle';
        }

        return 'paused';
    }

    protected function buildPreviewMonitoringStats($machine, array $live, int $totalDataToday): array
    {
        $lastUpdate = isset($live['recorded_at'])
            ? Carbon::parse($live['recorded_at'])->timezone('Asia/Jakarta')->format('d/m/Y H:i:s')
            : ($live['updated_at'] ?? 'N/A');

        return [
            'displayMode' => 'preview',
            'currentTemperature' => (float) $live['temperature'],
            'machineStatus' => $machine->status,
            'isOnline' => true,
            'isLogging' => false,
            'runState' => 'stop',
            'totalDataToday' => $totalDataToday,
            'lastUpdate' => $lastUpdate,
            'dataIntervalMs' => null,
            'sv' => round((float) ($live['sv'] ?? 121.1), 1),
            'mv' => (float) ($live['mv'] ?? 0),
            'processStep' => 'Stop',
            'processStepCode' => '00',
            'processPhase' => 'idle',
            'timerTot' => '00:00',
            'timerStp' => '00:00',
        ];
    }

    protected function buildIdleMonitoringStats($machine, int $totalDataToday): array
    {
        $lastHeartbeat = $machine?->last_heartbeat_at;
        $lastUpdate = $lastHeartbeat
          ? $lastHeartbeat->timezone('Asia/Jakarta')->format('d/m/Y H:i:s')
          : 'N/A';

        return [
            'displayMode' => 'idle',
            'currentTemperature' => 0,
            'machineStatus' => $machine ? $machine->status : 'Offline',
            'isOnline' => false,
            'isLogging' => false,
            'runState' => 'stop',
            'totalDataToday' => $totalDataToday,
            'lastUpdate' => $lastUpdate,
            'dataIntervalMs' => null,
            'sv' => 'Stop',
            'mv' => 0,
            'processStep' => 'Stop',
            'processStepCode' => '00',
            'processPhase' => 'idle',
            'timerTot' => '00:00',
            'timerStp' => '00:00',
        ];
    }

    protected function formatSvForDisplay(?SensorReading $reading, bool $isRunning): string|float
    {
        if (! $isRunning || ! $reading) {
            return 'Stop';
        }

        return round((float) ($reading->sv ?? 121.1), 1);
    }

    protected function resolveDataIntervalMs($machine): ?int
    {
        $lastTwo = SensorReading::where('machine_id', $machine->id)
            ->orderByDesc('recorded_at')
            ->orderByDesc('id')
            ->take(2)
            ->get(['recorded_at']);

        if ($lastTwo->count() < 2) {
            return null;
        }

        return (int) abs(
            $lastTwo[0]->recorded_at->diffInMilliseconds($lastTwo[1]->recorded_at)
        );
    }

    protected function calculateProcessTimers(Collection $readings): array
    {
        $empty = [
            'timerTot' => '00:00',
            'timerStp' => '00:00',
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
            'timerTot' => $this->formatTimerMs($totalSeconds),
            'timerStp' => $this->formatTimerMs($stepSeconds),
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

    protected function normalizePhase(?string $status): string
    {
        $phase = strtolower(trim($status ?? ''));

        if (in_array($phase, ['idle', 'stop', 'standby', ''], true)) {
            return 'idle';
        }

        if (in_array($phase, ['holding', 'sterilizing'], true)) {
            return 'sterilizing';
        }

        if ($phase === 'cooling') {
            return 'cooling';
        }

        return 'heating';
    }

    protected function formatProcessStepLabel(?string $status): string
    {
        return match ($this->normalizePhase($status)) {
            'sterilizing' => 'Sterilization',
            'cooling' => 'Cooling',
            'idle' => 'Stop',
            default => 'CUT',
        };
    }

    protected function formatProcessStepCode(?string $status): string
    {
        return match ($this->normalizePhase($status)) {
            'sterilizing' => '02',
            'cooling' => '03',
            'idle' => '00',
            default => '01',
        };
    }

    /** Format menit:detik (TOT M:S / STP M:S) seperti software existing. */
    protected function formatTimerMs(int $seconds): string
    {
        $seconds = max(0, $seconds);
        $minutes = intdiv($seconds, 60);
        $secs = $seconds % 60;

        return sprintf('%02d:%02d', $minutes, $secs);
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
        $empty = [
            'labels' => [],
            'statuses' => [],
            'data' => [],
            'svData' => [],
            'recordedAts' => [],
            'processSessionId' => null,
            'processStartedAt' => null,
        ];

        if (! $machine || $this->resolveMonitoringDisplayMode($machine) === 'idle') {
            return $empty;
        }

        $readings = $this->getCurrentProcessReadings($machine);

        if ($readings->isEmpty()) {
            return $empty;
        }

        $labels = [];
        $data = [];
        $svData = [];
        $recordedAts = [];
        $statuses = [];

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
