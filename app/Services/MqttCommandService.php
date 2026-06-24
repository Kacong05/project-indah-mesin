<?php

namespace App\Services;

use App\Models\RetortMachine;
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
        $python = PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3';

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
            throw new RuntimeException(
                'Gagal publish MQTT: '.trim($process->getErrorOutput() ?: $process->getOutput())
            );
        }
    }
}
