<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\SystemEvent;
use Illuminate\Http\JsonResponse;

class SystemEventController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'machine_code' => 'required|string',
            'event' => 'required|string',
            'reason' => 'nullable|string',
            'iso' => 'nullable|string',
        ]);

        $event = SystemEvent::create([
            'machine_code' => $validated['machine_code'],
            'event' => $validated['event'],
            'reason' => $validated['reason'] ?? null,
            'iso' => isset($validated['iso']) && $validated['iso'] ? date('Y-m-d H:i:s', strtotime($validated['iso'])) : null,
        ]);

        return response()->json([
            'success' => true,
            'event' => $event,
        ]);
    }
}
