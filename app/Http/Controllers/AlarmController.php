<?php

namespace App\Http\Controllers;

use App\Models\Alarm;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AlarmController extends Controller
{
    public function index(Request $request)
    {
        $query = Alarm::with(['machine', 'acknowledgedBy'])->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $alarms = $query->paginate(15)->withQueryString()->through(function ($alarm) {
            return [
                'id' => $alarm->id,
                'machine_name' => $alarm->machine ? $alarm->machine->name : 'Unknown',
                'type' => $this->formatType($alarm->type),
                'severity' => $alarm->severity,
                'message' => $alarm->message,
                'status' => $alarm->status,
                'triggered_at' => $alarm->triggered_at ? $alarm->triggered_at->format('Y-m-d H:i:s') : '-',
                'resolved_at' => $alarm->resolved_at ? $alarm->resolved_at->format('Y-m-d H:i:s') : '-',
                'acknowledged_by' => $alarm->acknowledgedBy ? $alarm->acknowledgedBy->name : null,
            ];
        });

        return Inertia::render('Alarms/Index', [
            'alarms' => $alarms,
            'filters' => $request->only('status'),
        ]);
    }

    private function formatType($type)
    {
        return ucwords(str_replace('_', ' ', $type));
    }
}
