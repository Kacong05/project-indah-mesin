<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('process_sessions', function (Blueprint $table) {
            $table->string('source_file')->nullable()->after('status');
            $table->string('source_hash', 64)->nullable()->after('source_file');
            $table->unique(['machine_id', 'source_hash'], 'process_sessions_machine_source_hash_unique');
        });
    }

    public function down(): void
    {
        Schema::table('process_sessions', function (Blueprint $table) {
            $table->dropUnique('process_sessions_machine_source_hash_unique');
            $table->dropColumn(['source_file', 'source_hash']);
        });
    }
};
