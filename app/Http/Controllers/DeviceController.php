<?php

namespace App\Http\Controllers;

use App\Models\RetortMachine;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DeviceController extends Controller
{
    public function index(Request $request)
    {
        $machineId = $request->user()->machine_id;
        $devices = RetortMachine::where('id', $machineId)->latest()->paginate(10)->through(function ($machine) {
            // Pakai last_heartbeat_at (di-set server saat data masuk), bukan created_at sensor
            $isOnline = $machine->last_heartbeat_at !== null
                && $machine->last_heartbeat_at->greaterThan(now()->subSeconds(15));
            
            return [
                'id' => $machine->id,
                'name' => $machine->name,
                'mac_address' => $machine->mac_address,
                'status' => $machine->status,
                'is_online' => $isOnline,
                'last_heartbeat' => $machine->last_heartbeat_at ? $machine->last_heartbeat_at->diffForHumans() : 'Never',
                'created_at' => $machine->created_at->format('Y-m-d'),
            ];
        });

        return Inertia::render('Devices/Index', [
            'devices' => $devices
        ]);
    }
}
