<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProcessSession;
use App\Services\ProcessSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HistoryController extends Controller
{
    private ProcessSessionService $processSessionService;

    public function __construct(ProcessSessionService $processSessionService)
    {
        $this->processSessionService = $processSessionService;
    }

    /**
     * GET /api/history/sessions
     * Mendapatkan daftar semua sesi proses.
     */
    public function sessions(Request $request): JsonResponse
    {
        $sessions = ProcessSession::withCount('sensorReadings')
            ->latest('started_at')
            ->get()
            ->map(function ($session) {
                return [
                    'id' => $session->id,
                    'name' => $session->display_name,
                    'time_range' => $session->time_range,
                    'started_at' => $session->started_at->toIso8601String(),
                    'ended_at' => $session->ended_at?->toIso8601String(),
                    'duration_minutes' => $session->duration_in_minutes,
                    'data_count' => $session->sensor_readings_count,
                    'status' => $session->status,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $sessions,
        ]);
    }

    /**
     * GET /api/history/sessions/{id}
     * Mendapatkan detail satu sesi beserta data sensor.
     */
    public function sessionDetail(Request $request, int $id): JsonResponse
    {
        $session = $this->processSessionService->getSessionWithReadings($id);

        // Format data untuk frontend
        $readings = $session->sensorReadings->map(function ($reading) {
            return [
                'id' => $reading->id,
                'recorded_at' => $reading->recorded_at->toIso8601String(),
                'time_formatted' => $reading->recorded_at->format('H:i:s'),
                'temperature' => (float) $reading->temperature,
                'pressure' => (float) $reading->pressure,
                'process_status' => $reading->process_status,
                'machine' => $reading->machine ? [
                    'id' => $reading->machine->id,
                    'name' => $reading->machine->name,
                    'machine_code' => $reading->machine->machine_code,
                ] : null,
            ];
        });

        // Statistik untuk sesi ini
        $stats = [
            'avg_temperature' => $readings->avg('temperature'),
            'min_temperature' => $readings->min('temperature'),
            'max_temperature' => $readings->max('temperature'),
            'avg_pressure' => $readings->avg('pressure'),
            'min_pressure' => $readings->min('pressure'),
            'max_pressure' => $readings->max('pressure'),
            'total_readings' => $readings->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'session' => [
                    'id' => $session->id,
                    'name' => $session->display_name,
                    'time_range' => $session->time_range,
                    'started_at' => $session->started_at->toIso8601String(),
                    'ended_at' => $session->ended_at?->toIso8601String(),
                    'duration_minutes' => $session->duration_in_minutes,
                    'status' => $session->status,
                ],
                'stats' => $stats,
                'readings' => $readings,
            ],
        ]);
    }

    /**
     * GET /api/history/latest
     * Mendapatkan sesi terbaru.
     */
    public function latestSession(Request $request): JsonResponse
    {
        $session = ProcessSession::withCount('sensorReadings')
            ->latest('started_at')
            ->first();

        if (!$session) {
            return response()->json([
                'success' => true,
                'data' => null,
                'message' => 'Belum ada data sesi',
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $session->id,
                'name' => $session->display_name,
                'time_range' => $session->time_range,
                'data_count' => $session->sensor_readings_count,
                'status' => $session->status,
            ],
        ]);
    }

    /**
     * POST /api/history/reassign
     * Re-assign data lama yang belum punya sesi.
     * Endpoint untuk migrasi/fixing.
     */
    public function reassignData(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gap_threshold' => 'nullable|integer|min:1|max:60',
        ]);

        $gapThreshold = $validated['gap_threshold'] ?? 10;

        $sessionsCreated = $this->processSessionService->reassignExistingData($gapThreshold);

        return response()->json([
            'success' => true,
            'message' => "Berhasil membuat {$sessionsCreated} sesi dari data yang ada.",
            'data' => [
                'sessions_created' => $sessionsCreated,
            ],
        ]);
    }
}
