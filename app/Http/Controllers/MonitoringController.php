<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ProvidesMachineData;
use App\Services\MonitoringBroadcast;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MonitoringController extends Controller
{
    use ProvidesMachineData;

    public function index(Request $request)
    {
        $machine = $request->user()->machine;
        $payload = $this->buildMonitoringPayload($machine);

        return Inertia::render('Monitoring/Index', [
            'machineName' => $machine ? $machine->name : 'Mesin Belum Ditetapkan',
            'machineCode' => $machine?->machine_code,
            'stats' => $payload['stats'],
            'chartData' => $payload['chartData'],
        ]);
    }

    /**
     * JSON snapshot — fallback bila SSE putus.
     */
    public function live(Request $request): JsonResponse
    {
        $machine = $request->user()->machine;

        if (! $machine) {
            return response()->json(['success' => false, 'message' => 'Mesin tidak ditemukan'], 404);
        }

        $payload = $this->buildMonitoringPayload($machine);
        $payload['seq'] = MonitoringBroadcast::currentSeq($machine->id);

        return response()->json([
            'success' => true,
            'data' => $payload,
        ]);
    }

    /**
     * Server-Sent Events: push data ke browser segera setelah ESP mengirim ke server.
     */
    public function stream(Request $request): StreamedResponse
    {
        $machine = $request->user()->machine;
        abort_unless($machine, 403);

        $machineId = $machine->id;
        $since = (int) $request->query('since', 0);

        return response()->stream(function () use ($machine, $machineId, $since) {
            while (ob_get_level() > 0) {
                ob_end_flush();
            }

            $lastSeq = $since;
            $deadline = time() + 55;

            $sendPayload = function () use ($machine, $machineId) {
                $machine->refresh();
                $payload = $this->buildMonitoringPayload($machine);
                $payload['seq'] = MonitoringBroadcast::currentSeq($machineId);

                echo 'data: '.json_encode($payload, JSON_UNESCAPED_UNICODE)."\n\n";
                flush();
            };

            // Snapshot awal agar UI langsung sinkron tanpa menunggu paket berikutnya.
            $sendPayload();
            $lastSeq = MonitoringBroadcast::currentSeq($machineId);

            while (! connection_aborted() && time() < $deadline) {
                $seq = MonitoringBroadcast::currentSeq($machineId);

                if ($seq > $lastSeq) {
                    $sendPayload();
                    $lastSeq = $seq;
                }

                usleep(25_000);
            }

            echo ": heartbeat\n\n";
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    protected function buildMonitoringPayload($machine): array
    {
        $today = Carbon::today();

        return [
            'stats' => $this->getMachineStats($machine, null, $today),
            'chartData' => $this->getTemperatureChartData($machine),
        ];
    }
}
