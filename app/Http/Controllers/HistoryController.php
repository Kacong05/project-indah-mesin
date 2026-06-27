<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\ProcessSession;
use App\Models\SensorReading;
use App\Services\F0Calculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class HistoryController extends Controller
{
    public function index(Request $request)
    {
        $machineId = $request->user()->machine_id;

        // Ambil data sessions dengan latest temperature
        $sessionsQuery = ProcessSession::query()
            ->withCount('sensorReadings')
            ->with(['sensorReadings' => function ($query) {
                $query->orderBy('recorded_at');
            }])
            ->latest('started_at');

        if ($machineId) {
            $sessionsQuery->where('machine_id', $machineId);
        }

        // Filter sessions by date range if provided
        if ($request->filled('start_date')) {
            $sessionsQuery->whereDate('started_at', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $sessionsQuery->whereDate('started_at', '<=', $request->end_date);
        }

        $sessions = $sessionsQuery->get()->map(function ($session) {
            $readings = $session->sensorReadings;
            $latestReading = $readings->last();

            // "Proses Terakhir" = fase retort nyata terakhir (heating/holding/
            // sterilizing/cooling). Status seperti 'idle'/'running' bukan fase
            // proses, jadi dilewati agar kartu menampilkan tahap yang bermakna.
            $lastPhase = $readings
                ->filter(fn ($r) => in_array(
                    strtolower($r->process_status ?? ''),
                    ['heating', 'holding', 'sterilizing', 'cooling'],
                    true
                ))
                ->last()?->process_status
                ?? $latestReading?->process_status;

            return [
                'id' => $session->id,
                'name' => $session->display_name,
                'time_range' => $session->time_range,
                'started_at' => $session->started_at->toIso8601String(),
                'ended_at' => $session->ended_at?->toIso8601String(),
                'duration_minutes' => $session->duration_in_minutes,
                'data_count' => $session->sensor_readings_count,
                'status' => $session->status,
                'f0' => F0Calculator::fromReadings($readings),
                'process_status' => $lastPhase,
            ];
        });

        // Ambil data readings (legacy table view). Pakai recorded_at (waktu ukur
        // perangkat) agar konsisten dgn sesi & benar saat data di-backfill.
        $readingsQuery = SensorReading::with('machine')->where('machine_id', $machineId)->latest('recorded_at');

        // Filter by Date Range
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $readingsQuery->whereBetween('recorded_at', [
                $request->start_date.' 00:00:00',
                $request->end_date.' 23:59:59',
            ]);
        } elseif ($request->filled('start_date')) {
            $readingsQuery->whereDate('recorded_at', '>=', $request->start_date);
        } elseif ($request->filled('end_date')) {
            $readingsQuery->whereDate('recorded_at', '<=', $request->end_date);
        }

        $readings = $readingsQuery->paginate(15)->withQueryString()->through(function ($reading) {
            return [
                'id' => $reading->id,
                'timestamp' => $reading->recorded_at->timezone('Asia/Jakarta')->format('Y-m-d H:i:s'),
                'machine_name' => $reading->machine ? $reading->machine->name : 'Unknown',
                'temperature' => $reading->temperature,
                'pressure' => $reading->pressure,
                'sync_status' => 'Synced',
            ];
        });

        $machines = $request->user()->machine ? [$request->user()->machine] : [];

        return Inertia::render('History/Index', [
            'sessions' => $sessions,
            'readings' => $readings,
            'machines' => $machines,
            'filters' => $request->only(['machine_id', 'start_date', 'end_date']),
        ]);
    }

    /**
     * Hapus satu sesi proses beserta seluruh data sensornya.
     * Dibatasi pada mesin milik operator yang login.
     */
    public function destroySession(Request $request, ProcessSession $session)
    {
        $machineId = $request->user()->machine_id;
        if ($machineId && $session->machine_id !== $machineId) {
            abort(403);
        }

        $sessionName = $session->display_name;

        DB::transaction(function () use ($session) {
            $session->sensorReadings()->delete();
            $session->delete();
        });

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => "Menghapus proses: {$sessionName}",
        ]);

        return back();
    }

    public function export(Request $request)
    {
        $machineId = $request->user()->machine_id;
        $query = SensorReading::with('machine')->where('machine_id', $machineId)->latest('recorded_at');

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('recorded_at', [
                $request->start_date.' 00:00:00',
                $request->end_date.' 23:59:59',
            ]);
        }

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Mengunduh data riwayat sensor',
        ]);

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json($query->get()->map(function ($reading) {
                return [
                    'timestamp' => $reading->recorded_at->timezone('Asia/Jakarta')->format('Y-m-d H:i:s'),
                    'machine_name' => $reading->machine ? $reading->machine->name : 'Unknown',
                    'temperature' => $reading->temperature,
                    'status' => $reading->temperature > 120 ? 'Critical' : ($reading->temperature > 110 ? 'Warning' : 'Normal'),
                    'sync_status' => 'Synced',
                ];
            }));
        }

        $response = new StreamedResponse(function () use ($query) {
            $handle = fopen('php://output', 'w');

            // Add CSV headers
            fputcsv($handle, ['Timestamp', 'Nama Mesin', 'Suhu (C)', 'Status Device', 'Status Sinkronisasi']);

            $query->chunk(500, function ($readings) use ($handle) {
                foreach ($readings as $reading) {
                    $status = $reading->temperature > 120 ? 'Critical' : ($reading->temperature > 110 ? 'Warning' : 'Normal');
                    fputcsv($handle, [
                        $reading->recorded_at->format('Y-m-d H:i:s'),
                        $reading->machine ? $reading->machine->name : 'Unknown',
                        $reading->temperature,
                        $status,
                        'Synced',
                    ]);
                }
            });

            fclose($handle);
        });

        $filename = 'riwayat_suhu_'.date('Ymd_His').'.csv';
        $response->headers->set('Content-Type', 'text/csv');
        $response->headers->set('Content-Disposition', 'attachment; filename="'.$filename.'"');

        return $response;
    }

    public function logExport(Request $request)
    {
        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Mengunduh data riwayat sensor',
        ]);

        return response()->json(['success' => true]);
    }
}
