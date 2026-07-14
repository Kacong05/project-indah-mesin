<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('process_sessions', function (Blueprint $table) {
            $table->foreignId('machine_id')
                ->nullable()
                ->after('id')
                ->constrained('retort_machines')
                ->cascadeOnDelete();

            $table->index(['machine_id', 'started_at']);
            $table->index(['machine_id', 'status']);
        });

        // Backfill hanya bila kolom process_session_id sudah ada di sensor_readings
        if (Schema::hasColumn('sensor_readings', 'process_session_id')) {
            DB::table('process_sessions')
                ->whereNull('machine_id')
                ->orderBy('id')
                ->eachById(function ($session): void {
                    $machineId = DB::table('sensor_readings')
                        ->where('process_session_id', $session->id)
                        ->whereNotNull('machine_id')
                        ->value('machine_id');

                    if ($machineId !== null) {
                        DB::table('process_sessions')
                            ->where('id', $session->id)
                            ->update(['machine_id' => $machineId]);
                    }
                });
        }
    }

    public function down(): void
    {
        Schema::table('process_sessions', function (Blueprint $table) {
            $table->dropForeign(['machine_id']);
            $table->dropColumn('machine_id');
        });
    }
};
