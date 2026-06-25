<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ProvidesMachineData;
use App\Models\SensorReading;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    use ProvidesMachineData;

    public function index(Request $request)
    {
        $machine = $request->user()->machine;
        $today = Carbon::today();

        $latestReading = $machine
            ? SensorReading::where('machine_id', $machine->id)->latest('recorded_at')->first()
            : null;

        return Inertia::render('Dashboard', [
            'machineName' => $machine ? $machine->name : 'Mesin Belum Ditetapkan',
            'machineCode' => $machine?->machine_code,
            'stats' => $this->getMachineStats($machine, $latestReading, $today),
            'recentActivities' => $this->getRecentActivities($request->user()->id),
        ]);
    }
}
