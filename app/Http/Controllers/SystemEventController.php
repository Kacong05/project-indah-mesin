<?php

namespace App\Http\Controllers;

use App\Models\RetortMachine;
use App\Models\SystemEvent;
use App\Services\MonitoringBroadcast;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemEventController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'machine_code' => 'required|string',
            'event' => 'required|string',
            'reason' => 'nullable|string',
            'iso' => 'nullable|string',
            'ts' => 'nullable|string',
        ]);

        $isoAt = null;
        if (! empty($validated['iso'])) {
            $isoAt = Carbon::parse($validated['iso'])->timezone('Asia/Jakarta');
        }

        $event = SystemEvent::create([
            'machine_code' => $validated['machine_code'],
            'event' => $validated['event'],
            'reason' => $validated['reason'] ?? null,
            'iso' => $isoAt?->format('Y-m-d H:i:s'),
        ]);

        $machine = RetortMachine::where('machine_code', $validated['machine_code'])->first();
        if ($machine) {
            MonitoringBroadcast::tick($machine->id);
        }

        return response()->json([
            'success' => true,
            'event' => $event,
        ]);
    }
}
