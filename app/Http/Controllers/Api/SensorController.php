<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alarm;
use App\Models\RetortMachine;
use App\Models\SensorReading;
use App\Services\ProcessSessionService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class SensorController extends Controller
{
    // Target suhu normal sterilisasi retort
    const TARGET_TEMP = 121.0;
    const TEMP_TOLERANCE = 5.0;   // ±5°C dari target
    const WARMUP_THRESHOLD = 100.0; // Suhu di atas ini dianggap sudah selesai warm-up

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
            'sv' => 'nullable|numeric', // SV dari alat ESP
            'pressure' => 'required|numeric',
            'process_status' => 'nullable|string',
            'recorded_at' => 'nullable|date', // Timestamp dari ESP
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
            'sv' => $validated['sv'] ?? null, // SV dari alat ESP
            'pressure' => $validated['pressure'],
            'process_status' => $validated['process_status'] ?? 'running',
            'recorded_at' => $timestamp,
            'process_session_id' => $session->id, // Link ke sesi proses
        ]);

        // Update machine heartbeat & status
        $machine->update([
            'last_heartbeat_at' => now(),
            'status' => 'running',
        ]);

        // --- Alarm Logic ---
        $this->checkTemperatureAlarm($machine, $validated['temperature'], $session, $timestamp);

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

    private function checkTemperatureAlarm(RetortMachine $machine, float $temperature, \App\Models\ProcessSession $session, Carbon $timestamp): void
    {
        $high = self::TARGET_TEMP + self::TEMP_TOLERANCE; // 126°C
        $low = self::TARGET_TEMP - self::TEMP_TOLERANCE; // 116°C

        // Lewati alarm suhu rendah selama fase warm-up (belum pernah mencapai 100°C)
        $hasReachedWarmup = SensorReading::where('machine_id', $machine->id)
            ->where('temperature', '>=', self::WARMUP_THRESHOLD)
            ->exists()
            || $temperature >= self::WARMUP_THRESHOLD;

        // Cek apakah sudah ada alarm aktif untuk kondisi yang sama (hindari duplikat)
        $hasActiveHigh = Alarm::where('machine_id', $machine->id)
            ->where('type', Alarm::TYPE_HIGH_TEMPERATURE)
            ->where('status', Alarm::STATUS_ACTIVE)
            ->exists();

        $hasActiveLow = Alarm::where('machine_id', $machine->id)
            ->where('type', 'low_temperature')
            ->where('status', Alarm::STATUS_ACTIVE)
            ->exists();

        if ($temperature > $high && !$hasActiveHigh) {
            // Suhu terlalu tinggi
            Alarm::create([
                'machine_id' => $machine->id,
                'type' => Alarm::TYPE_HIGH_TEMPERATURE,
                'severity' => $temperature > ($high + 5) ? Alarm::SEVERITY_CRITICAL : Alarm::SEVERITY_WARNING,
                'message' => "Suhu terlalu tinggi: {$temperature}°C (Batas: {$high}°C). Target normal: " . self::TARGET_TEMP . "°C.",
                'metadata' => [
                    'temperature' => $temperature,
                    'target' => self::TARGET_TEMP,
                    'limit_high' => $high,
                    'machine_code' => $machine->machine_code,
                ],
                'status' => Alarm::STATUS_ACTIVE,
                'triggered_at' => now(),
            ]);
        }

        if ($temperature < $low && !$hasActiveLow) {
            if (!$hasReachedWarmup) {
                return;
            }

            // Suhu terlalu rendah (setelah warm-up selesai = drop tidak normal)
            Alarm::create([
                'machine_id' => $machine->id,
                'type' => 'low_temperature',
                'severity' => Alarm::SEVERITY_WARNING,
                'message' => "Suhu terlalu rendah: {$temperature}°C (Batas: {$low}°C). Target normal: " . self::TARGET_TEMP . "°C.",
                'metadata' => [
                    'temperature' => $temperature,
                    'target' => self::TARGET_TEMP,
                    'limit_low' => $low,
                    'machine_code' => $machine->machine_code,
                ],
                'status' => Alarm::STATUS_ACTIVE,
                'triggered_at' => now(),
            ]);
        }

        // Auto-resolve alarm HIGH jika suhu sudah kembali normal
        if ($temperature <= $high && $hasActiveHigh) {
            Alarm::where('machine_id', $machine->id)
                ->where('type', Alarm::TYPE_HIGH_TEMPERATURE)
                ->where('status', Alarm::STATUS_ACTIVE)
                ->update(['status' => Alarm::STATUS_RESOLVED, 'resolved_at' => now()]);
        }

        // Auto-resolve alarm LOW jika suhu sudah kembali normal
        if ($temperature >= $low && $hasActiveLow) {
            Alarm::where('machine_id', $machine->id)
                ->where('type', 'low_temperature')
                ->where('status', Alarm::STATUS_ACTIVE)
                ->update(['status' => Alarm::STATUS_RESOLVED, 'resolved_at' => now()]);
        }
    }
}
