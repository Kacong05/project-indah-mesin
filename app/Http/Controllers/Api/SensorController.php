<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RetortMachine;
use App\Models\SensorReading;
use Illuminate\Http\Request;

class SensorController extends Controller
{
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

        // Update machine heartbeat
        $machine->update(['last_heartbeat_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Sensor reading recorded successfully.',
            'data' => $reading
        ]);
    }
}
