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
     * Default: 10 menit
     */
    protected int $gapThresholdMinutes;

    public function __construct(int $gapThresholdMinutes = 10)
    {
        $this->gapThresholdMinutes = $gapThresholdMinutes;
    }

    /**
     * Dapatkan atau buat sesi proses berdasarkan timestamp data yang masuk.
     * Jika selisih dengan data terakhir > gapThreshold, buat sesi baru.
     *
     * @param Carbon $timestamp Timestamp dari perangkat ESP
     * @return ProcessSession
     */
    public function getOrCreateSession(Carbon $timestamp): ProcessSession
    {
        // Cari data terakhir dari machine/device yang sama (jika ada filter machine)
        $lastReading = SensorReading::latest('recorded_at')->first();

        if ($lastReading && $lastReading->process_session_id) {
            $lastSession = $lastReading->processSession;

            // Hitung selisih waktu dengan data terakhir
            $diffInMinutes = $lastReading->recorded_at->diffInMinutes($timestamp);

            // Jika jeda kurang dari threshold, return sesi yang sama
            if ($diffInMinutes < $this->gapThresholdMinutes) {
                // Update ended_at sesi aktif ini
                $lastSession->update([
                    'ended_at' => $timestamp,
                    'data_count' => $lastSession->data_count + 1,
                ]);

                return $lastSession;
            }
        }

        // Jeda >= threshold, buat sesi baru
        return $this->createNewSession($timestamp);
    }

    /**
     * Buat sesi baru.
     *
     * @param Carbon $timestamp
     * @return ProcessSession
     */
    public function createNewSession(Carbon $timestamp): ProcessSession
    {
        return DB::transaction(function () use ($timestamp) {
            // Tutup sesi aktif sebelumnya (jika ada)
            ProcessSession::active()->update(['status' => 'completed']);

            // Hitung nomor proses
            $processNumber = ProcessSession::count() + 1;

            // Buat sesi baru
            $session = ProcessSession::create([
                'name' => "Proses {$processNumber}",
                'started_at' => $timestamp,
                'ended_at' => $timestamp,
                'data_count' => 1,
                'status' => 'active',
            ]);

            return $session;
        });
    }

    /**
     * Tutup sesi yang sedang aktif.
     *
     * @return void
     */
    public function closeActiveSession(): void
    {
        ProcessSession::active()->update(['status' => 'completed']);
    }

    /**
     * Re-assign semua data sensor yang belum punya process_session_id.
     * Berguna untuk data yang sudah ada sebelum migrasi.
     *
     * @param int|null $gapThreshold Override threshold (dalam menit)
     * @return int Jumlah sesi yang dibuat
     */
    public function reassignExistingData(?int $gapThreshold = null): int
    {
        $threshold = $gapThreshold ?? $this->gapThresholdMinutes;

        $sessionsCreated = 0;
        $currentSession = null;

        // Ambil semua data yang belum punya sesi, urut berdasarkan recorded_at
        $readingsWithoutSession = SensorReading::whereNull('process_session_id')
            ->orderBy('recorded_at')
            ->get();

        foreach ($readingsWithoutSession as $reading) {
            $timestamp = Carbon::parse($reading->recorded_at);

            if (!$currentSession) {
                // Buat sesi pertama
                $currentSession = $this->createNewSession($timestamp);
                $sessionsCreated++;
            } else {
                // Hitung selisih dengan data terakhir di sesi ini
                $lastReadingInSession = $currentSession->sensorReadings()->latest('recorded_at')->first();

                if ($lastReadingInSession) {
                    $diffInMinutes = $lastReadingInSession->recorded_at->diffInMinutes($timestamp);

                    if ($diffInMinutes >= $threshold) {
                        // Buat sesi baru
                        $currentSession->update(['status' => 'completed']);
                        $currentSession = $this->createNewSession($timestamp);
                        $sessionsCreated++;
                    }
                }
            }

            // Assign reading ke sesi saat ini
            $reading->update(['process_session_id' => $currentSession->id]);
            $currentSession->increment('data_count');
            $currentSession->update(['ended_at' => $timestamp]);
        }

        // Tutup sesi terakhir jika masih aktif
        if ($currentSession && $currentSession->status === 'active') {
            $currentSession->update(['status' => 'completed']);
        }

        return $sessionsCreated;
    }

    /**
     * Dapatkan daftar semua sesi dengan metadata.
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getAllSessions()
    {
        return ProcessSession::withCount('sensorReadings')
            ->latest('started_at')
            ->get();
    }

    /**
     * Dapatkan detail satu sesi termasuk data sensornya.
     *
     * @param int $sessionId
     * @return ProcessSession
     */
    public function getSessionWithReadings(int $sessionId): ProcessSession
    {
        return ProcessSession::with(['sensorReadings' => function ($query) {
            $query->orderBy('recorded_at');
        }])->findOrFail($sessionId);
    }

    /**
     * Set threshold untuk pengujian.
     *
     * @param int $minutes
     * @return self
     */
    public function setGapThreshold(int $minutes): self
    {
        $this->gapThresholdMinutes = $minutes;
        return $this;
    }
}
