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
        Schema::create('alarms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->constrained('retort_machines')->cascadeOnDelete();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 30);
            $table->string('severity', 15)->default('warning');
            $table->string('message', 500);
            $table->jsonb('metadata')->nullable();
            $table->string('status', 15)->default('active');
            $table->timestamp('triggered_at');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['machine_id', 'status'], 'idx_alarms_machine_status');
            $table->index(['type', 'triggered_at'], 'idx_alarms_type_triggered');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alarms');
    }
};
