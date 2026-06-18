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
        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'Administrator',
            'email' => 'admin@retort.com',
            'role' => User::ROLE_ADMIN,
            'password' => bcrypt('password'),
        ]);

        User::factory()->create([
            'name' => 'Operator',
            'email' => 'operator@retort.com',
            'role' => User::ROLE_OPERATOR,
            'password' => bcrypt('password'),
        ]);

        // Create dummy machine
        \App\Models\RetortMachine::create([
            'machine_code' => 'RT-001',
            'name' => 'Mesin Retort Utama',
            'location' => 'Area Produksi 1',
            'status' => \App\Models\RetortMachine::STATUS_RUNNING,
            'last_heartbeat_at' => now(),
        ]);
    }
}
