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
        Schema::create('sensor_readings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->constrained('retort_machines')->cascadeOnDelete();
            $table->foreignId('batch_id')->nullable()->constrained('production_batches')->nullOnDelete();
            $table->decimal('temperature', 6, 2);
            $table->decimal('pressure', 6, 3);
            $table->string('process_status', 30)->default('idle');
            $table->timestamp('recorded_at');
            $table->timestamp('created_at')->nullable();

            $table->index(['machine_id', 'recorded_at'], 'idx_readings_machine_recorded');
            $table->index('batch_id', 'idx_readings_batch');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sensor_readings');
    }
};
