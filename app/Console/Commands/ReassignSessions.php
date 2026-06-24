<?php

namespace App\Console\Commands;

use App\Services\ProcessSessionService;
use Illuminate\Console\Command;

class ReassignSessions extends Command
{
    protected $signature = 'sessions:reassign {threshold=10}';
    protected $description = 'Reassign sensor readings to process sessions based on time gap';

    public function handle(): int
    {
        $threshold = (int) $this->argument('threshold');

        $this->info("Mulai re-assign dengan threshold {$threshold} menit...");

        $service = app(ProcessSessionService::class);
        $count = $service->reassignExistingData($threshold);

        $this->info("Berhasil membuat {$count} sesi dari data yang ada.");
        $this->info("Total sesi saat ini: " . \App\Models\ProcessSession::count());

        return Command::SUCCESS;
    }
}
