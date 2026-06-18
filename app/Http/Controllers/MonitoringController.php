<?php

namespace App\Http\Controllers;

use App\Models\RetortMachine;
use App\Models\SensorReading;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MonitoringController extends Controller
{
    public function index(Request $request)
    {
        $machine = $request->user()->machine;
        $latestReading = $machine ? SensorReading::where('machine_id', $machine->id)->latest()->first() : null;

        return Inertia::render('Monitoring/Index', [
            'temperature' => $latestReading ? $latestReading->temperature : 0,
            'pressure' => $latestReading ? $latestReading->pressure : 0,
            'isOnline' => $machine ? $machine->last_heartbeat_at?->diffInMinutes(now()) < 1 : false,
            'serverStatus' => 'Online', // Always online if this page loads
            'lastReadingTime' => $latestReading ? $latestReading->created_at->timezone('Asia/Jakarta')->format('Y-m-d H:i:s') : 'N/A',
            'machineName' => $machine ? $machine->name : 'Unknown Machine',
        ]);
    }
}
