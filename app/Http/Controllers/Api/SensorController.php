<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alarm;
use App\Models\RetortMachine;
use App\Models\SensorReading;
use Illuminate\Http\Request;

class SensorController extends Controller
{
    // Target suhu normal sterilisasi retort
    const TARGET_TEMP = 121.0;
    const TEMP_TOLERANCE = 5.0;   // ±5°C dari target
    const WARMUP_THRESHOLD = 100.0; // Suhu di atas ini dianggap sudah selesai warm-up

    public function store(Request $request)
    {
        $validated = $request->validate([
            'machine_code' => 'required|string|exists:retort_machines,machine_code',
            'temperature' => 'required|numeric',
            'pressure' => 'required|numeric',
            'process_status' => 'nullable|string',
            'recorded_at' => 'nullable|date',
        ]);

        $machine = RetortMachine::where('machine_code', $validated['machine_code'])->first();

        // Save reading
        $reading = SensorReading::create([
            'machine_id' => $machine->id,
            'temperature' => $validated['temperature'],
            'pressure' => $validated['pressure'],
            'process_status' => $validated['process_status'] ?? 'running',
            'recorded_at' => $validated['recorded_at'] ?? now(),
        ]);

        // Update machine heartbeat & status
        $machine->update([
            'last_heartbeat_at' => now(),
            'status' => 'running',
        ]);

        // --- Alarm Logic ---
        $this->checkTemperatureAlarm($machine, $validated['temperature']);

        return response()->json([
            'success' => true,
            'message' => 'Sensor reading recorded successfully.',
            'data' => $reading,
        ]);
    }

    private function checkTemperatureAlarm(RetortMachine $machine, float $temperature): void
    {
        $high = self::TARGET_TEMP + self::TEMP_TOLERANCE; // 126°C
        $low = self::TARGET_TEMP - self::TEMP_TOLERANCE; // 116°C

        // Cek apakah mesin sudah melewati fase warm-up:
        // Warm-up = suhu sebelumnya BELUM PERNAH mencapai WARMUP_THRESHOLD
        // Jika belum ada riwayat di atas threshold, ini masih fase pemanasan → skip alarm
        $hasReachedNormal = SensorReading::where('machine_id', $machine->id)
            ->where('temperature', '>=', self::WARMUP_THRESHOLD)
            ->where('id', '!=', SensorReading::where('machine_id', $machine->id)->latest()->value('id'))
            ->exists();

        if (!$hasReachedNormal) {
            // Mesin masih dalam fase warm-up, tidak perlu alarm
            return;
        }

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
