<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Services\MqttCommandService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;

class MachineCommandController extends Controller
{
    public function __construct(
        private MqttCommandService $mqttCommandService
    ) {}

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'cmd' => 'required|in:start,stop',
        ]);

        $machine = $request->user()->machine;

        if (! $machine) {
            return back()->with('error', 'Akun Anda belum ditetapkan ke mesin retort.');
        }

        $cmd = strtoupper($validated['cmd']);

        try {
            $this->mqttCommandService->send($machine, $cmd);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => $cmd === 'START'
                ? "Memulai perekaman mesin {$machine->machine_code} via web"
                : "Menghentikan perekaman mesin {$machine->machine_code} via web",
            'properties' => [
                'machine_code' => $machine->machine_code,
                'command' => $cmd,
                'channel' => 'mqtt',
            ],
        ]);

        return back()->with(
            'success',
            $cmd === 'START'
                ? 'Perintah START dikirim ke logger. ESP akan mulai merekam.'
                : 'Perintah STOP dikirim ke logger. ESP akan berhenti merekam.'
        );
    }
}
