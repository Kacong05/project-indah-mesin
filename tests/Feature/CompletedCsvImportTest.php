<?php

namespace Tests\Feature;

use App\Models\ProcessSession;
use App\Models\RetortMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class CompletedCsvImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['sensor.api_token' => 'test-token']);
    }

    public function test_live_sensor_data_is_cached_but_not_persisted(): void
    {
        $machine = $this->machine();

        $this->withToken('test-token')->postJson('/api/sensor', [
            'machine_code' => $machine->machine_code,
            'temperature' => 101.5,
            'sv' => 121.1,
            'mv' => 50,
            'pressure' => 0,
            'process_status' => 'heating',
            'logging' => true,
            'recorded_at' => '2026-07-14T10:00:00+07:00',
        ])->assertOk()
            ->assertJsonPath('live', true)
            ->assertJsonPath('recorded', false);

        $this->assertDatabaseCount('sensor_readings', 0);
        $this->assertDatabaseCount('process_sessions', 0);
    }

    public function test_completed_csv_creates_one_completed_session_and_chart_readings(): void
    {
        $machine = $this->machine();
        $csv = $this->csv();

        $response = $this->withToken('test-token')->post('/api/sessions/import-csv', [
            'machine_code' => $machine->machine_code,
            'sha256' => hash('sha256', $csv),
            'file' => UploadedFile::fake()->createWithContent('20260714_100000.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('imported', true)
            ->assertJsonPath('data_count', 3);

        $session = ProcessSession::firstOrFail();
        $this->assertSame('completed', $session->getRawOriginal('status'));
        $this->assertSame(3, $session->sensorReadings()->count());
        $this->assertSame(
            ['heating', 'holding', 'cooling'],
            $session->sensorReadings()->orderBy('recorded_at')->pluck('process_status')->all()
        );

        $this->getJson("/api/history/sessions/{$session->id}")
            ->assertOk()
            ->assertJsonCount(3, 'data.readings')
            ->assertJsonPath('data.readings.1.temperature', 121.2);
    }

    public function test_retrying_the_same_csv_does_not_duplicate_session_or_readings(): void
    {
        $machine = $this->machine();
        $csv = $this->csv();

        foreach ([true, false] as $first) {
            $this->withToken('test-token')->post('/api/sessions/import-csv', [
                'machine_code' => $machine->machine_code,
                'file' => UploadedFile::fake()->createWithContent('same.csv', $csv),
            ])->assertOk()->assertJsonPath('duplicate', ! $first);
        }

        $this->assertDatabaseCount('process_sessions', 1);
        $this->assertDatabaseCount('sensor_readings', 3);
    }

    public function test_invalid_checksum_rejects_csv_without_partial_history(): void
    {
        $machine = $this->machine();

        $this->withToken('test-token')->post('/api/sessions/import-csv', [
            'machine_code' => $machine->machine_code,
            'sha256' => str_repeat('0', 64),
            'file' => UploadedFile::fake()->createWithContent('broken.csv', $this->csv()),
        ])->assertUnprocessable()->assertJsonValidationErrors('sha256');

        $this->assertDatabaseCount('process_sessions', 0);
        $this->assertDatabaseCount('sensor_readings', 0);
    }

    public function test_active_session_detail_is_locked(): void
    {
        $machine = $this->machine();
        $session = ProcessSession::create([
            'machine_id' => $machine->id,
            'name' => 'Proses aktif',
            'started_at' => now(),
            'ended_at' => null,
            'data_count' => 0,
            'status' => 'active',
        ]);

        $this->getJson("/api/history/sessions/{$session->id}")
            ->assertStatus(409);
    }

    private function machine(): RetortMachine
    {
        return RetortMachine::create([
            'machine_code' => 'RT-TEST',
            'name' => 'Retort Test',
            'location' => 'Lab',
            'status' => RetortMachine::STATUS_STANDBY,
        ]);
    }

    private function csv(): string
    {
        return implode("\n", [
            'Tanggal Jam,Actual,Setting,ISO,Phase,MV,Run,Logging',
            '7/14/2026 10:00:00AM,100.0,121.1,2026-07-14T10:00:00+07:00,HEATING,50.0,1,1',
            '7/14/2026 10:00:01AM,121.2,121.1,2026-07-14T10:00:01+07:00,HOLDING,40.0,1,1',
            '7/14/2026 10:00:02AM,90.0,40.0,2026-07-14T10:00:02+07:00,COOLING,20.0,1,1',
            '',
        ]);
    }
}
