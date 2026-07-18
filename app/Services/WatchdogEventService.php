<?php

namespace App\Services;

use App\Models\SystemEvent;
use Carbon\Carbon;

class WatchdogEventService
{
    /** @var list<string> */
    public const WATCHDOG_REASONS = ['WDT', 'INT_WDT', 'TASK_WDT'];

    public static function latestForMachine(?string $machineCode, int $hours = 24): ?array
    {
        if (! $machineCode) {
            return null;
        }

        $event = SystemEvent::where('machine_code', $machineCode)
            ->whereIn('reason', self::WATCHDOG_REASONS)
            ->where(function ($query) {
                $query->where('event', 'watchdog')
                    ->orWhere('event', 'boot');
            })
            ->where('created_at', '>=', now()->subHours($hours))
            ->latest()
            ->first();

        return self::formatForDisplay($event);
    }

    public static function formatForDisplay(?SystemEvent $event): ?array
    {
        if (! $event) {
            return null;
        }

        $at = $event->iso
            ? Carbon::parse($event->iso)->timezone('Asia/Jakarta')
            : $event->created_at->copy()->timezone('Asia/Jakarta');

        return [
            'id' => $event->id,
            'reason' => $event->reason,
            'iso' => $event->iso,
            'displayAt' => $at->format('d/m/Y H:i:s').' WIB',
            'created_at' => $event->created_at->toIso8601String(),
        ];
    }
}
