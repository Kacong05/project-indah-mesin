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
            $table->string('name')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->integer('data_count')->default(0);
            $table->enum('status', ['active', 'completed'])->default('active');
            $table->timestamps();

            $table->index(['started_at', 'ended_at']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('process_sessions');
    }
};
