<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambahkan kolom yang hilang pada DB lama (sensor_readings dibuat sebelum
     * process_sessions / kolom sv ada di skema).
     */
    public function up(): void
    {
        if (! Schema::hasColumn('sensor_readings', 'process_session_id')) {
            Schema::table('sensor_readings', function (Blueprint $table) {
                $table->foreignId('process_session_id')
                    ->nullable()
                    ->after('batch_id')
                    ->constrained('process_sessions')
                    ->nullOnDelete();

                $table->index('process_session_id', 'idx_readings_session');
            });
        }

        if (! Schema::hasColumn('sensor_readings', 'sv')) {
            Schema::table('sensor_readings', function (Blueprint $table) {
                $table->decimal('sv', 5, 2)->nullable()->after('temperature');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('sensor_readings', 'process_session_id')) {
            Schema::table('sensor_readings', function (Blueprint $table) {
                $table->dropForeign(['process_session_id']);
                $table->dropIndex('idx_readings_session');
                $table->dropColumn('process_session_id');
            });
        }

        if (Schema::hasColumn('sensor_readings', 'sv')) {
            Schema::table('sensor_readings', function (Blueprint $table) {
                $table->dropColumn('sv');
            });
        }
    }
};
