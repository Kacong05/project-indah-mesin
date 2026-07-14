<?php

namespace App\Services;

use App\Models\ProcessSession;
use App\Models\RetortMachine;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class CompletedCsvImportService
{
    private const REQUIRED_HEADERS = ['Tanggal Jam', 'Actual', 'Setting'];

    /** @return array{session: ProcessSession, duplicate: bool} */
    public function import(RetortMachine $machine, UploadedFile $file, ?string $expectedHash = null): array
    {
        $path = $file->getRealPath();
        if (! is_string($path) || ! is_file($path)) {
            throw ValidationException::withMessages(['file' => 'File CSV tidak dapat dibaca.']);
        }

        $hash = hash_file('sha256', $path);
        if ($expectedHash && ! hash_equals(strtolower($expectedHash), $hash)) {
            throw ValidationException::withMessages(['sha256' => 'Checksum CSV tidak cocok.']);
        }

        $existing = ProcessSession::where('machine_id', $machine->id)
            ->where('source_hash', $hash)
            ->first();
        if ($existing) {
            return ['session' => $existing, 'duplicate' => true];
        }

        $rows = $this->readRows($path);
        if ($rows === []) {
            throw ValidationException::withMessages(['file' => 'CSV tidak memiliki data sensor yang valid.']);
        }

        return DB::transaction(function () use ($machine, $file, $hash, $rows): array {
            $duplicate = ProcessSession::where('machine_id', $machine->id)
                ->where('source_hash', $hash)
                ->lockForUpdate()
                ->first();
            if ($duplicate) {
                return ['session' => $duplicate, 'duplicate' => true];
            }

            $number = $this->nextProcessNumber($machine->id);
            $session = ProcessSession::create([
                'machine_id' => $machine->id,
                'name' => "Proses {$number}",
                'started_at' => $rows[0]['recorded_at'],
                'ended_at' => $rows[array_key_last($rows)]['recorded_at'],
                'data_count' => count($rows),
                'status' => 'completed',
                'source_file' => basename($file->getClientOriginalName()),
                'source_hash' => $hash,
            ]);

            $createdAt = now();
            foreach (array_chunk($rows, 500) as $chunk) {
                DB::table('sensor_readings')->insert(array_map(fn (array $row) => [
                    'machine_id' => $machine->id,
                    'batch_id' => null,
                    'process_session_id' => $session->id,
                    'temperature' => $row['temperature'],
                    'sv' => $row['sv'],
                    'pressure' => 0,
                    'process_status' => $row['process_status'],
                    'recorded_at' => $row['recorded_at'],
                    'created_at' => $createdAt,
                ], $chunk));
            }

            $machine->update([
                'last_heartbeat_at' => now(),
                'status' => RetortMachine::STATUS_STANDBY,
            ]);

            return ['session' => $session, 'duplicate' => false];
        });
    }

    /** @return array<int, array{temperature: float, sv: ?float, process_status: string, recorded_at: string}> */
    private function readRows(string $path): array
    {
        $handle = fopen($path, 'rb');
        if (! $handle) {
            throw new RuntimeException('Gagal membuka CSV.');
        }

        try {
            $headers = fgetcsv($handle);
            if (! is_array($headers)) {
                throw ValidationException::withMessages(['file' => 'Header CSV tidak ditemukan.']);
            }
            $headers = array_map(fn ($value) => trim((string) $value, " \t\n\r\0\x0B\xEF\xBB\xBF"), $headers);
            foreach (self::REQUIRED_HEADERS as $required) {
                if (! in_array($required, $headers, true)) {
                    throw ValidationException::withMessages(['file' => "Kolom CSV {$required} tidak ditemukan."]);
                }
            }

            $indexes = array_flip($headers);
            $rows = [];
            $line = 1;
            while (($values = fgetcsv($handle)) !== false) {
                $line++;
                if ($values === [null] || $values === []) {
                    continue;
                }

                $temperature = $this->numeric($values[$indexes['Actual']] ?? null, "Actual baris {$line}");
                $svRaw = $values[$indexes['Setting']] ?? null;
                $timestampRaw = isset($indexes['ISO']) ? ($values[$indexes['ISO']] ?? null) : null;
                $timestampRaw = $timestampRaw ?: ($values[$indexes['Tanggal Jam']] ?? null);

                try {
                    $timestamp = Carbon::parse((string) $timestampRaw, 'Asia/Jakarta')->timezone('Asia/Jakarta');
                } catch (\Throwable) {
                    throw ValidationException::withMessages(['file' => "Timestamp baris {$line} tidak valid."]);
                }

                $rows[] = [
                    'temperature' => $temperature,
                    'sv' => $svRaw === null || trim((string) $svRaw) === '' ? null : $this->numeric($svRaw, "Setting baris {$line}"),
                    'process_status' => strtolower(trim((string) ($values[$indexes['Phase']] ?? 'running'))),
                    'recorded_at' => $timestamp->format('Y-m-d H:i:s'),
                ];
            }
        } finally {
            fclose($handle);
        }

        usort($rows, fn (array $a, array $b) => strcmp($a['recorded_at'], $b['recorded_at']));

        return $rows;
    }

    private function numeric(mixed $value, string $field): float
    {
        if (! is_numeric($value)) {
            throw ValidationException::withMessages(['file' => "Nilai {$field} tidak valid."]);
        }

        return (float) $value;
    }

    private function nextProcessNumber(int $machineId): int
    {
        $max = ProcessSession::where('machine_id', $machineId)
            ->lockForUpdate()
            ->pluck('name')
            ->map(function (?string $name): int {
                return preg_match('/^Proses\s+(\d+)$/i', trim($name ?? ''), $matches)
                    ? (int) $matches[1]
                    : 0;
            })
            ->max();

        return ($max ?? 0) + 1;
    }
}
