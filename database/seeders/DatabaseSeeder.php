<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::create([
            'name' => 'Administrator',
            'email' => 'admin@retort.com',
            'role' => User::ROLE_ADMIN,
            'password' => bcrypt('password'),
        ]);

        // Create dummy machine first
        $machine = \App\Models\RetortMachine::create([
            'machine_code' => 'RT-001',
            'name' => 'Mesin Retort Utama',
            'location' => 'Area Produksi 1',
            'status' => \App\Models\RetortMachine::STATUS_RUNNING,
            'last_heartbeat_at' => now(),
        ]);

        User::create([
            'name' => 'Operator',
            'email' => 'operator@retort.com',
            'role' => User::ROLE_OPERATOR,
            'machine_id' => $machine->id,
            'password' => bcrypt('password'),
        ]);

        // Create dummy sensor readings for the last 24 hours
        $now = now();
        for ($i = 24; $i >= 0; $i--) {
            \App\Models\SensorReading::create([
                'machine_id' => $machine->id,
                'temperature' => rand(100, 125) + (rand(0, 9) / 10),
                'pressure' => rand(1, 2) + (rand(0, 9) / 10),
                'process_status' => 'running',
                'recorded_at' => $now->copy()->subHours($i),
                'created_at' => $now->copy()->subHours($i),
            ]);
        }

        // Sesi proses lengkap (CUT → holding → cooling) dengan F₀.
        $this->call(RetortProcessSeeder::class);
    }
}
