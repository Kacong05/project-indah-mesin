<?php

namespace App\Http\Controllers;

use App\Models\RetortMachine;
use App\Models\SensorReading;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $machine = $request->user()->machine;
        $today = Carbon::today();

        // Latest Reading
        $latestReading = $machine ? SensorReading::where('machine_id', $machine->id)->latest()->first() : null;

        return Inertia::render('Dashboard', [
            'machineName' => $machine ? $machine->name : 'Mesin Belum Ditetapkan',
            'machineCode' => $machine?->machine_code,
            'stats' => $this->getMachineStats($machine, $latestReading, $today),
            'recentActivities' => $this->getRecentActivities($request->user()->id),
            'chartData' => $this->getTemperatureChartData($machine),
        ]);
    }

    private function getMachineStats($machine, $latestReading, $today)
    {
        $currentTemperature = $latestReading ? $latestReading->temperature : 0;
        $machineStatus = $machine ? $machine->status : 'Offline';

        // Gunakan last_heartbeat_at (timestamp server saat data diterima) bukan recorded_at
        $lastHeartbeat = $machine?->last_heartbeat_at;

        // Online jika heartbeat terakhir ≤15 detik yang lalu
        $isOnline = $lastHeartbeat !== null && $lastHeartbeat->greaterThan(now()->subSeconds(15));

        if ($machine && ! $isOnline && $machine->status !== 'offline') {
            $machine->update(['status' => 'offline']);
        }

        $totalDataToday = $machine ? SensorReading::where('machine_id', $machine->id)->whereDate('created_at', $today)->count() : 0;
        $lastUpdate = $latestReading ? $latestReading->created_at->timezone('Asia/Jakarta')->format('Y-m-d H:i:s') : 'N/A';

        // Hitung interval kecepatan penerimaan data (ms)
        $dataIntervalMs = null;
        if ($machine) {
            $lastTwo = SensorReading::where('machine_id', $machine->id)
                ->latest('created_at')
                ->take(2)
                ->pluck('created_at');
            if ($lastTwo->count() === 2) {
                $dataIntervalMs = (int) abs($lastTwo[0]->diffInMilliseconds($lastTwo[1]));
            }
        }

        $isLogging = $latestReading && $this->isLoggingStatus($latestReading->process_status);

        // Mock/placeholder data untuk Monitoring Panel
        $processSession = $machine
            ? \App\Models\ProcessSession::where('machine_id', $machine->id)->latest()->first()
            : null;

        return [
            'currentTemperature' => $currentTemperature,
            'machineStatus' => $machineStatus,
            'isOnline' => $isOnline,
            'isLogging' => $isLogging,
            'totalDataToday' => $totalDataToday,
            'lastUpdate' => $lastUpdate,
            'dataIntervalMs' => $dataIntervalMs,
            // Monitoring Panel data (placeholder)
            'sv' => $processSession?->target_temperature ?? 121.1,
            'mv' => null,
            'processStep' => $processSession?->current_step,
            'timerTot' => '00:00:00',
            'timerStp' => '00:00:00',
            'timerRem' => '00:00:00',
        ];
    }

    private function getRecentActivities($userId)
    {
        return ActivityLog::with('user')
            ->where('user_id', $userId)
            ->latest()
            ->take(5)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'description' => $log->action,
                    'user' => $log->user ? $log->user->name : 'System',
                    'created_at' => $log->created_at->timezone('Asia/Jakarta')->format('Y-m-d H:i:s'),
                    'properties' => $log->properties,
                ];
            });
    }

    private function getTemperatureChartData($machine)
    {
        $labels = [];
        $data = [];
        $svData = [];
        $recordedAts = [];

        if ($machine) {
            // Dapatkan sesi terbaru untuk mesin operator ini
            $latestSession = \App\Models\ProcessSession::where('machine_id', $machine->id)
                ->latest()
                ->first();

            if ($latestSession) {
                $readings = SensorReading::where('machine_id', $machine->id)
                    ->where('process_session_id', $latestSession->id)
                    ->latest()
                    ->take(100)
                    ->get()
                    ->reverse();

                foreach ($readings as $reading) {
                    // Gunakan created_at (waktu server terima data) sebagai label X-axis
                    $labels[] = $reading->created_at->timezone('Asia/Jakarta')->format('H:i:s');
                    $data[] = $reading->temperature;
                    $svData[] = $reading->sv ?? 121.1;
                    $recordedAts[] = $reading->recorded_at ?? $reading->created_at;
                }
            }
        }

        return [
            'labels' => $labels,
            'data' => $data,
            'svData' => $svData,
            'recordedAts' => $recordedAts,
        ];
    }

    private function isLoggingStatus(?string $processStatus): bool
    {
        if ($processStatus === null) {
            return false;
        }

        return in_array(strtolower($processStatus), ['logging', 'running', 'heating', 'holding', 'sterilizing'], true);
    }
}
