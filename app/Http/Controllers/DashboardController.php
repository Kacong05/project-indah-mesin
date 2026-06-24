<?php

namespace App\Http\Controllers;

use App\Models\RetortMachine;
use App\Models\SensorReading;
use App\Models\Alarm;
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

        // Stats
        $currentTemperature = $latestReading ? $latestReading->temperature : 0;
        $machineStatus = $machine ? $machine->status : 'Offline';
        $isOnline = $machine ? $machine->last_heartbeat_at?->diffInMinutes(now()) < 1 : false;

        $totalDataToday = $machine ? SensorReading::where('machine_id', $machine->id)->whereDate('created_at', $today)->count() : 0;
        $totalAlarmsToday = $machine ? Alarm::where('machine_id', $machine->id)->whereDate('created_at', $today)->count() : 0;
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

        // Recent Activity
        $recentActivities = ActivityLog::with('user')
            ->where('user_id', $request->user()->id)
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

        // Generate chart data using actual sensor readings
        $chartData = $this->getTemperatureChartData($machine);
        $alarmStats = $this->getAlarmStats($machine);

        // Active alarms for popup notification
        $activeAlarms = $machine ? Alarm::where('machine_id', $machine->id)
            ->where('status', Alarm::STATUS_ACTIVE)
            ->latest('triggered_at')
            ->take(5)
            ->get()
            ->map(fn($a) => [
                'id' => $a->id,
                'type' => $a->type,
                'severity' => $a->severity,
                'message' => $a->message,
                'triggered_at' => $a->triggered_at?->timezone('Asia/Jakarta')->format('H:i:s'),
            ]) : collect();

        return Inertia::render('Dashboard', [
            'machineName' => $machine ? $machine->name : 'Mesin Belum Ditetapkan',
            'stats' => [
                'currentTemperature' => $currentTemperature,
                'machineStatus' => $machineStatus,
                'isOnline' => $isOnline,
                'totalDataToday' => $totalDataToday,
                'totalAlarmsToday' => $totalAlarmsToday,
                'lastUpdate' => $lastUpdate,
                'dataIntervalMs' => $dataIntervalMs,
            ],
            'recentActivities' => $recentActivities,
            'chartData' => $chartData,
            'activeAlarms' => $activeAlarms,
            'alarmStats' => $alarmStats,
        ]);
    }

    private function getTemperatureChartData($machine)
    {
        $labels = [];
        $data = [];
        $svData = [];
        $recordedAts = [];

        if ($machine) {
            // Dapatkan sesi terbaru
            $latestSession = \App\Models\ProcessSession::latest('started_at')->first();

            if ($latestSession) {
                $readings = SensorReading::where('machine_id', $machine->id)
                    ->where('process_session_id', $latestSession->id)
                    ->latest()
                    ->take(50) // Ambil lebih banyak data (misal 50) agar grafik lebih panjang
                    ->get()
                    ->reverse();

                foreach ($readings as $reading) {
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

    private function getAlarmStats($machine)
    {
        if (!$machine) {
            return [
                'labels' => ['Suhu Tinggi', 'Sensor Offline', 'Koneksi Server'],
                'data' => [0, 0, 0],
            ];
        }

        return [
            'labels' => ['Suhu Tinggi', 'Sensor Offline', 'Koneksi Server'],
            'data' => [
                Alarm::where('machine_id', $machine->id)->where('type', Alarm::TYPE_HIGH_TEMPERATURE)->count(),
                Alarm::where('machine_id', $machine->id)->where('type', Alarm::TYPE_SENSOR_OFFLINE)->count(),
                Alarm::where('machine_id', $machine->id)->where('type', 'connection_lost')->count(),
            ],
        ];
    }
}
