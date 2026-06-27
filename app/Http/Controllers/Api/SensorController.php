<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RetortMachine;
use App\Models\SensorReading;
use App\Services\MonitoringBroadcast;
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
        // GATE PEREKAMAN: hanya simpan saat katup terbuka (MV > 0).
        // MV = 0 berarti mesin idle / proses selesai, sehingga data ambient
        // tidak boleh membuat sesi & reading baru di database. Mesin tetap
        // dianggap online (heartbeat) namun statusnya standby.
        // Catatan: bila MV tidak dikirim (null), perilaku lama dipertahankan
        // agar klien lama tetap kompatibel.
        // ============================================
        $mv = isset($validated['mv']) ? (float) $validated['mv'] : null;
        $logging = (bool) ($validated['logging'] ?? false);

        // Simpan bila MV > 0 ATAU sesi perekaman aktif (logging=true dari ESP).
        // MV=0 sesaat di fase holding tidak boleh membuat detik hilang di web
        // selama SD lokal tetap merekam baris tersebut.
        if ($mv !== null && $mv <= 0 && ! $logging) {
            $machine->update([
                'last_heartbeat_at' => now(),
                'status' => RetortMachine::STATUS_STANDBY,
            ]);

            MonitoringBroadcast::tick($machine->id);

            return response()->json([
                'success' => true,
                'recorded' => false,
                'message' => 'MV <= 0 (mesin idle) — data tidak disimpan.',
            ]);
        }

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
