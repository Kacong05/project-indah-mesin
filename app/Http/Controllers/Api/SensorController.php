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
            'recorded_at' => 'required|date',
            'logging' => 'nullable|boolean',
        ]);

        $machine = RetortMachine::where('machine_code', $validated['machine_code'])->first();

        // Parse timestamp dari ESP — wajib untuk akurasi history (bukan now() server).
        $timestamp = Carbon::parse($validated['recorded_at'])->timezone('Asia/Jakarta');

        // ============================================
        // GATE PEREKAMAN: hanya simpan ke database saat katup terbuka (MV > 0).
        // MV <= 0 → data tetap masuk web (PV/SV live via cache), tidak dibuat sesi/reading.
        // MV null → perilaku lama (tetap simpan) agar klien lama kompatibel.
        // ============================================
        $mv = isset($validated['mv']) ? (float) $validated['mv'] : null;
        $logging = (bool) ($validated['logging'] ?? false);

        $liveData = [
            'temperature' => (float) $validated['temperature'],
            'sv' => isset($validated['sv']) ? (float) $validated['sv'] : null,
            'mv' => $mv ?? 0.0,
            'pressure' => (float) $validated['pressure'],
            'process_status' => $validated['process_status'] ?? 'idle',
            'recorded_at' => $timestamp->copy()->timezone('Asia/Jakarta')->toIso8601String(),
        ];

        // Simpan bila MV > 0 ATAU sesi rekam aktif (logging=true dari ESP/SD).
        // MV=0 sesaat di holding tidak boleh membuat detik hilang di history.
        $valveOpen = $mv === null || $mv > 0 || $logging;

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

        // Cegah duplikat: 1 mesin = 1 reading per detik (recorded_at dari ESP).
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

        // ============================================
        // LOGIKA UTAMA: Dapatkan atau buat sesi proses (katup terbuka / logging)
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
