<?php

namespace App\Http\Controllers;

use App\Models\RetortMachine;
use App\Models\SensorReading;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class HistoryController extends Controller
{
    public function index(Request $request)
    {
        $machineId = $request->user()->machine_id;
        $query = SensorReading::with('machine')->where('machine_id', $machineId)->latest();

        // Filter by Date Range
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('created_at', [
                $request->start_date . ' 00:00:00',
                $request->end_date . ' 23:59:59'
            ]);
        } elseif ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        } elseif ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $readings = $query->paginate(15)->withQueryString()->through(function ($reading) {
            return [
                'id' => $reading->id,
                'timestamp' => $reading->created_at->format('Y-m-d H:i:s'),
                'machine_name' => $reading->machine ? $reading->machine->name : 'Unknown',
                'temperature' => $reading->temperature,
                'status' => $reading->temperature > 120 ? 'Critical' : ($reading->temperature > 110 ? 'Warning' : 'Normal'),
                'sync_status' => 'Synced' // For now assume always synced if it's in DB
            ];
        });

        $machines = $request->user()->machine ? [$request->user()->machine] : [];

        return Inertia::render('History/Index', [
            'readings' => $readings,
            'machines' => $machines,
            'filters' => $request->only(['start_date', 'end_date'])
        ]);
    }

    public function export(Request $request)
    {
        $machineId = $request->user()->machine_id;
        $query = SensorReading::with('machine')->where('machine_id', $machineId)->latest();

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('created_at', [
                $request->start_date . ' 00:00:00',
                $request->end_date . ' 23:59:59'
            ]);
        }

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json($query->get()->map(function ($reading) {
                return [
                    'timestamp' => $reading->created_at->format('Y-m-d H:i:s'),
                    'machine_name' => $reading->machine ? $reading->machine->name : 'Unknown',
                    'temperature' => $reading->temperature,
                    'status' => $reading->temperature > 120 ? 'Critical' : ($reading->temperature > 110 ? 'Warning' : 'Normal'),
                    'sync_status' => 'Synced'
                ];
            }));
        }

        $response = new StreamedResponse(function() use ($query) {
            $handle = fopen('php://output', 'w');
            
            // Add CSV headers
            fputcsv($handle, ['Timestamp', 'Nama Mesin', 'Suhu (C)', 'Status Device', 'Status Sinkronisasi']);

            $query->chunk(500, function($readings) use ($handle) {
                foreach ($readings as $reading) {
                    $status = $reading->temperature > 120 ? 'Critical' : ($reading->temperature > 110 ? 'Warning' : 'Normal');
                    fputcsv($handle, [
                        $reading->created_at->format('Y-m-d H:i:s'),
                        $reading->machine ? $reading->machine->name : 'Unknown',
                        $reading->temperature,
                        $status,
                        'Synced'
                    ]);
                }
            });

            fclose($handle);
        });

        $filename = 'riwayat_suhu_' . date('Ymd_His') . '.csv';
        $response->headers->set('Content-Type', 'text/csv');
        $response->headers->set('Content-Disposition', 'attachment; filename="' . $filename . '"');

        return $response;
    }
}
