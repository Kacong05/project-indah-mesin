<?php

namespace Database\Seeders;

use App\Models\ProcessSession;
use App\Models\RetortMachine;
use App\Models\SensorReading;
use App\Services\F0Calculator;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seed satu sesi proses retort lengkap (CUT → holding → cooling) dengan
 * data time series suhu per menit pada coldest spot.
 *
 * Profil (default mulai 12:00 hari ini, interval 1 menit):
 *   - CUT / come-up (heating)   : 12:00 (40°C)   → 12:30 (121°C)   = 30 menit
 *   - Holding / sterilizing      : 12:31 (121.0°C) → 12:40 (121.1°C) = 10 menit
 *   - Cooling                    : 12:41 (119°C)  → 13:20 (60°C)    = 40 menit
 *
 * F₀ dihitung otomatis (trapezoidal) lalu ditampilkan saat seeding.
 */
class RetortProcessSeeder extends Seeder
{
    /** Setpoint sterilisasi (°C). */
    private const SV_STERILIZE = 121.1;

    /** Interval sampling (detik). */
    private const INTERVAL_SECONDS = 60;

    public function run(): void
    {
        $machine = RetortMachine::firstOrCreate(
            ['machine_code' => 'RT-001'],
            [
                'name' => 'Mesin Retort Utama',
                'location' => 'Area Produksi 1',
                'status' => RetortMachine::STATUS_RUNNING,
                'last_heartbeat_at' => now(),
            ]
        );

        // Basis waktu: hari ini pukul 12:00 (zona waktu aplikasi: Asia/Jakarta).
        $start = Carbon::today(config('app.timezone'))->setTime(12, 0, 0);

        $rows = $this->buildProfile($start);

        $startedAt = $rows[0]['recorded_at'];
        $endedAt = end($rows)['recorded_at'];

        $session = ProcessSession::create([
            'machine_id' => $machine->id,
            'name' => 'Proses Sterilisasi (Dummy)',
            'started_at' => $startedAt,
            'ended_at' => $endedAt,
            'data_count' => count($rows),
            'status' => 'completed',
        ]);

        $now = now();
        $records = array_map(function (array $row) use ($machine, $session, $now) {
            return [
                'machine_id' => $machine->id,
                'process_session_id' => $session->id,
                'temperature' => $row['temperature'],
                'sv' => $row['sv'],
                'pressure' => $row['pressure'],
                'process_status' => $row['process_status'],
                'recorded_at' => $row['recorded_at'],
                'created_at' => $now,
            ];
        }, $rows);

        foreach (array_chunk($records, 200) as $chunk) {
            SensorReading::insert($chunk);
        }

        // --- Tambahan: Masukkan data seed ke Cache Monitoring agar langsung tampil di halaman Monitoring ---
        // 1. Update heartbeat & status mesin agar dianggap Online/Active
        $machine->update([
            'last_heartbeat_at' => now(),
            'status' => RetortMachine::STATUS_RUNNING,
        ]);

        // 2. Kosongkan chart buffer live cache lama
        \App\Services\MonitoringLiveCache::clearChartBuffer($machine->id);

        // 3. Masukkan seluruh data point ke buffer chart live cache
        foreach ($rows as $row) {
            \App\Services\MonitoringLiveCache::appendChartPoint($machine->id, [
                'temperature' => (float) $row['temperature'],
                'sv' => (float) $row['sv'],
                'process_status' => $row['process_status'],
                'recorded_at' => $row['recorded_at']->copy()->timezone('Asia/Jakarta')->toIso8601String(),
            ]);
        }

        // 4. Masukkan data point terakhir sebagai snapshot live data saat ini
        $lastRow = end($rows);
        \App\Services\MonitoringLiveCache::put($machine->id, [
            'temperature' => (float) $lastRow['temperature'],
            'sv' => (float) $lastRow['sv'],
            'mv' => $lastRow['process_status'] === SensorReading::STATUS_COOLING ? 0.0 : 100.0,
            'pressure' => (float) $lastRow['pressure'],
            'process_status' => $lastRow['process_status'],
            'recorded_at' => $lastRow['recorded_at']->copy()->timezone('Asia/Jakarta')->toIso8601String(),
            'ps' => '1-03',
            'pattern' => 1,
            'step' => 3,
            'timer_tot' => '80:00',
            'timer_stp' => '40:00',
        ], recording: true);

        // 5. Trigger broadcast tick agar halaman web terupdate
        \App\Services\MonitoringBroadcast::tick($machine->id);
        // --------------------------------------------------------------------------------------------------

        // Hitung & laporkan F₀ untuk verifikasi.
        $readings = $session->sensorReadings()->orderBy('recorded_at')->get();
        $f0 = F0Calculator::fromReadings($readings);

        $this->command?->info(sprintf(
            'RetortProcessSeeder: sesi #%d "%s" — %d readings (%s → %s), F0 = %s (%s)',
            $session->id,
            $session->name,
            count($rows),
            $startedAt->format('H:i'),
            $endedAt->format('H:i'),
            $f0,
            ($f0 ?? 0) >= 6 ? 'PASS' : 'FAIL'
        ));
    }

    /**
     * Bangun deret data per menit untuk ketiga fase.
     *
     * @return array<int, array{recorded_at: Carbon, temperature: float, sv: float, pressure: float, process_status: string}>
     */
    private function buildProfile(Carbon $start): array
    {
        $rows = [];
        $minute = 0;

        // 1) CUT / come-up time: 40°C → 121°C selama 30 menit (menit 0..30).
        for ($m = 0; $m <= 30; $m++) {
            $temp = 40 + (121 - 40) * ($m / 30);
            $rows[] = $this->makeRow(
                $start,
                $minute++,
                round($temp, 1),
                self::SV_STERILIZE,
                SensorReading::STATUS_HEATING,
            );
        }

        // 2) Holding / sterilizing: berosilasi 121.0–121.1°C selama 10 menit.
        for ($m = 1; $m <= 10; $m++) {
            $temp = ($m % 2 === 0) ? 121.1 : 121.0;
            $rows[] = $this->makeRow(
                $start,
                $minute++,
                $temp,
                self::SV_STERILIZE,
                SensorReading::STATUS_STERILIZING,
            );
        }

        // 3) Cooling: 119°C → 60°C selama 40 menit.
        $coolMinutes = 40;
        for ($m = 1; $m <= $coolMinutes; $m++) {
            $temp = 119 + (60 - 119) * (($m - 1) / ($coolMinutes - 1));
            $rows[] = $this->makeRow(
                $start,
                $minute++,
                round($temp, 1),
                40.0,
                SensorReading::STATUS_COOLING,
            );
        }

        return $rows;
    }

    /**
     * @return array{recorded_at: Carbon, temperature: float, sv: float, pressure: float, process_status: string}
     */
    private function makeRow(Carbon $start, int $minuteOffset, float $temperature, float $sv, string $status): array
    {
        return [
            'recorded_at' => $start->copy()->addSeconds($minuteOffset * self::INTERVAL_SECONDS),
            'temperature' => $temperature,
            'sv' => $sv,
            'pressure' => $this->pressureFor($temperature),
            'process_status' => $status,
        ];
    }

    /**
     * Tekanan plausibel mengikuti suhu (1.0 bar @ 40°C → ~2.2 bar @ 121°C).
     */
    private function pressureFor(float $temperature): float
    {
        $p = 1.0 + (max($temperature, 40.0) - 40.0) / (121.0 - 40.0) * 1.2;

        return round(min(max($p, 1.0), 2.3), 3);
    }
}
