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
     * Default: 1 menit
     */
    protected int $gapThresholdMinutes;

    public function __construct(int $gapThresholdMinutes = 1)
    {
        $this->gapThresholdMinutes = $gapThresholdMinutes;
    }

    /**
     * Dapatkan atau buat sesi proses berdasarkan timestamp data yang masuk.
     * Jika selisih dengan data terakhir mesin yang sama > gapThreshold, buat sesi baru.
     */
    public function getOrCreateSession(Carbon $timestamp, int $machineId): ProcessSession
    {
        $lastReading = SensorReading::where('machine_id', $machineId)
            ->latest('recorded_at')
            ->first();

        if ($lastReading && $lastReading->process_session_id) {
            $lastSession = $lastReading->processSession;

            if ($lastSession && $lastSession->machine_id === $machineId) {
                $diffInMinutes = $lastReading->recorded_at->diffInMinutes($timestamp);

                if ($diffInMinutes < $this->gapThresholdMinutes) {
                    $lastSession->update([
                        'ended_at' => $timestamp,
                        'data_count' => $lastSession->data_count + 1,
                    ]);

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

            $processNumber = ProcessSession::where('machine_id', $machineId)->count() + 1;

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
                    $lastReadingInSession = $currentSession->sensorReadings()
                        ->latest('recorded_at')
                        ->first();

                    if ($lastReadingInSession) {
                        $diffInMinutes = $lastReadingInSession->recorded_at->diffInMinutes($timestamp);

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
        $query = ProcessSession::withCount('sensorReadings')->latest('started_at');

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
}
