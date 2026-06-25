<?php

namespace App\Console\Commands;

use App\Services\ProcessSessionService;
use Illuminate\Console\Command;

class FixSessionsEndedAt extends Command
{
    protected $signature = 'sessions:fix-ended-at';
    protected $description = 'Fix ended_at timestamps for all sessions based on their last sensor reading';

    public function handle(): int
    {
        $this->info('Memperbaiki ended_at untuk semua sesi...');

        $service = app(ProcessSessionService::class);
        $count = $service->fixSessionsEndedAt();

        $this->info("Berhasil memperbaiki {$count} sesi.");

        return Command::SUCCESS;
    }
}
