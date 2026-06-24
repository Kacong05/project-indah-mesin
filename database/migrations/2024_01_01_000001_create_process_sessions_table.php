<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('process_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable(); // Contoh: "Proses 1", "Proses 2"
            $table->timestamp('started_at');   // Timestamp data pertama
            $table->timestamp('ended_at')->nullable(); // Timestamp data terakhir (diupdate terus)
            $table->integer('data_count')->default(0); // Jumlah data dalam sesi ini
            $table->enum('status', ['active', 'completed'])->default('active');
            $table->timestamps();

            $table->index(['started_at', 'ended_at']);
            $table->index('status');
        });

        // Tambah kolom process_session_id ke sensor_readings
        Schema::table('sensor_readings', function (Blueprint $table) {
            $table->foreignId('process_session_id')
                  ->nullable()
                  ->after('device_id')
                  ->constrained('process_sessions')
                  ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sensor_readings', function (Blueprint $table) {
            $table->dropForeign(['process_session_id']);
            $table->dropColumn('process_session_id');
        });

        Schema::dropIfExists('process_sessions');
    }
};
