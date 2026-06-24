<?php

namespace App\Services;

use App\Models\RetortMachine;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Symfony\Component\Process\Process;

class MqttCommandService
{
    /**
     * Kirim perintah START atau STOP ke ESP32 lewat MQTT.
     * Format payload: START:RT-001 agar hanya mesin target yang merespons.
     */
    public function send(RetortMachine $machine, string $command): void
    {
        $command = strtoupper(trim($command));

        if (! in_array($command, ['START', 'STOP', 'STATUS'], true)) {
            throw new RuntimeException('Perintah tidak valid.');
        }

        $user = config('mqtt.user');
        $password = config('mqtt.password');

        if ($user === '' || $password === '') {
            throw new RuntimeException('MQTT belum dikonfigurasi di server (MQTT_USER / MQTT_PASSWORD).');
        }

        $payload = $command.':'.$machine->machine_code;
        $script = base_path('scripts/mqtt_publish.py');
        $python = $this->resolvePythonBinary();

        $process = new Process([$python, $script, $payload], base_path(), [
            'MQTT_HOST' => config('mqtt.host'),
            'MQTT_PORT' => (string) config('mqtt.port'),
            'MQTT_CMD_TOPIC' => config('mqtt.cmd_topic'),
            'MQTT_USER' => $user,
            'MQTT_PASS' => $password,
        ]);

        $process->setTimeout(10);
        $process->run();

        if (! $process->isSuccessful()) {
            $detail = trim($process->getErrorOutput() ?: $process->getOutput());
            Log::error('MQTT command publish failed', [
                'payload' => $payload,
                'python' => $python,
                'detail' => $detail,
            ]);

            throw new RuntimeException('Gagal publish MQTT: '.$detail);
        }

        Log::info('MQTT command published', ['payload' => $payload, 'topic' => config('mqtt.cmd_topic')]);
    }

    private function resolvePythonBinary(): string
    {
        if (PHP_OS_FAMILY === 'Windows') {
            return 'python';
        }

        $candidates = [
            base_path('.venv/bin/python3'),
            '/usr/bin/python3',
        ];

        foreach ($candidates as $path) {
            if (is_file($path) && is_executable($path)) {
                return $path;
            }
        }

        return 'python3';
    }
}
