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
            'mv' => 'nullable|numeric',
            'pressure' => 'required|numeric',
            'process_status' => 'nullable|string',
            'recorded_at' => 'nullable|date',
            'logging' => 'nullable|boolean',
        ]);

        $machine = RetortMachine::where('machine_code', $validated['machine_code'])->first();

        // Parse timestamp dari ESP, atau pakai waktu server jika tidak ada
        $timestamp = isset($validated['recorded_at'])
            ? Carbon::parse($validated['recorded_at'])
            : now();

        // ============================================
        // GATE PEREKAMAN: hanya simpan ke database saat katup terbuka (MV > 0).
        // MV <= 0 → data tetap masuk web (PV/SV live via cache), tidak dibuat sesi/reading.
        // MV null → perilaku lama (tetap simpan) agar klien lama kompatibel.
        // ============================================
        $mv = isset($validated['mv']) ? (float) $validated['mv'] : null;

        $liveData = [
            'temperature' => (float) $validated['temperature'],
            'sv' => isset($validated['sv']) ? (float) $validated['sv'] : null,
            'mv' => $mv ?? 0.0,
            'pressure' => (float) $validated['pressure'],
            'process_status' => $validated['process_status'] ?? 'idle',
            'recorded_at' => $timestamp->toIso8601String(),
        ];

        $valveOpen = $mv === null || $mv > 0;

        if (! $valveOpen) {
            $machine->update([
                'last_heartbeat_at' => now(),
                'status' => RetortMachine::STATUS_STANDBY,
            ]);

            MonitoringLiveCache::put($machine->id, $liveData, recording: false);
            MonitoringBroadcast::tick($machine->id);

            return response()->json([
                'success' => true,
                'recorded' => false,
                'live' => true,
                'message' => 'MV <= 0 (katup tertutup) — PV/SV ditampilkan di web, tidak disimpan ke database.',
            ]);
        }

        MonitoringLiveCache::put($machine->id, $liveData, recording: true);

        // ============================================
        // LOGIKA UTAMA: Dapatkan atau buat sesi proses (katup terbuka)
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
}
