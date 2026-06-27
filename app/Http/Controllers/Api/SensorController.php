<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RetortMachine;
use App\Models\SensorReading;
use App\Services\MonitoringBroadcast;
use App\Services\MonitoringLiveCache;
use App\Services\ProcessSessionService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class SensorController extends Controller
{
    private ProcessSessionService $processSessionService;

    public function __construct(ProcessSessionService $processSessionService)
    {
        $this->processSessionService = $processSessionService;
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'machine_code' => 'required|string|exists:retort_machines,machine_code',
            'temperature' => 'required|numeric',
            'sv' => 'nullable|numeric',
            'mv' => 'nullable|numeric',
            'pressure' => 'required|numeric',
            'process_status' => 'nullable|string',
            'recorded_at' => 'required|date',
            'logging' => 'nullable|boolean',
            'backfill' => 'nullable|boolean',
            'ps' => 'nullable|string|max:16',
            'pattern' => 'nullable|integer|min:0|max:99',
            'step' => 'nullable|integer|min:0|max:99',
            'timer_tot' => 'nullable|string|max:16',
            'timer_stp' => 'nullable|string|max:16',
        ]);

        $machine = RetortMachine::where('machine_code', $validated['machine_code'])->first();

        $timestamp = Carbon::parse($validated['recorded_at'])->timezone('Asia/Jakarta');
        $mv = isset($validated['mv']) ? (float) $validated['mv'] : null;
        $logging = (bool) ($validated['logging'] ?? false);
        $backfill = (bool) ($validated['backfill'] ?? false);

        $liveData = [
            'temperature' => (float) $validated['temperature'],
            'sv' => isset($validated['sv']) ? (float) $validated['sv'] : null,
            'mv' => $mv ?? 0.0,
            'pressure' => (float) $validated['pressure'],
            'process_status' => $validated['process_status'] ?? 'idle',
            'recorded_at' => $timestamp->copy()->timezone('Asia/Jakarta')->toIso8601String(),
            'ps' => $this->normalizePsField(
                $validated['ps'] ?? null,
                $validated['pattern'] ?? null,
                $validated['step'] ?? null
            ),
            'pattern' => isset($validated['pattern']) ? (int) $validated['pattern'] : null,
            'step' => isset($validated['step']) ? (int) $validated['step'] : null,
            'timer_tot' => $validated['timer_tot'] ?? null,
            'timer_stp' => $validated['timer_stp'] ?? null,
        ];

        $chartPoint = [
            'temperature' => $liveData['temperature'],
            'sv' => $liveData['sv'],
            'process_status' => $liveData['process_status'],
            'recorded_at' => $liveData['recorded_at'],
        ];

        if (! $backfill && ! MonitoringLiveCache::shouldAccept($machine->id, $liveData['recorded_at'])) {
            return response()->json([
                'success' => true,
                'recorded' => false,
                'ignored' => true,
                'message' => 'Paket stale — recorded_at lebih lama dari snapshot live, dilewati.',
            ]);
        }

        $valveOpen = $mv === null || $mv > 0 || $logging;

        if ($backfill) {
            return $this->handleBackfill($machine, $validated, $timestamp, $liveData, $chartPoint, $valveOpen);
        }

        if (! $valveOpen) {
            MonitoringLiveCache::put($machine->id, $liveData, recording: false);
            MonitoringLiveCache::appendChartPoint($machine->id, $chartPoint);

            $machine->update([
                'last_heartbeat_at' => now(),
                'status' => RetortMachine::STATUS_STANDBY,
            ]);

            MonitoringBroadcast::tick($machine->id);

            return response()->json([
                'success' => true,
                'recorded' => false,
                'live' => true,
                'message' => 'MV <= 0 (katup tertutup) — PV/SV ditampilkan di web, tidak disimpan ke database.',
            ]);
        }

        MonitoringLiveCache::put($machine->id, $liveData, recording: true);
        MonitoringLiveCache::appendChartPoint($machine->id, $chartPoint);

        return $this->persistReading($machine, $validated, $timestamp, $chartPoint);
    }

    /**
     * Replay SD dari ESP — DB + grafik merge; live snapshot hanya jika recorded_at terbaru.
     *
     * @param  array<string, mixed>  $validated
     * @param  array<string, mixed>  $liveData
     * @param  array<string, mixed>  $chartPoint
     */
    private function handleBackfill(
        RetortMachine $machine,
        array $validated,
        Carbon $timestamp,
        array $liveData,
        array $chartPoint,
        bool $valveOpen
    ): JsonResponse {
        if (! $valveOpen) {
            $machine->update([
                'last_heartbeat_at' => now(),
                'status' => RetortMachine::STATUS_STANDBY,
            ]);

            return response()->json([
                'success' => true,
                'recorded' => false,
                'backfill_ack' => true,
                'message' => 'Backfill MV=0 — offset SD boleh maju, tidak disimpan ke database.',
            ]);
        }

        MonitoringLiveCache::mergeBackfillChartPoint($machine->id, $chartPoint);

        if (MonitoringLiveCache::shouldAccept($machine->id, $liveData['recorded_at'])) {
            MonitoringLiveCache::put($machine->id, $liveData, recording: true);
        }

        $tsStart = $timestamp->copy()->timezone('Asia/Jakarta')->startOfSecond();
        $duplicate = SensorReading::where('machine_id', $machine->id)
            ->where('recorded_at', '>=', $tsStart)
            ->where('recorded_at', '<', $tsStart->copy()->addSecond())
            ->exists();

        if ($duplicate) {
            $machine->update([
                'last_heartbeat_at' => now(),
                'status' => 'running',
            ]);
            MonitoringBroadcast::tick($machine->id);

            return response()->json([
                'success' => true,
                'recorded' => false,
                'duplicate' => true,
                'backfill_ack' => true,
                'message' => 'Backfill duplikat — reading sudah ada, offset SD boleh maju.',
            ]);
        }

        $session = $this->processSessionService->getOrCreateSession($timestamp, $machine->id);

        if ($session->wasRecentlyCreated) {
            MonitoringLiveCache::mergeBackfillChartPoint($machine->id, $chartPoint);
        }

        SensorReading::create([
            'machine_id' => $machine->id,
            'temperature' => $validated['temperature'],
            'sv' => $validated['sv'] ?? null,
            'pressure' => $validated['pressure'],
            'process_status' => $validated['process_status'] ?? 'running',
            'recorded_at' => $timestamp,
            'process_session_id' => $session->id,
        ]);

        $machine->update([
            'last_heartbeat_at' => now(),
            'status' => 'running',
        ]);

        MonitoringBroadcast::tick($machine->id);

        return response()->json([
            'success' => true,
            'recorded' => true,
            'backfill_ack' => true,
            'message' => 'Backfill reading recorded successfully.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  array<string, mixed>  $chartPoint
     */
    private function persistReading(
        RetortMachine $machine,
        array $validated,
        Carbon $timestamp,
        array $chartPoint
    ): JsonResponse {
        $tsStart = $timestamp->copy()->timezone('Asia/Jakarta')->startOfSecond();
        $duplicate = SensorReading::where('machine_id', $machine->id)
            ->where('recorded_at', '>=', $tsStart)
            ->where('recorded_at', '<', $tsStart->copy()->addSecond())
            ->exists();

        if ($duplicate) {
            $machine->update([
                'last_heartbeat_at' => now(),
                'status' => 'running',
            ]);
            MonitoringBroadcast::tick($machine->id);

            return response()->json([
                'success' => true,
                'recorded' => false,
                'duplicate' => true,
                'message' => 'Reading sudah ada untuk timestamp ini — dilewati.',
            ]);
        }

        $session = $this->processSessionService->getOrCreateSession($timestamp, $machine->id);

        if ($session->wasRecentlyCreated) {
            MonitoringLiveCache::clearChartBuffer($machine->id);
            MonitoringLiveCache::appendChartPoint($machine->id, $chartPoint);
        }

        $reading = SensorReading::create([
            'machine_id' => $machine->id,
            'temperature' => $validated['temperature'],
            'sv' => $validated['sv'] ?? null,
            'pressure' => $validated['pressure'],
            'process_status' => $validated['process_status'] ?? 'running',
            'recorded_at' => $timestamp,
            'process_session_id' => $session->id,
        ]);

        $machine->update([
            'last_heartbeat_at' => now(),
            'status' => 'running',
        ]);

        MonitoringBroadcast::tick($machine->id);

        return response()->json([
            'success' => true,
            'recorded' => true,
            'message' => 'Sensor reading recorded successfully.',
            'data' => [
                'reading' => $reading,
                'session' => [
                    'id' => $session->id,
                    'name' => $session->display_name,
                    'is_new_session' => $session->wasRecentlyCreated,
                ],
            ],
        ]);
    }

    /** Normalisasi P/S dari field ps atau fallback pattern/step (MQTT lama). */
    private function normalizePsField(?string $ps, ?int $pattern, ?int $step): ?string
    {
        if (is_string($ps) && $ps !== '') {
            return $ps;
        }

        if ($pattern !== null || $step !== null) {
            return sprintf('%d-%02d', max(0, $pattern ?? 0), max(0, $step ?? 0));
        }

        return null;
    }
}
