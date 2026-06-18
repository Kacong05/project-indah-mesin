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

        // Recent Activity
        $recentActivities = ActivityLog::with('user')
            ->where('user_id', $request->user()->id)
            ->latest()
            ->take(5)
            ->get()
            ->map(function($log) {
            return [
                'id' => $log->id,
                'description' => $log->description,
                'user' => $log->user ? $log->user->name : 'System',
                'created_at' => $log->created_at->timezone('Asia/Jakarta')->format('Y-m-d H:i:s'),
                'properties' => $log->properties,
            ];
        });

        // Generate chart data using actual sensor readings
        $chartData = $this->getTemperatureChartData($machine);
        $alarmStats = $this->getAlarmStats($machine);

        return Inertia::render('Dashboard', [
            'machineName' => $machine ? $machine->name : 'Mesin Belum Ditetapkan',
            'stats' => [
                'currentTemperature' => $currentTemperature,
                'machineStatus' => $machineStatus,
                'isOnline' => $isOnline,
                'totalDataToday' => $totalDataToday,
                'totalAlarmsToday' => $totalAlarmsToday,
                'lastUpdate' => $lastUpdate,
            ],
            'recentActivities' => $recentActivities,
            'chartData' => $chartData,
            'alarmStats' => $alarmStats,
        ]);
    }

    private function getTemperatureChartData($machine)
    {
        $labels = [];
        $data = [];
        
        if ($machine) {
            $readings = SensorReading::where('machine_id', $machine->id)
                ->latest()
                ->take(24)
                ->get()
                ->reverse();
                
            foreach ($readings as $reading) {
                $labels[] = $reading->created_at->timezone('Asia/Jakarta')->format('H:i');
                $data[] = $reading->temperature;
            }
        }

        return [
            'labels' => $labels,
            'data' => $data,
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
