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

        // Backfill dari sensor readings yang sudah terhubung ke sesi
        DB::statement('
            UPDATE process_sessions ps
            SET machine_id = (
                SELECT sr.machine_id
                FROM sensor_readings sr
                WHERE sr.process_session_id = ps.id
                  AND sr.machine_id IS NOT NULL
                LIMIT 1
            )
            WHERE ps.machine_id IS NULL
        ');
    }

    public function down(): void
    {
        Schema::table('process_sessions', function (Blueprint $table) {
            $table->dropForeign(['machine_id']);
            $table->dropColumn('machine_id');
        });
    }
};
