<?php

namespace App\Services;

use App\Models\ProcessSession;
use App\Models\SensorReading;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ProcessSessionService
{
    /**
     * Waktu jeda minimum (dalam menit) untuk dianggap sesi baru.
     * ESP mengirim timestamp tiap data; gap ≥ 3 menit = proses baru.
     */
    public const GAP_THRESHOLD_MINUTES = 3;

    protected int $gapThresholdMinutes;

    public function __construct(int $gapThresholdMinutes = self::GAP_THRESHOLD_MINUTES)
    {
        $this->gapThresholdMinutes = $gapThresholdMinutes;
    }

    /**
     * Dapatkan atau buat sesi proses berdasarkan timestamp data yang masuk.
     * Jika selisih dengan data terakhir mesin yang sama > gapThreshold, buat sesi baru.
     */
    public function getOrCreateSession(Carbon $timestamp, int $machineId): ProcessSession
    {
        // Gunakan orderByDesc yang stabil: recorded_at DESC, id DESC
        // Ini penting untuk menghindari race condition saat data masuk bersamaan
        $lastReading = SensorReading::where('machine_id', $machineId)
            ->orderByDesc('recorded_at')
            ->orderByDesc('id')
            ->first();

        if ($lastReading && $lastReading->process_session_id) {
            $lastSession = $lastReading->processSession;

            if ($lastSession && $lastSession->machine_id === $machineId) {
                $diffInMinutes = abs($lastReading->recorded_at->diffInSeconds($timestamp)) / 60;

                if ($diffInMinutes < $this->gapThresholdMinutes) {
                    // Update ended_at langsung dari recorded_at data terbaru
                    // untuk akurasi timestamp perangkat ESP. data_count di-increment
                    // atomik agar jumlah data sesi akurat (sebelumnya tak pernah naik).
                    $lastSession->update(['ended_at' => $timestamp]);
                    $lastSession->increment('data_count');

                    return $lastSession;
                }
            }
        }

        return $this->createNewSession($timestamp, $machineId);
    }

    /**
     * Buat sesi baru untuk mesin tertentu.
     */
    public function createNewSession(Carbon $timestamp, int $machineId): ProcessSession
    {
        return DB::transaction(function () use ($timestamp, $machineId) {
            ProcessSession::where('machine_id', $machineId)
                ->active()
                ->update(['status' => 'completed']);

            // Nomor proses di-reset per hari (lihat ProcessSession::display_name).
            $processNumber = ProcessSession::where('machine_id', $machineId)
                ->whereDate('started_at', $timestamp->toDateString())
                ->count() + 1;

            return ProcessSession::create([
                'machine_id' => $machineId,
                'name' => "Proses {$processNumber}",
                'started_at' => $timestamp,
                'ended_at' => $timestamp,
                'data_count' => 1,
                'status' => 'active',
            ]);
        });
    }

    /**
     * Tutup sesi aktif. Jika machineId diberikan, hanya untuk mesin tersebut.
     */
    public function closeActiveSession(?int $machineId = null): void
    {
        $query = ProcessSession::active();

        if ($machineId !== null) {
            $query->where('machine_id', $machineId);
        }

        $query->update(['status' => 'completed']);
    }

    /**
     * Re-assign data sensor yang belum punya process_session_id, per mesin.
     */
    public function reassignExistingData(?int $gapThreshold = null): int
    {
        $threshold = $gapThreshold ?? $this->gapThresholdMinutes;
        $sessionsCreated = 0;

        $machineIds = SensorReading::whereNull('process_session_id')
            ->distinct()
            ->pluck('machine_id')
            ->filter();

        foreach ($machineIds as $machineId) {
            $readings = SensorReading::whereNull('process_session_id')
                ->where('machine_id', $machineId)
                ->orderBy('recorded_at')
                ->get();

            $currentSession = null;

            foreach ($readings as $reading) {
                $timestamp = Carbon::parse($reading->recorded_at);
                $shouldCreateNewSession = false;

                if ($currentSession === null) {
                    $shouldCreateNewSession = true;
                } else {
                    // Gunakan orderBy yang stabil untuk mendapatkan data terakhir
                    $lastReadingInSession = $currentSession->sensorReadings()
                        ->orderByDesc('recorded_at')
                        ->orderByDesc('id')
                        ->first();

                    if ($lastReadingInSession) {
                        $diffInMinutes = abs($lastReadingInSession->recorded_at->diffInSeconds($timestamp)) / 60;

                        if ($diffInMinutes >= $threshold) {
                            $currentSession->update(['status' => 'completed']);
                            $shouldCreateNewSession = true;
                        }
                    }
                }

                if ($shouldCreateNewSession) {
                    $currentSession = $this->createNewSession($timestamp, $machineId);
                    $sessionsCreated++;
                }

                $reading->update(['process_session_id' => $currentSession->id]);

                if (!$shouldCreateNewSession) {
                    $currentSession->update([
                        'ended_at' => $timestamp,
                        'data_count' => $currentSession->data_count + 1,
                    ]);
                } else {
                    $currentSession->update(['ended_at' => $timestamp]);
                }
            }

            if ($currentSession && $currentSession->status === 'active') {
                $currentSession->update(['status' => 'completed']);
            }
        }

        return $sessionsCreated;
    }

    /**
     * Dapatkan daftar sesi, opsional difilter per mesin.
     */
    public function getAllSessions(?int $machineId = null)
    {
        $query = ProcessSession::withCount('sensorReadings')->orderBy('started_at', 'desc');

        if ($machineId !== null) {
            $query->where('machine_id', $machineId);
        }

        return $query->get();
    }

    /**
     * Dapatkan detail satu sesi termasuk data sensornya.
     */
    public function getSessionWithReadings(int $sessionId): ProcessSession
    {
        return ProcessSession::with(['sensorReadings' => function ($query) {
            $query->orderBy('recorded_at');
        }])->findOrFail($sessionId);
    }

    public function setGapThreshold(int $minutes): self
    {
        $this->gapThresholdMinutes = $minutes;

        return $this;
    }

    /**
     * Fix ended_at untuk semua sesi yang aktif berdasarkan data reading terakhir.
     * Ini berguna untuk memperbaiki data yang ended_at-nya tidak ter-update.
     */
    public function fixSessionsEndedAt(): int
    {
        $fixed = 0;

        $sessions = ProcessSession::where('status', 'active')
            ->orWhereNull('ended_at')
            ->with(['sensorReadings' => function ($query) {
                $query->orderByDesc('recorded_at')->orderByDesc('id')->limit(1);
            }])
            ->get();

        foreach ($sessions as $session) {
            $lastReading = $session->sensorReadings->first();

            if ($lastReading && $lastReading->recorded_at) {
                $session->update(['ended_at' => $lastReading->recorded_at]);
                $fixed++;
            }
        }

        return $fixed;
    }
}
