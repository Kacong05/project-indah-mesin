<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RetortMachine;
use App\Models\SensorReading;
use App\Services\ProcessSessionService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class SensorController extends Controller
{
    private ProcessSessionService $processSessionService;

    public function __construct(ProcessSessionService $processSessionService)
    {
        $this->processSessionService = $processSessionService;
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'machine_code' => 'required|string|exists:retort_machines,machine_code',
            'temperature' => 'required|numeric',
            'sv' => 'nullable|numeric',
            'pressure' => 'required|numeric',
            'process_status' => 'nullable|string',
            'recorded_at' => 'nullable|date',
        ]);

        $machine = RetortMachine::where('machine_code', $validated['machine_code'])->first();

        // Parse timestamp dari ESP, atau pakai waktu server jika tidak ada
        $timestamp = isset($validated['recorded_at'])
            ? Carbon::parse($validated['recorded_at'])
            : now();

        // ============================================
        // LOGIKA UTAMA: Dapatkan atau buat sesi proses
        // ============================================
        $session = $this->processSessionService->getOrCreateSession($timestamp, $machine->id);

        // Save reading dengan link ke sesi
        $reading = SensorReading::create([
            'machine_id' => $machine->id,
            'temperature' => $validated['temperature'],
            'sv' => $validated['sv'] ?? null,
            'pressure' => $validated['pressure'],
            'process_status' => $validated['process_status'] ?? 'running',
            'recorded_at' => $timestamp,
            'process_session_id' => $session->id,
        ]);

        // Update machine heartbeat & status
        $machine->update([
            'last_heartbeat_at' => now(),
            'status' => 'running',
        ]);

        return response()->json([
            'success' => true,
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
}
