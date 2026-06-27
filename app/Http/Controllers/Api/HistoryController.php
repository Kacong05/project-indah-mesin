<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProcessSession;
use App\Services\F0Calculator;
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
        $sessions = ProcessSession::query()
            ->withCount('sensorReadings')
            ->with(['sensorReadings' => function ($query) {
                $query->orderBy('recorded_at');
            }])
            ->orderByDesc('started_at')
            ->get()
            ->map(function ($session) {
                $readings = $session->sensorReadings;

                // Fase nyata terakhir (3 fase saja): heating/holding/cooling.
                $lastPhase = $readings
                    ->filter(fn ($r) => in_array(
                        strtolower($r->process_status ?? ''),
                        ['heating', 'holding', 'sterilizing', 'cooling'],
                        true
                    ))
                    ->last()?->process_status;

                return [
                    'id' => $session->id,
                    'name' => $session->display_name,
                    'time_range' => $session->time_range,
                    'started_at' => $session->started_at->toIso8601String(),
                    'ended_at' => $session->ended_at?->toIso8601String(),
                    'duration_minutes' => $session->duration_in_minutes,
                    'data_count' => $session->sensor_readings_count,
                    'status' => $session->status,
                    'f0' => F0Calculator::fromReadings($readings),
                    'process_status' => $lastPhase,
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

        // Latest temperature (PV) and SV
        $latestReading = $session->sensorReadings->sortByDesc('recorded_at')->first();
        $latestTemperature = $latestReading ? (float) $latestReading->temperature : null;
        $latestSv = $latestReading && $latestReading->sv !== null ? (float) $latestReading->sv : null;

        // Format data untuk frontend
        $readings = $session->sensorReadings->map(function ($reading) {
            return [
                'id' => $reading->id,
                'recorded_at' => $reading->recorded_at->toIso8601String(),
                'time_formatted' => $reading->recorded_at->timezone('Asia/Jakarta')->format('H:i:s'),
                'sv' => $reading->sv !== null ? (float) $reading->sv : null,
                'temperature' => (float) $reading->temperature,
                'process_status' => $reading->process_status,
            ];
        });

        // Statistik untuk sesi ini
        $stats = [
            'avg_temperature' => $readings->avg('temperature'),
            'min_temperature' => $readings->min('temperature'),
            'max_temperature' => $readings->max('temperature'),
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
                    'latest_temperature' => $latestTemperature,
                    'latest_sv' => $latestSv,
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
            ->orderBy('started_at', 'desc')
            ->first();

        if (! $session) {
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

        $gapThreshold = $validated['gap_threshold'] ?? ProcessSessionService::GAP_THRESHOLD_MINUTES;

        $sessionsCreated = $this->processSessionService->reassignExistingData($gapThreshold);

        return response()->json([
            'success' => true,
            'message' => "Berhasil membuat {$sessionsCreated} sesi dari data yang ada.",
            'data' => [
                'sessions_created' => $sessionsCreated,
            ],
        ]);
    }

    /**
     * GET /api/history/sessions/{id}/export
     * Export data sesi dalam format Excel.
     */
    public function exportSession(Request $request, int $id)
    {
        // getSessionWithReadings() memakai findOrFail() → otomatis 404 bila tak ada.
        $session = $this->processSessionService->getSessionWithReadings($id);

        // Generate filename
        $filename = "Laporan_Sesi_{$session->display_name}_{$session->started_at->format('Ymd_His')}.xlsx";

        // Return JSON data untuk di-export di frontend
        return response()->json([
            'success' => true,
            'data' => [
                'session_name' => $session->display_name,
                'time_range' => $session->time_range,
                'started_at' => $session->started_at->format('Y-m-d H:i:s'),
                'ended_at' => $session->ended_at?->format('Y-m-d H:i:s'),
                'duration_minutes' => $session->duration_in_minutes,
                'readings' => $session->sensorReadings->map(function ($reading) {
                    return [
                        'waktu' => $reading->recorded_at->format('H:i:s'),
                        'sv' => $reading->sv !== null ? number_format($reading->sv, 1, '.', '') : '-',
                        'pv' => number_format($reading->temperature, 1, '.', ''),
                    ];
                })->values()->toArray(),
            ],
            'filename' => $filename,
        ]);
    }
}
