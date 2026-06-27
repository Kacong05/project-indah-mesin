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
            return $this->buildIdleMonitoringStats($machine, $latestReading, $totalDataToday);
        }

        $live = MonitoringLiveCache::get($machine->id);
        $valveClosed = $displayMode === 'active' && $this->isValveClosedLive($live);

        $currentProcessReadings = $this->getCurrentProcessReadings($machine);
        $currentLatest = $currentProcessReadings->last() ?? $latestReading;

        if (! $currentLatest) {
            if ($displayMode === 'active' && is_array($live)) {
                return $this->buildLiveMonitoringStats($machine, $live, $totalDataToday, $valveClosed, $isOnline);
            }

            return $this->buildIdleMonitoringStats($machine, $latestReading, $totalDataToday);
        }

        $timers = $this->calculateProcessTimers($currentProcessReadings);
        $processPhase = $this->normalizePhase($currentLatest->process_status);
        $isRunning = $processPhase !== 'idle';

        $lastUpdate = $currentLatest->recorded_at
            ->timezone('Asia/Jakarta')
            ->format('d/m/Y H:i:s');

        $dataIntervalMs = $this->resolveDataIntervalMs($machine);

        $pv = $isRunning ? (float) $currentLatest->temperature : 0;
        $sv = $this->formatSvForDisplay($currentLatest, $isRunning);
        $mv = 0.0;

        if ($valveClosed && is_array($live)) {
            $pv = (float) $live['temperature'];
            $sv = round((float) ($live['sv'] ?? 121.1), 1);
            $mv = (float) ($live['mv'] ?? 0);
            $lastUpdate = isset($live['recorded_at'])
                ? Carbon::parse($live['recorded_at'])->timezone('Asia/Jakarta')->format('d/m/Y H:i:s')
                : $lastUpdate;
            $timers = ['timerTot' => '00:00', 'timerStp' => '00:00'];
        }

        return [
            'displayMode' => $displayMode,
            'valveClosed' => $valveClosed,
            'currentTemperature' => $pv,
            'machineStatus' => $machine->status,
            'isOnline' => $isOnline,
            'isLogging' => $this->isLoggingStatus($currentLatest->process_status),
            'runState' => $isRunning ? 'run' : 'stop',
            'totalDataToday' => $totalDataToday,
            'lastUpdate' => $lastUpdate,
            'dataIntervalMs' => $dataIntervalMs,
            'sv' => $sv,
            'mv' => $mv,
            'processStep' => $this->formatProcessStepLabel($currentLatest->process_status),
            'processStepCode' => $this->formatProcessStepCode($currentLatest->process_status),
            'processPhase' => $processPhase,
            'timerTot' => $timers['timerTot'],
            'timerStp' => $timers['timerStp'],
        ];
    }

    /** Katup tertutup = MV dari ESP ≤ 0 (independen dari flag recording). */
    protected function isValveClosedLive(?array $live): bool
    {
        return is_array($live) && (float) ($live['mv'] ?? 0) <= 0;
    }

    /**
     * Mesin online, belum ada reading DB — PV/SV/grafik dari cache live saja.
     */
    protected function buildLiveMonitoringStats($machine, array $live, int $totalDataToday, bool $valveClosed, bool $isOnline): array
    {
        $lastUpdate = isset($live['recorded_at'])
            ? Carbon::parse($live['recorded_at'])->timezone('Asia/Jakarta')->format('d/m/Y H:i:s')
            : 'N/A';

        $processPhase = $this->normalizePhase($live['process_status'] ?? 'idle');
        $closed = $this->isValveClosedLive($live);

        return [
            'displayMode' => 'active',
            'valveClosed' => $closed,
            'currentTemperature' => (float) $live['temperature'],
            'machineStatus' => $machine->status,
            'isOnline' => $isOnline,
            'isLogging' => false,
            'runState' => 'stop',
            'totalDataToday' => $totalDataToday,
            'lastUpdate' => $lastUpdate,
            'dataIntervalMs' => null,
            'sv' => round((float) ($live['sv'] ?? 121.1), 1),
            'mv' => (float) ($live['mv'] ?? 0),
            'processStep' => $this->formatProcessStepLabel($live['process_status'] ?? 'idle'),
            'processStepCode' => $this->formatProcessStepCode($live['process_status'] ?? 'idle'),
            'processPhase' => $processPhase,
            'timerTot' => '00:00',
            'timerStp' => '00:00',
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

    protected function buildIdleMonitoringStats($machine, $latestReading, int $totalDataToday): array
    {
        $lastHeartbeat = $machine?->last_heartbeat_at;
        $lastUpdate = $lastHeartbeat
          ? $lastHeartbeat->timezone('Asia/Jakarta')->format('d/m/Y H:i:s')
          : 'N/A';

        // Tampilkan data terakhir yang diterima, apapun statusnya
        $lastTemp = $latestReading ? (float) $latestReading->temperature : 0;

        return [
            'displayMode' => 'idle',
            'valveClosed' => false,
            'currentTemperature' => $lastTemp,
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

        $dbReadings = $this->getCurrentProcessReadings($machine);
        $buffer = MonitoringLiveCache::getChartBuffer($machine->id);
        $merged = $this->mergeChartPoints($dbReadings, $buffer);

        if ($merged->isEmpty()) {
            return $empty;
        }

        $labels = [];
        $data = [];
        $svData = [];
        $recordedAts = [];
        $statuses = [];

        $first = $merged->first();
        $processSessionId = $first['process_session_id'] ?? null;
        $processStartedAt = Carbon::parse($first['recorded_at'])
            ->timezone('Asia/Jakarta')
            ->toIso8601String();

        foreach ($merged as $point) {
            $at = Carbon::parse($point['recorded_at'])->timezone('Asia/Jakarta');
            $labels[] = $at->format('H:i:s.v');
            $data[] = (float) $point['temperature'];
            $svData[] = (float) ($point['sv'] ?? 121.1);
            $recordedAts[] = $at->toIso8601String();
            $statuses[] = $point['process_status'] ?? 'idle';
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

    /**
     * Gabungkan titik DB + buffer live cache (dedup per detik).
     * Grafik monitoring real-time tetap jalan walau MV=0 / data belum masuk DB.
     */
    protected function mergeChartPoints(Collection $dbReadings, array $buffer): Collection
    {
        $bySecond = [];

        foreach ($dbReadings as $reading) {
            $key = $reading->recorded_at->timezone('Asia/Jakarta')->format('Y-m-d H:i:s');
            $bySecond[$key] = [
                'recorded_at' => $reading->recorded_at->toIso8601String(),
                'temperature' => (float) $reading->temperature,
                'sv' => $reading->sv !== null ? (float) $reading->sv : null,
                'process_status' => $reading->process_status,
                'process_session_id' => $reading->process_session_id,
            ];
        }

        $windowStart = null;
        if ($dbReadings->isNotEmpty()) {
            $windowStart = $dbReadings->first()->recorded_at->copy()->timezone('Asia/Jakarta');
        } elseif ($buffer !== []) {
            $windowStart = $this->resolveBufferWindowStart($buffer);
        }

        foreach ($buffer as $point) {
            if (! isset($point['recorded_at'])) {
                continue;
            }
            $at = Carbon::parse($point['recorded_at'])->timezone('Asia/Jakarta');
            if ($windowStart && $at->lt($windowStart)) {
                continue;
            }
            $key = $at->format('Y-m-d H:i:s');
            if (! isset($bySecond[$key])) {
                $bySecond[$key] = [
                    'recorded_at' => $at->toIso8601String(),
                    'temperature' => (float) ($point['temperature'] ?? 0),
                    'sv' => isset($point['sv']) ? (float) $point['sv'] : null,
                    'process_status' => $point['process_status'] ?? 'idle',
                    'process_session_id' => null,
                ];
            }
        }

        ksort($bySecond);

        return collect(array_values($bySecond));
    }

    /**
     * Awal proses dari buffer: mundur dari titik terbaru sampai gap ≥ 3 menit.
     */
    protected function resolveBufferWindowStart(array $buffer): ?Carbon
    {
        if ($buffer === []) {
            return null;
        }

        $gapSeconds = ProcessSessionService::GAP_THRESHOLD_MINUTES * 60;
        usort($buffer, fn ($a, $b) => strcmp($a['recorded_at'] ?? '', $b['recorded_at'] ?? ''));
        $newest = Carbon::parse($buffer[array_key_last($buffer)]['recorded_at'])->timezone('Asia/Jakarta');
        $start = $newest->copy();

        for ($i = count($buffer) - 2; $i >= 0; $i--) {
            $at = Carbon::parse($buffer[$i]['recorded_at'])->timezone('Asia/Jakarta');
            if (abs($start->diffInSeconds($at)) >= $gapSeconds) {
                break;
            }
            $start = $at->copy();
        }

        return $start;
    }

    protected function isLoggingStatus(?string $processStatus): bool
    {
        if ($processStatus === null) {
            return false;
        }

        return in_array(strtolower($processStatus), ['logging', 'running', 'heating', 'holding', 'sterilizing'], true);
    }
}
