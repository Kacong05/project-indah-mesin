<?php

namespace App\Http\Controllers;

use App\Models\Alarm;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AlarmController extends Controller
{
    public function index(Request $request)
    {
        $machineId = $request->user()->machine_id;
        $query = Alarm::with(['machine', 'acknowledgedBy'])->where('machine_id', $machineId)->latest();

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

    public function acknowledge(Request $request, Alarm $alarm)
    {
        if ($alarm->machine_id !== $request->user()->machine_id) {
            abort(403);
        }

        $alarm->update([
            'status' => Alarm::STATUS_ACKNOWLEDGED,
            'acknowledged_by' => $request->user()->id,
        ]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Menandai alarm sebagai sudah dibaca',
            'loggable_type' => Alarm::class,
            'loggable_id' => $alarm->id,
            'properties' => ['type' => $alarm->type],
        ]);

        return back();
    }

    public function acknowledgeAll(Request $request)
    {
        Alarm::where('machine_id', $request->user()->machine_id)
            ->whereNull('acknowledged_by')
            ->update([
                'status' => Alarm::STATUS_ACKNOWLEDGED,
                'acknowledged_by' => $request->user()->id,
            ]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Menandai semua alarm sebagai sudah dibaca',
        ]);

        return back();
    }

    private function formatType($type)
    {
        return ucwords(str_replace('_', ' ', $type));
    }
}
