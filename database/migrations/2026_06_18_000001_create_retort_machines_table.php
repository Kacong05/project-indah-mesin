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
        Schema::create('retort_machines', function (Blueprint $table) {
            $table->id();
            $table->string('machine_code', 50)->unique();
            $table->string('name');
            $table->string('location');
            $table->string('status', 20)->default('standby')->index('idx_machines_status');
            $table->text('description')->nullable();
            $table->timestamp('last_heartbeat_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('retort_machines');
    }
};
