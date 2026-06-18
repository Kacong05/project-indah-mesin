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
        Schema::create('alarm_thresholds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->unique('idx_thresholds_machine')->constrained('retort_machines')->cascadeOnDelete();
            $table->decimal('temp_warning', 6, 2)->default(120.00);
            $table->decimal('temp_critical', 6, 2)->default(135.00);
            $table->decimal('pressure_warning', 6, 3)->default(2.500);
            $table->decimal('pressure_critical', 6, 3)->default(3.000);
            $table->integer('heartbeat_timeout')->default(300);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alarm_thresholds');
    }
};
